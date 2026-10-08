const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

/**
 * Get dynamic configured upload size limit in Megabytes (Defaults to 250 MB)
 */
function getMaxUploadSizeMb() {
  const envVal = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '250', 10);
  return isNaN(envVal) || envVal <= 0 ? 250 : envVal;
}

/**
 * Get dynamic configured upload size limit in Bytes
 */
function getMaxUploadSizeBytes() {
  return getMaxUploadSizeMb() * 1024 * 1024;
}

// Temporary directory for streaming disk storage during upload to avoid RAM exhaustion
const TEMP_UPLOAD_DIR = path.resolve(__dirname, '../uploads/temp_uploads');
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

// Configure streaming disk storage so large files (up to 250+ MB) are written to disk directly in chunks
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    cb(null, `upload_${uniqueId}${ext}`);
  }
});

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

/**
 * Express middleware wrapper to handle multer errors gracefully with streaming disk storage
 */
const handleUpload = (fieldName = 'file') => {
  return (req, res, next) => {
    const maxBytes = getMaxUploadSizeBytes();
    const maxMb = getMaxUploadSizeMb();

    const upload = multer({
      storage,
      limits: {
        fileSize: maxBytes,
        files: 1
      },
      fileFilter
    }).single(fieldName);

    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlink(req.file.path, () => {});
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File size exceeds the maximum allowed limit of ${maxMb}MB.`
          });
        }
        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`
        });
      } else if (err) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlink(req.file.path, () => {});
        }
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
  getMaxUploadSizeMb,
  getMaxUploadSizeBytes,
  get MAX_FILE_SIZE_BYTES() {
    return getMaxUploadSizeBytes();
  }
};
