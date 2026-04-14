const router = require('express').Router();
const env = require('../config/env');

/**
 * GET /api/status
 * Public endpoint — no auth required.
 * Returns maintenance state and minimum supported client version.
 */
router.get('/', (req, res) => {
  res.json({
    maintenance: env.MAINTENANCE_MODE,
    message: env.MAINTENANCE_MESSAGE,
    minVersion: env.MIN_APP_VERSION,
  });
});

module.exports = router;
