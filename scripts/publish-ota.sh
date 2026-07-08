#!/usr/bin/env bash
# Meyou 密友 — one-command OTA publish.
#
#   ./scripts/publish-ota.sh [channel]        # channel defaults to "production"
#
# Ships the current app-rn JS to all installed users on their next cold start.
# NO native rebuild, NO App Store / Play review. ~3–5 min end to end.
#
# Prereqs (one-off): wrangler logged in, the Worker deployed, and:
#   export OTA_ADMIN_TOKEN=<the same secret you set with `wrangler secret put`>
# Optional overrides:
#   RUNTIME_VERSION (default 1.0.0)  — MUST match the installed build's runtimeVersion
#   OTA_HOST        (default https://updates.meyou.uk)
#
# ⚠️  OTA can only change JavaScript. If you added/updated a NATIVE module or
#     bumped runtimeVersion, you need a new EAS build + store submit instead.
set -euo pipefail

CHANNEL="${1:-production}"
RUNTIME_VERSION="${RUNTIME_VERSION:-1.0.0}"
OTA_HOST="${OTA_HOST:-https://updates.meyou.uk}"
R2_BUCKET="${R2_BUCKET:-meyou-ota-bundles}"

if [[ -z "${OTA_ADMIN_TOKEN:-}" ]]; then
  echo "✗ OTA_ADMIN_TOKEN is not set. Run:  export OTA_ADMIN_TOKEN=<your worker secret>" >&2
  exit 1
fi

# Resolve repo root (this script lives in scripts/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/app-rn"

echo "▸ Exporting JS bundle (metro) for ios + android …"
rm -rf dist
npx expo export --platform ios --platform android --output-dir dist

echo "▸ Hashing, uploading to R2, registering manifests …"
node "$ROOT/scripts/ota/publish.mjs" \
  --dist "$ROOT/app-rn/dist" \
  --channel "$CHANNEL" \
  --runtime "$RUNTIME_VERSION" \
  --host "$OTA_HOST" \
  --bucket "$R2_BUCKET" \
  --token "$OTA_ADMIN_TOKEN"

echo "▸ Verify:  curl \"$OTA_HOST/admin/state?platform=ios&runtimeVersion=$RUNTIME_VERSION&token=\$OTA_ADMIN_TOKEN\""
