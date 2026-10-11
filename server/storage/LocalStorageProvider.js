const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const StorageProvider = require('./StorageProvider');
const db = require('../config/database');

class LocalStorageProvider extends StorageProvider {
  constructor(baseDir) {
    super();
    this.baseDir = baseDir || path.resolve(__dirname, '../uploads/datasets');
    this._ensureBaseDirectory();
  }

  _ensureBaseDirectory() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Validate that the target path does not escape base directory (Path Traversal Protection)
   */
  _getSafePath(filePath) {
    // If it's already an absolute path, verify it's inside baseDir
    const resolvedPath = path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.normalize(path.join(this.baseDir, filePath));

    if (!resolvedPath.startsWith(path.normalize(this.baseDir))) {
      throw new Error('Security Alert: Access outside designated storage directory is forbidden.');
    }

    return resolvedPath;
  }

  async saveFile(userId, originalFilename, bufferOrPath) {
    const userDir = path.join(this.baseDir, String(userId));
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const sanitizedExt = path.extname(originalFilename).toLowerCase() || '.dat';
    const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const safeFilename = `${uniqueId}${sanitizedExt}`;
    const destinationPath = path.join(userDir, safeFilename);

    let fileSize = 0;
    let fileBuffer = null;
    if (typeof bufferOrPath === 'string' && fs.existsSync(bufferOrPath)) {
      await fs.promises.copyFile(bufferOrPath, destinationPath);
      fileBuffer = await fs.promises.readFile(destinationPath);
      fileSize = fileBuffer.length;

      // Clean up temp upload file if applicable
      if (bufferOrPath.includes('temp_uploads') || bufferOrPath.includes('temp')) {
        fs.unlink(bufferOrPath, () => {});
      }
    } else if (Buffer.isBuffer(bufferOrPath)) {
      fileBuffer = bufferOrPath;
      await fs.promises.writeFile(destinationPath, bufferOrPath);
      fileSize = bufferOrPath.length;
    } else {
      const contentStr = String(bufferOrPath || '');
      fileBuffer = Buffer.from(contentStr, 'utf8');
      await fs.promises.writeFile(destinationPath, contentStr, 'utf8');
      fileSize = fileBuffer.length;
    }

    // Relative storage key to abstract away physical server directory
    const relativeKey = path.relative(this.baseDir, destinationPath).replace(/\\/g, '/');

    // Database backup
    try {
      await db.query(`
        INSERT INTO dataset_storage_files (file_path, content, size, mime_type, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (file_path) DO UPDATE
        SET content = EXCLUDED.content,
            size = EXCLUDED.size,
            updated_at = CURRENT_TIMESTAMP
      `, [relativeKey, fileBuffer, fileSize, sanitizedExt === '.json' ? 'application/json' : 'text/csv']);
    } catch (_) {}

    return {
      filePath: relativeKey,
      fullPath: destinationPath,
      size: fileSize
    };
  }

  async readFile(filePath) {
    const cleanKey = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    try {
      const safePath = this._getSafePath(filePath);
      if (fs.existsSync(safePath)) {
        return await fs.promises.readFile(safePath);
      }
    } catch (err) {
      // Check next tier
    }

    // Check database dataset_storage_files
    try {
      const pgRes = await db.query('SELECT content FROM dataset_storage_files WHERE file_path = $1', [cleanKey]);
      if (pgRes.rowCount > 0 && pgRes.rows[0].content) {
        return Buffer.isBuffer(pgRes.rows[0].content) ? pgRes.rows[0].content : Buffer.from(pgRes.rows[0].content);
      }
    } catch (_) {}

    const seedPath = path.resolve(__dirname, '../data/datasets', filePath);
    if (fs.existsSync(seedPath)) {
      return await fs.promises.readFile(seedPath);
    }

    const safePath = this._getSafePath(filePath);
    return await fs.promises.readFile(safePath);
  }

  getFileStream(filePath) {
    try {
      const safePath = this._getSafePath(filePath);
      if (fs.existsSync(safePath)) {
        return fs.createReadStream(safePath);
      }
    } catch (err) {
      // Check next tier
    }

    const seedPath = path.resolve(__dirname, '../data/datasets', filePath);
    if (fs.existsSync(seedPath)) {
      return fs.createReadStream(seedPath);
    }

    const safePath = this._getSafePath(filePath);
    return fs.createReadStream(safePath);
  }

  async deleteFile(filePath) {
    const cleanKey = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    try {
      await db.query('DELETE FROM dataset_storage_files WHERE file_path = $1', [cleanKey]);
    } catch (_) {}

    try {
      const safePath = this._getSafePath(filePath);
      if (fs.existsSync(safePath)) {
        await fs.promises.unlink(safePath);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`LocalStorage delete warning: ${err.message}`);
      return false;
    }
  }

  async exists(filePath) {
    if (!filePath) return false;
    const cleanKey = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    try {
      const safePath = this._getSafePath(filePath);
      if (fs.existsSync(safePath)) return true;
    } catch (err) {
      // Check next tier
    }

    try {
      const pgRes = await db.query('SELECT 1 FROM dataset_storage_files WHERE file_path = $1 LIMIT 1', [cleanKey]);
      if (pgRes.rowCount > 0) return true;
    } catch (_) {}

    const seedPath = path.resolve(__dirname, '../data/datasets', filePath);
    if (fs.existsSync(seedPath)) return true;

    return false;
  }
}

module.exports = LocalStorageProvider;
