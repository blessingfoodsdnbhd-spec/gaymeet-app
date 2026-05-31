/**
 * Email abstraction.
 *
 * Single entry point — `sendEmail(to, subject, body)` — so OTP / password-reset
 * routes never talk to a provider directly. Swapping in a real provider later
 * is a one-place change here, not a hunt across routes.
 *
 * Current implementations:
 *   - 'console' : logs the email to the server console (dev default).
 *   - 'noop'    : does nothing (silently drops) — safe production fallback when
 *                 no provider is configured, so we never crash a login flow.
 *
 * Selection:
 *   - MAIL_PROVIDER env var, if set, wins ('console' | 'noop').
 *   - else NODE_ENV !== 'production' → 'console'.
 *   - else 'noop' + a one-time warning (so prod doesn't silently log codes,
 *     and so it's obvious a real provider still needs wiring).
 *
 * TODO(provider): wire a real transactional email provider before public
 * launch. Recommended: Resend (https://resend.com) — simplest setup.
 *   1. npm i resend
 *   2. Set env: MAIL_PROVIDER=resend, RESEND_API_KEY=..., MAIL_FROM="Meyou <noreply@yourdomain>"
 *   3. Add a `case 'resend'` below that calls the Resend SDK.
 * Other options: SendGrid (SENDGRID_API_KEY), AWS SES, or generic SMTP
 * (nodemailer with SMTP_HOST/PORT/USER/PASS).
 */

let warnedNoProvider = false;

function resolveProvider() {
  const explicit = (process.env.MAIL_PROVIDER || '').trim().toLowerCase();
  if (explicit) return explicit;
  if (process.env.NODE_ENV !== 'production') return 'console';
  return 'noop';
}

/**
 * Send a transactional email. Best-effort: never throws — a failed send must
 * not break the calling auth flow. Returns { ok, provider }.
 * @param {string} to       recipient email
 * @param {string} subject  subject line
 * @param {string} body     plain-text body
 */
async function sendEmail(to, subject, body) {
  const provider = resolveProvider();

  try {
    switch (provider) {
      case 'console':
        console.log(
          `\n──[email:console]────────────────────────────\n` +
            `To:      ${to}\n` +
            `Subject: ${subject}\n` +
            `${body}\n` +
            `─────────────────────────────────────────────\n`
        );
        return { ok: true, provider };

      // case 'resend':  // TODO(provider) — see header.
      //   const { Resend } = require('resend');
      //   await new Resend(process.env.RESEND_API_KEY).emails.send({
      //     from: process.env.MAIL_FROM, to, subject, text: body,
      //   });
      //   return { ok: true, provider };

      case 'noop':
      default:
        if (provider === 'noop' && !warnedNoProvider) {
          warnedNoProvider = true;
          console.warn(
            '[email] No mail provider configured in production — emails are ' +
              'being DROPPED. Set MAIL_PROVIDER + provider env vars (see ' +
              'utils/email.js). OTP / password-reset delivery is disabled.'
          );
        }
        return { ok: false, provider: 'noop' };
    }
  } catch (e) {
    console.error(`[email] send failed via ${provider}:`, e.message);
    return { ok: false, provider, error: e.message };
  }
}

module.exports = { sendEmail, resolveProvider };
