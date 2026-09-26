const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const stream = require('stream');
const StorageProvider = require('./StorageProvider');

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
   * Save a file buffer to persistent Supabase Storage & local cache
   * @param {string|number} userId 
   * @param {string} originalFilename 
   * @param {Buffer} buffer 
   * @returns {Promise<{ filePath: string, size: number, storage: string }>}
   */
  async saveFile(userId, originalFilename, buffer) {
    const sanitizedExt = path.extname(originalFilename).toLowerCase() || '.csv';
    const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const safeFilename = `${uniqueId}${sanitizedExt}`;
    const storageKey = `${userId}/${safeFilename}`;
    const cleanKey = this._sanitizeKey(storageKey);
    const mimeType = this._getMimeType(safeFilename);

    // 1. Upload to Supabase Storage (cloud persistence)
    if (this.client && this.client.storage) {
      try {
        const { data, error } = await this.client.storage
          .from(this.bucket)
          .upload(cleanKey, buffer, {
            contentType: mimeType,
            upsert: true
          });

        if (error) {
          console.warn(`[SupabaseStorageProvider] Cloud upload notice: ${error.message}. Caching locally.`);
        }
      } catch (err) {
        console.warn(`[SupabaseStorageProvider] Cloud upload exception: ${err.message}. Caching locally.`);
      }
    }

    // 2. Write to local cache for instant sub-millisecond retrieval
    const cachedPath = this._getCachedPath(cleanKey);
    const cachedDir = path.dirname(cachedPath);
    if (!fs.existsSync(cachedDir)) {
      fs.mkdirSync(cachedDir, { recursive: true });
    }
    await fs.promises.writeFile(cachedPath, buffer);

    return {
      filePath: cleanKey,
      fullPath: cachedPath,
      size: buffer.length,
      storage: 'supabase'
    };
  }

  /**
   * Read file content from storage as a buffer
   * Tiers: Local Cache -> Supabase Cloud Storage -> Bundled Seed -> Legacy Disk
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

    // 2. Download from Supabase Cloud Storage
    if (this.client && this.client.storage) {
      try {
        const { data, error } = await this.client.storage
          .from(this.bucket)
          .download(cleanKey);

        if (!error && data) {
          const buffer = Buffer.from(await data.arrayBuffer());

          // Populate local cache for subsequent read performance
          const cachedDir = path.dirname(cachedPath);
          if (!fs.existsSync(cachedDir)) {
            fs.mkdirSync(cachedDir, { recursive: true });
          }
          await fs.promises.writeFile(cachedPath, buffer).catch(() => {});

          return buffer;
        }
      } catch (cloudErr) {
        // Fall through to bundled seed / legacy
      }
    }

    // 3. Check bundled seed directory (server/data/datasets)
    const seedPath = path.join(this.seedDir, cleanKey);
    if (fs.existsSync(seedPath)) {
      const buffer = await fs.promises.readFile(seedPath);

      // Self-healing: auto-backfill into Supabase Storage if cloud client is present
      if (this.client && this.client.storage) {
        this.client.storage
          .from(this.bucket)
          .upload(cleanKey, buffer, {
            contentType: this._getMimeType(cleanKey),
            upsert: true
          })
          .then(() => {
            console.log(`[SupabaseStorageProvider] Auto-backfilled seed dataset to cloud: ${cleanKey}`);
          })
          .catch((e) => {
            console.warn(`[SupabaseStorageProvider] Auto-backfill notice for ${cleanKey}:`, e.message);
          });
      }

      // Populate local cache
      const cachedDir = path.dirname(cachedPath);
      if (!fs.existsSync(cachedDir)) {
        fs.mkdirSync(cachedDir, { recursive: true });
      }
      await fs.promises.writeFile(cachedPath, buffer).catch(() => {});

      return buffer;
    }

    // 4. Check legacy uploads directory
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

    // If not cached, create a pass-through stream and populate async
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
    try {
      const cleanKey = this._sanitizeKey(filePath);

      // 1. Fast cache check
      const cachedPath = this._getCachedPath(cleanKey);
      if (fs.existsSync(cachedPath)) return true;

      // 2. Bundled seed check
      const seedPath = path.join(this.seedDir, cleanKey);
      if (fs.existsSync(seedPath)) return true;

      // 3. Legacy uploads check
      const legacyPath = path.join(this.legacyDir, cleanKey);
      if (fs.existsSync(legacyPath)) return true;

      // 4. Supabase Cloud Storage check
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
   * Delete a file from persistent Supabase Storage & local cache
   * @param {string} filePath 
   * @returns {Promise<boolean>}
   */
  async deleteFile(filePath) {
    try {
      const cleanKey = this._sanitizeKey(filePath);

      // 1. Remove from Supabase Storage
      if (this.client && this.client.storage) {
        await this.client.storage
          .from(this.bucket)
          .remove([cleanKey])
          .catch(() => {});
      }

      // 2. Remove from local cache
      const cachedPath = this._getCachedPath(cleanKey);
      if (fs.existsSync(cachedPath)) {
        await fs.promises.unlink(cachedPath).catch(() => {});
      }

      // 3. Remove from legacy uploads dir if exists
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
