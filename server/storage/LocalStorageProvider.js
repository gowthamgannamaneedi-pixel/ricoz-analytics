const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const StorageProvider = require('./StorageProvider');

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

  async saveFile(userId, originalFilename, buffer) {
    const userDir = path.join(this.baseDir, String(userId));
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const sanitizedExt = path.extname(originalFilename).toLowerCase() || '.dat';
    const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const safeFilename = `${uniqueId}${sanitizedExt}`;
    const destinationPath = path.join(userDir, safeFilename);

    await fs.promises.writeFile(destinationPath, buffer);

    // Relative storage key to abstract away physical server directory
    const relativeKey = path.relative(this.baseDir, destinationPath).replace(/\\/g, '/');

    return {
      filePath: relativeKey,
      fullPath: destinationPath,
      size: buffer.length
    };
  }

  async readFile(filePath) {
    const safePath = this._getSafePath(filePath);
    return await fs.promises.readFile(safePath);
  }

  getFileStream(filePath) {
    const safePath = this._getSafePath(filePath);
    return fs.createReadStream(safePath);
  }

  async deleteFile(filePath) {
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
    try {
      const safePath = this._getSafePath(filePath);
      return fs.existsSync(safePath);
    } catch (err) {
      return false;
    }
  }
}

module.exports = LocalStorageProvider;
