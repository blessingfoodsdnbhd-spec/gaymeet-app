/**
 * Standardised response helpers used throughout routes.
 * Flutter ApiClient expects either { data: ... } or direct arrays.
 */
const ok = (res, data, status = 200) => res.status(status).json({ data });
const created = (res, data) => ok(res, data, 201);
const err = (res, message, status = 400) =>
  res.status(status).json({ error: message });

module.exports = { ok, created, err };
