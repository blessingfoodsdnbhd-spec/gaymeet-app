const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

// Ensure upload directory exists
const uploadDir = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

// Memory-storage variant — used when R2 is configured so the buffer
// is available before any disk write occurs.
const uploadMem = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

module.exports = { upload, uploadMem, uploadDir };
