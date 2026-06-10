// Lightweight, NON-BLOCKING NSFW heuristic (item 10). Real nudity classification
// needs an ML model; for v1 we use the classic skin-tone-ratio heuristic to
// FLAG suspicious images for human admin review (never auto-reject). It is noisy
// by nature, so the threshold is deliberately conservative.
let sharp = null;
try {
  sharp = require('sharp');
} catch (_) {
  sharp = null; // sharp unavailable → moderation no-ops
}

// Standard RGB skin-tone test (Kovac et al.).
function isSkin(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return (
    r > 95 && g > 40 && b > 20 &&
    mx - mn > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  );
}

/**
 * @returns {Promise<number|null>} fraction of skin-tone pixels (0..1), or null
 * if sharp is unavailable / the image can't be decoded. Never throws.
 */
async function skinRatio(buffer) {
  if (!sharp || !buffer) return null;
  try {
    const W = 64;
    const { data, info } = await sharp(buffer)
      .resize(W, W, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ch = info.channels || 3;
    let skin = 0;
    let total = 0;
    for (let i = 0; i + ch - 1 < data.length; i += ch) {
      total++;
      if (isSkin(data[i], data[i + 1], data[i + 2])) skin++;
    }
    return total ? skin / total : null;
  } catch (_) {
    return null;
  }
}

const NSFW_THRESHOLD = 0.55;

/** @returns {Promise<{flagged:boolean, score:number|null}>} */
async function checkImage(buffer) {
  const score = await skinRatio(buffer);
  if (score == null) return { flagged: false, score: null };
  return { flagged: score >= NSFW_THRESHOLD, score: +score.toFixed(3) };
}

module.exports = { skinRatio, checkImage, NSFW_THRESHOLD };
