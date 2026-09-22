const LocalStorageProvider = require('./LocalStorageProvider');

// Singleton instance of StorageProvider
const storage = new LocalStorageProvider();

module.exports = storage;
