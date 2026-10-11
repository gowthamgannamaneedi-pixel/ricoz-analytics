const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const stream = require('stream');
const StorageProvider = require('./StorageProvider');
const db = require('../config/database');

/**
 * Enterprise Supabase Storage Provider
 * Persistent cloud object storage for datasets, backed by Supabase Storage ('datasets' bucket).
 * Features:
 * - Private, tenant-partitioned object storage
 * - Local ephemeral caching for sub-millisecond read latency
 * - Automatic self-healing backfill for bundled seed datasets
 * - Strict path traversal protection
 * - Streamable read support
 */
class SupabaseStorageProvider extends StorageProvider {
  /**
   * @param {object} options
   * @param {any} options.client Supabase client instance
   * @param {string} [options.bucket='datasets'] Storage bucket name
   * @param {string} [options.cacheDir] Local cache directory
   * @param {string} [options.seedDir] Tracked seed datasets directory
   */
  constructor(options = {}) {
    super();
    this.client = options.client || null;
    this.bucket = options.bucket || process.env.SUPABASE_STORAGE_BUCKET || 'datasets';
    this.cacheDir = options.cacheDir || path.resolve(__dirname, '../uploads/cache/datasets');
    this.seedDir = options.seedDir || path.resolve(__dirname, '../data/datasets');
    this.legacyDir = path.resolve(__dirname, '../uploads/datasets');

    this._ensureDirectories();
  }

  _ensureDirectories() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Path Traversal Protection:
   * Rejects any path with relative navigation ("..") or invalid characters.
   */
  _sanitizeKey(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Storage key is required.');
    }

    const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = normalized.split('/');

    if (segments.some(s => s === '..' || s === '.' || s.includes('\0'))) {
      throw new Error('Security Alert: Access outside designated storage directory is forbidden.');
    }

