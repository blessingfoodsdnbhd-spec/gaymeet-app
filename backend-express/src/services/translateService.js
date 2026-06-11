/**
 * Chat auto-translate — thin wrapper over Google Cloud Translation API v2.
 *
 * Used to break the language barrier in the world lobby and country rooms
 * (🇲🇾 ↔ 🇨🇳 ↔ …). Translation is lazy: a message is only sent to Google the
 * first time a reader in a different language opens it, and the result is then
 * cached on the message document (see WorldChatMessage.translations), so repeat
 * reads never re-hit the API.
 *
 * Dormant until GOOGLE_TRANSLATE_API_KEY is set — `isConfigured()` is false and
 * callers return 503 / skip translation entirely.
 */
const axios = require('axios');
const env = require('../config/env');

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

// The app ships 4 UI languages; we only ever translate into one of these.
// Google accepts these ISO-639-1 codes directly ('zh' → Simplified Chinese).
const SUPPORTED = new Set(['en', 'zh', 'ko', 'ja']);

function isConfigured() {
  return !!env.GOOGLE_TRANSLATE_API_KEY;
}

// Collapse Google's detected code (e.g. 'zh-CN', 'en-US') to our base code so
// it compares equal to a SUPPORTED target.
function normalizeLang(code) {
  if (!code) return null;
  return String(code).toLowerCase().split('-')[0];
}

/**
 * Translate `text` into `target` (one of SUPPORTED).
 * @returns {Promise<{ translatedText: string, detectedSourceLanguage: string|null }>}
 * @throws when not configured or the API call fails — callers handle it.
 */
async function translate(text, target) {
  if (!isConfigured()) throw new Error('TRANSLATE_NOT_CONFIGURED');
  const { data } = await axios.post(
    ENDPOINT,
    { q: text, target, format: 'text' },
    { params: { key: env.GOOGLE_TRANSLATE_API_KEY }, timeout: 8000 },
  );
  const tr = data && data.data && data.data.translations && data.data.translations[0];
  if (!tr || typeof tr.translatedText !== 'string') throw new Error('TRANSLATE_EMPTY');
  return {
    translatedText: tr.translatedText,
    detectedSourceLanguage: normalizeLang(tr.detectedSourceLanguage),
  };
}

module.exports = { translate, isConfigured, normalizeLang, SUPPORTED };
