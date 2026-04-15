const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');
const { uploadMem, uploadDir } = require('../middleware/upload');
const r2 = require('../services/r2Service');
const { ok, err } = require('../utils/respond');

// ── POST /api/upload ──────────────────────────────────────────────────────────
// Generic single-file upload (moments images, etc.)
// Returns: { url }
router.post('/', auth, uploadMem.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return err(res, 'No file uploaded');

    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.jpg';
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    let url = await r2.uploadFile(req.file.buffer, key, req.file.mimetype);
    if (!url) {
      await fs.promises.writeFile(path.join(uploadDir, key), req.file.buffer);
      url = `${req.protocol}://${req.get('host')}/uploads/${key}`;
    }

    ok(res, { url });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
