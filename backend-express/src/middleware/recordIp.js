/**
 * Attaches the real client IP to `req.clientIp`.
 * Behind Cloudflare + Render, `req.ip` is the proxy; the true client IP is in
 * the `cf-connecting-ip` header (Cloudflare) or the first `x-forwarded-for` hop.
 * Mounted app-wide (before routes) so every handler can read `req.clientIp`.
 */
module.exports = function recordIp(req, _res, next) {
  req.clientIp =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    null;
  next();
};
