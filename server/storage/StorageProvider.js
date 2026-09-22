/**
 * Abstract Storage Provider interface
 * Allows swapping between LocalStorage, S3, or GCS without changing business logic
 */
class StorageProvider {
  /**
   * Save a file buffer to storage
   * @param {number|string} userId
   * @param {string} filename
   * @param {Buffer|string} buffer
   * @returns {Promise<{ filePath: string, size: number }>}
   */
  async saveFile(userId, filename, buffer) {
    throw new Error('StorageProvider.saveFile() not implemented');
  }

  /**
   * Read full file contents as string or Buffer
   * @param {string} filePath
   * @returns {Promise<Buffer>}
   */
  async readFile(filePath) {
    throw new Error('StorageProvider.readFile() not implemented');
  }

  /**
   * Create a readable stream for a stored file
   * @param {string} filePath
   * @returns {import('stream').Readable}
   */
  getFileStream(filePath) {
    throw new Error('StorageProvider.getFileStream() not implemented');
  }

  /**
   * Delete a file safely
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  async deleteFile(filePath) {
    throw new Error('StorageProvider.deleteFile() not implemented');
  }

  /**
   * Check if file exists
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  async exists(filePath) {
    throw new Error('StorageProvider.exists() not implemented');
  }
}

module.exports = StorageProvider;
