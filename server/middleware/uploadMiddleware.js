const multer = require('multer');
const path = require('path');

// Configure in-memory storage buffer so we can validate and save through StorageProvider
const storage = multer.memoryStorage();

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * File filter to accept only CSV and JSON files
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.csv', '.json'];

  if (!allowedExts.includes(ext)) {
    const error = new Error('Invalid file type. Only CSV (.csv) and JSON (.json) files are permitted.');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter
});

/**
 * Express middleware wrapper to handle multer errors gracefully
 */
const handleUpload = (fieldName = 'file') => {
  return (req, res, next) => {
    const uploader = upload.single(fieldName);
    uploader(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File size exceeds the maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`
          });
        }
        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      next();
    });
  };
};

module.exports = {
  handleUpload,
  MAX_FILE_SIZE_BYTES
};