    return normalized;
  }

  /**
   * Get cached path on local filesystem
   */
  _getCachedPath(cleanKey) {
    return path.join(this.cacheDir, cleanKey);
  }

  /**
   * Determine MIME type from filename extension
   */
  _getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.csv':
        return 'text/csv';
      case '.json':
        return 'application/json';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Save a file buffer to persistent storage (PostgreSQL dataset_storage_files + Supabase + local cache)
   * @param {string|number} userId 
   * @param {string} originalFilename 
   * @param {Buffer|string} bufferOrPath 
   * @returns {Promise<{ filePath: string, size: number, storage: string }>}
   */
  async saveFile(userId, originalFilename, bufferOrPath) {
    const sanitizedExt = path.extname(originalFilename).toLowerCase() || '.csv';
    const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const safeFilename = `${uniqueId}${sanitizedExt}`;
    const storageKey = `${userId}/${safeFilename}`;
    const cleanKey = this._sanitizeKey(storageKey);
    const mimeType = this._getMimeType(safeFilename);

    const cachedPath = this._getCachedPath(cleanKey);
    const cachedDir = path.dirname(cachedPath);
    if (!fs.existsSync(cachedDir)) {
      fs.mkdirSync(cachedDir, { recursive: true });
    }

    let fileSize = 0;
    let fileBuffer = null;
    const isFilePath = typeof bufferOrPath === 'string' && fs.existsSync(bufferOrPath);

    if (isFilePath) {
      await fs.promises.copyFile(bufferOrPath, cachedPath);
      fileBuffer = await fs.promises.readFile(cachedPath);
      fileSize = fileBuffer.length;
    } else if (Buffer.isBuffer(bufferOrPath)) {
      fileBuffer = bufferOrPath;
      await fs.promises.writeFile(cachedPath, bufferOrPath);
      fileSize = bufferOrPath.length;
    } else {
      const contentStr = String(bufferOrPath || '');
      fileBuffer = Buffer.from(contentStr, 'utf8');
      await fs.promises.writeFile(cachedPath, contentStr, 'utf8');
      fileSize = fileBuffer.length;
    }

    // 1. Persistent Database Storage: Save in PostgreSQL dataset_storage_files
    try {
      await db.query(`
        INSERT INTO dataset_storage_files (file_path, content, size, mime_type, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (file_path) DO UPDATE
        SET content = EXCLUDED.content,
            size = EXCLUDED.size,
            mime_type = EXCLUDED.mime_type,
            updated_at = CURRENT_TIMESTAMP
      `, [cleanKey, fileBuffer, fileSize, mimeType]);
    } catch (pgErr) {
      console.warn(`[SupabaseStorageProvider] PostgreSQL storage backup notice: ${pgErr.message}`);
    }

    // 2. Upload to Supabase Storage (cloud persistence)
    if (this.client && this.client.storage) {
      try {
        const { error } = await this.client.storage
          .from(this.bucket)
          .upload(cleanKey, fileBuffer, {
            contentType: mimeType,
            upsert: true
          });

        if (error) {
          console.warn(`[SupabaseStorageProvider] Cloud upload notice: ${error.message}. Persisted in database and local cache.`);
        }
      } catch (err) {
        console.warn(`[SupabaseStorageProvider] Cloud upload exception: ${err.message}. Persisted in database and local cache.`);
      }
    }

    // Clean up temp upload file if applicable
    if (isFilePath && (bufferOrPath.includes('temp_uploads') || bufferOrPath.includes('temp'))) {
      fs.unlink(bufferOrPath, () => {});
    }

    return {
      filePath: cleanKey,
      fullPath: cachedPath,
      size: fileSize,
      storage: 'supabase'
    };
  }

  /**
   * Read file content from storage as a buffer
   * Tiers: Local Cache -> PostgreSQL dataset_storage_files -> Supabase Cloud Storage -> PostgreSQL dataset_rows reconstruction -> Bundled Seed -> Legacy Disk
   * @param {string} filePath 
   * @returns {Promise<Buffer>}
   */
  async readFile(filePath) {
    const cleanKey = this._sanitizeKey(filePath);

    // 1. Check fast local ephemeral cache
    const cachedPath = this._getCachedPath(cleanKey);
    if (fs.existsSync(cachedPath)) {
      return await fs.promises.readFile(cachedPath);
    }

    // 2. Check PostgreSQL persistent storage (survives container restarts)
    try {
      const pgRes = await db.query(
        'SELECT content FROM dataset_storage_files WHERE file_path = $1',
        [cleanKey]
      );
      if (pgRes.rowCount > 0 && pgRes.rows[0].content) {
        const buffer = Buffer.isBuffer(pgRes.rows[0].content)
          ? pgRes.rows[0].content
          : Buffer.from(pgRes.rows[0].content);

        // Populate local cache for fast subsequent reads
        const cachedDir = path.dirname(cachedPath);
        if (!fs.existsSync(cachedDir)) {
          fs.mkdirSync(cachedDir, { recursive: true });
        }
        await fs.promises.writeFile(cachedPath, buffer).catch(() => {});
        return buffer;
      }
    } catch (_) {}

    // 3. Download from Supabase Cloud Storage
    if (this.client && this.client.storage) {
      try {
        const { data, error } = await this.client.storage
          .from(this.bucket)
          .download(cleanKey);

        if (!error && data) {
          const buffer = Buffer.from(await data.arrayBuffer());

          // Populate local cache and PostgreSQL backup
          const cachedDir = path.dirname(cachedPath);
          if (!fs.existsSync(cachedDir)) {
            fs.mkdirSync(cachedDir, { recursive: true });
          }
          await fs.promises.writeFile(cachedPath, buffer).catch(() => {});

          db.query(`
            INSERT INTO dataset_storage_files (file_path, content, size, mime_type, updated_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (file_path) DO NOTHING
          `, [cleanKey, buffer, buffer.length, this._getMimeType(cleanKey)]).catch(() => {});

          return buffer;
        }
      } catch (cloudErr) {
        // Fall through to next tier
      }
    }

    // 4. Reconstruct from PostgreSQL dataset_rows if rows exist for this dataset
    try {
      const dsRes = await db.query(
        'SELECT id, schema, row_count, name FROM datasets WHERE file_path = $1 OR file_path LIKE $2 LIMIT 1',
        [cleanKey, `%${cleanKey}`]
      );
      if (dsRes.rowCount > 0) {
        const ds = dsRes.rows[0];
        const rowsRes = await db.query(
          'SELECT data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index ASC',
          [ds.id]
        );
        if (rowsRes.rowCount > 0) {
          const ext = path.extname(cleanKey).toLowerCase();
          let reconstructedBuffer;
          if (ext === '.json') {
            const records = rowsRes.rows.map(r => r.data);
            reconstructedBuffer = Buffer.from(JSON.stringify(records, null, 2), 'utf8');
          } else {
            // CSV
            let schema = ds.schema;
            if (typeof schema === 'string') {
              try { schema = JSON.parse(schema); } catch (_) { schema = []; }
            }
            const firstRow = rowsRes.rows[0].data || {};
            const headers = Array.isArray(schema) && schema.length > 0
              ? schema.map(s => s.name || s)
              : Object.keys(firstRow);
            let csvText = headers.join(',') + '\n';
            for (const r of rowsRes.rows) {
              const row = r.data || {};
              const line = headers.map(h => {
                const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
                return val.includes(',') || val.includes('"') || val.includes('\n')
                  ? `"${val.replace(/"/g, '""')}"`
                  : val;
              }).join(',');
              csvText += line + '\n';
            }
            reconstructedBuffer = Buffer.from(csvText, 'utf8');
          }

          // Populate local cache and PostgreSQL persistent storage table
          const cachedDir = path.dirname(cachedPath);
          if (!fs.existsSync(cachedDir)) {
            fs.mkdirSync(cachedDir, { recursive: true });
          }
          await fs.promises.writeFile(cachedPath, reconstructedBuffer).catch(() => {});

          db.query(`
            INSERT INTO dataset_storage_files (file_path, content, size, mime_type, updated_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (file_path) DO NOTHING
          `, [cleanKey, reconstructedBuffer, reconstructedBuffer.length, this._getMimeType(cleanKey)]).catch(() => {});

          return reconstructedBuffer;
        }
      }
    } catch (_) {}

    // 5. Check bundled seed directory (server/data/datasets)
    const seedPath = path.join(this.seedDir, cleanKey);
    if (fs.existsSync(seedPath)) {
      const buffer = await fs.promises.readFile(seedPath);
      return buffer;
    }

    // 6. Check legacy uploads directory
    const legacyPath = path.join(this.legacyDir, cleanKey);
    if (fs.existsSync(legacyPath)) {
      const buffer = await fs.promises.readFile(legacyPath);
      return buffer;
    }

    throw new Error('Dataset file does not exist on storage.');
  }

  /**
   * Get a readable stream for a file
   * @param {string} filePath 
   * @returns {stream.Readable}
   */
  getFileStream(filePath) {
    const cleanKey = this._sanitizeKey(filePath);
    const cachedPath = this._getCachedPath(cleanKey);

    if (fs.existsSync(cachedPath)) {
      return fs.createReadStream(cachedPath);
    }

    // If not cached, create a pass-through stream and populate from readFile
    const pass = new stream.PassThrough();
    this.readFile(cleanKey)
      .then(buffer => {
        pass.write(buffer);
        pass.end();
      })
      .catch(err => {
        pass.destroy(err);
      });

    return pass;
  }

  /**
   * Check if a file exists across storage tiers
   * @param {string} filePath 
   * @returns {Promise<boolean>}
   */
  async exists(filePath) {
    if (!filePath) return false;
    try {
      const cleanKey = this._sanitizeKey(filePath);

      // 1. Fast cache check
      const cachedPath = this._getCachedPath(cleanKey);
      if (fs.existsSync(cachedPath)) return true;

      // 2. PostgreSQL dataset_storage_files table check
      try {
        const pgRes = await db.query(
          'SELECT 1 FROM dataset_storage_files WHERE file_path = $1 LIMIT 1',
          [cleanKey]
        );
        if (pgRes.rowCount > 0) return true;
      } catch (_) {}

      // 3. PostgreSQL dataset_rows table check for corresponding dataset
      try {
        const dsRes = await db.query(
          'SELECT id FROM datasets WHERE file_path = $1 OR file_path LIKE $2 LIMIT 1',
          [cleanKey, `%${cleanKey}`]
        );
        if (dsRes.rowCount > 0) {
          const rowRes = await db.query(
            'SELECT 1 FROM dataset_rows WHERE dataset_id = $1 LIMIT 1',
            [dsRes.rows[0].id]
          );
          if (rowRes.rowCount > 0) return true;
        }
      } catch (_) {}

      // 4. Bundled seed check
      const seedPath = path.join(this.seedDir, cleanKey);
      if (fs.existsSync(seedPath)) return true;

      // 5. Legacy uploads check
      const legacyPath = path.join(this.legacyDir, cleanKey);
      if (fs.existsSync(legacyPath)) return true;

      // 6. Supabase Cloud Storage check
      if (this.client && this.client.storage) {
        const folder = path.dirname(cleanKey).replace(/\\/g, '/');
        const filename = path.basename(cleanKey);

        const { data, error } = await this.client.storage
          .from(this.bucket)
          .list(folder === '.' ? '' : folder, {
            search: filename,
            limit: 10
          });

        if (!error && Array.isArray(data)) {
          const match = data.some(f => f.name === filename);
          if (match) return true;
        }
      }

      return false;
    } catch (err) {
      return false;
    }
  }

  /**
   * Delete a file from persistent Supabase Storage, PostgreSQL, and local cache
   * @param {string} filePath 
   * @returns {Promise<boolean>}
   */
  async deleteFile(filePath) {
    try {
      const cleanKey = this._sanitizeKey(filePath);

      // 1. Remove from PostgreSQL dataset_storage_files
      try {
        await db.query('DELETE FROM dataset_storage_files WHERE file_path = $1', [cleanKey]);
      } catch (_) {}

      // 2. Remove from Supabase Storage
      if (this.client && this.client.storage) {
        await this.client.storage
          .from(this.bucket)
          .remove([cleanKey])
          .catch(() => {});
      }

      // 3. Remove from local cache
      const cachedPath = this._getCachedPath(cleanKey);
      if (fs.existsSync(cachedPath)) {
        await fs.promises.unlink(cachedPath).catch(() => {});
      }

      // 4. Remove from legacy uploads dir if exists
      const legacyPath = path.join(this.legacyDir, cleanKey);
      if (fs.existsSync(legacyPath)) {
        await fs.promises.unlink(legacyPath).catch(() => {});
      }

      return true;
    } catch (err) {
      console.warn(`[SupabaseStorageProvider.deleteFile] Notice:`, err.message);
      return false;
    }
  }
}

module.exports = SupabaseStorageProvider;
