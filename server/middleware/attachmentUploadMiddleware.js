const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const TEMP_DIR = path.resolve(__dirname, '../uploads/temp_attachments');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    cb(null, `attach_${uniqueId}${ext}`);
  }
});

const allowedExtensions = [
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  // Documents & Data
  '.pdf', '.csv', '.xlsx', '.xls', '.json', '.txt', '.doc', '.docx'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    const error = new Error(`Unsupported file type (${ext}). Allowed: images (png, jpg, gif, webp, svg) and documents (pdf, csv, xlsx, json, txt, docx).`);
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }
  cb(null, true);
};

// Limit 25 MB
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

const handleAttachmentUpload = (fieldName = 'file') => {
  return (req, res, next) => {
    const uploadSingle = upload.single(fieldName);
    uploadSingle(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: 'File too large. Maximum attachment size is 25 MB.'
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed.'
        });
      }
      next();
    });
  };
};

module.exports = {
  handleAttachmentUpload
};
