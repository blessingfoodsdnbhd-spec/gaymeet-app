/**
 * Blocks content creation for accounts whose posting has been suspended
 * (e.g. by an IP quarantine). Read/browse still works; only create endpoints
 * mount this (after `auth`, so req.user is populated).
 */
module.exports = function postingSuspended(req, res, next) {
  if (req.user && req.user.postingSuspended) {
    return res.status(403).json({
      error: '账号发布功能已暂停，请联系客服 / Posting suspended, please contact support',
      code: 'POSTING_SUSPENDED',
    });
  }
  next();
};
