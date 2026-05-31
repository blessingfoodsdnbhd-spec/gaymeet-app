# Android IAP / Premium 上線 Runbook — Meyou 密友

> **狀態:代碼層已完成,缺的是運營側配置。**
>
> 本 runbook 把 dashboard 點擊步驟 + Render env 配置 + 驗證 curl 整理成可勾選的 checklist。順序很重要 — 上一步沒做完下一步會卡。
>
> 預計總耗時:**~2 小時**(不含等 Render redeploy + EAS build)。

---

## 0. 前置事實 / Constants

| 項目 | 值 |
|---|---|
| Package name | `com.meetupnearby.app` |
| 訂閱 Product ID | `com.meetupnearby.app.premium` |
| Base plan IDs | `monthly`、`annual` |
| 定價(本地) | RM39.90/月、RM399.90/年 |
| Backend URL | `https://gaymeet-api.onrender.com` |
| RTDN webhook | `https://gaymeet-api.onrender.com/api/subscriptions/google-webhook` |
| 驗證 endpoint | `https://gaymeet-api.onrender.com/api/subscriptions/verify-google-purchase` |
| Diag endpoint | `GET /api/subscriptions/google-status?ping=1`(需要 `X-Admin-Token` header) |

代碼層已實作的:
- `app-rn/src/utils/iap.ts` — `purchaseAndroid` / `restoreAndroid`
- `app-rn/src/api/subscription.ts` — `verifyGooglePurchase` + Android 常數
- `backend-express/src/routes/subscriptions-google.js` — 驗證 + RTDN webhook + 新增的 google-status 端點
- `backend-express/src/utils/googlePlay.js` — Play API 客戶端 + `describeStatus` helper

---

## 1. Play Console — 建立訂閱商品

> 預計 20 分鐘。

1. 登入 https://play.google.com/console → 選 Meyou 應用
2. 左側 **Monetize → Products → Subscriptions** → **Create subscription**
3. Product ID:**`com.meetupnearby.app.premium`**(必須完全一致 — 改不了)
4. Name:`Meyou Premium`
5. Description:`解鎖直接私信、查看誰喜歡你、更強曝光、已讀回執、無限滑動。`
6. 點 **Save** → 進入訂閱詳情頁
7. **Add base plan** 兩次:
   - Base plan ID:`monthly`
     - Billing period:`Monthly` / `1 month`
     - Auto-renewing:**勾選**
     - 點 **Set prices** → Malaysia (MYR) `39.90` → **Update**
     - 點 **Activate**
   - Base plan ID:`annual`
     - Billing period:`Yearly` / `1 year`
     - Auto-renewing:**勾選**
     - 價格:Malaysia (MYR) `399.90`
     - 點 **Activate**
8. (可選)幫 annual 加一個 "First-year discount" offer — 暫時不做也行,代碼不依賴

**驗證:** 訂閱詳情頁應顯示 **2 active base plans**(monthly + annual)。

---

## 2. GCP — 建 Service Account

> 預計 15 分鐘。

1. 在 https://console.cloud.google.com 確認登入帳號和 Play Console 同一個 organization / 同一個帳戶
2. 看 Play Console 左側 **Setup → API access** — 應顯示已 link 的 GCP 專案。沒 link 的話按 **Link Google Cloud project** 跟提示走
3. 記下這個 GCP 專案 ID(下面叫 `<PROJECT_ID>`)
4. 在 GCP Console 切到 `<PROJECT_ID>` → **IAM & Admin → Service Accounts** → **Create service account**
5. Name:`meyou-iap-server`,描述:`Backend Play API + RTDN access`
6. **Skip** "Grant this service account access to project"(我們不在 GCP 端授權,在 Play Console 端授權)→ **Done**
7. 找到剛建好的 service account,點 **Keys** tab → **Add key → Create new key → JSON** → 下載 JSON
8. 安全保存這份 JSON,**不要 commit 到 git**

**驗證:** 你應該手上有一個 `.json` 文件,內含 `client_email`、`private_key`、`project_id` 三個欄位。

---

## 3. Play Console — 邀請 Service Account 並授權

> 預計 5 分鐘。

1. 回 Play Console → **Setup → API access**
2. 找到剛建的 service account(顯示為 `meyou-iap-server@<PROJECT_ID>.iam.gserviceaccount.com`)
3. 點 **Grant access**
4. **Permissions** → 至少勾:
   - **View financial data, orders, and cancellation survey responses**
   - **Manage orders and subscriptions**
5. **App permissions** → 勾上 Meyou 應用
6. 點 **Invite user** → **Save changes**

**驗證:** Service account 應出現在 **Users and permissions** 列表中,狀態 "Active",授權應用包含 Meyou。

⚠️ 新建的 service account 授權後**需要等 24 小時**才能調 androidpublisher API(Google 的傳播延遲)。可以先做後面步驟,但 §6 的 `?ping=1` 測試在 24h 前可能會回 `tokenTest: "failed"` + 403 from Google。

---

## 4. Render — 配置 Backend Env

> 預計 5 分鐘 + Render redeploy 5–8 分鐘。

把 §2 下載的 JSON 轉 base64(避免 Render UI 處理多行字串):

```bash
# 在你的 mac 上:
base64 -i ~/Downloads/meyou-iap-server-XXXX.json | tr -d '\n' | pbcopy
# base64 字串已複製到剪貼板
```

到 Render → gaymeet-api service → **Environment** → 新增:

| Key | Value | 備註 |
|---|---|---|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | (貼上 §2 的 base64) | 代碼會 detect base64 還是 raw JSON |
| `ADMIN_TOKEN` | (任意 32+ 字符隨機字串,例如 `openssl rand -hex 32`) | 用於 google-status 診斷端點 |
| `GOOGLE_RTDN_VERIFY_AUDIENCE` | `https://gaymeet-api.onrender.com/api/subscriptions/google-webhook` | **§5 之後**再加,先別填 |

點 **Save changes** → Render 自動 redeploy。等 status 變回 Live。

**驗證(redeploy 完成後):**

```bash
# 用 ADMIN_TOKEN 換成你剛設的值
ADMIN_TOKEN="<your token>"

curl -sS -H "X-Admin-Token: $ADMIN_TOKEN" \
  https://gaymeet-api.onrender.com/api/subscriptions/google-status | jq
```

期望:
```json
{
  "data": {
    "configured": true,
    "source": "env-json",
    "clientEmail": "meyou-iap-server@<PROJECT_ID>.iam.gserviceaccount.com",
    "projectId": "<PROJECT_ID>",
    "tokenTest": null
  }
}
```

加 `?ping=1` 會多做一次 access-token 換取測試:

```bash
curl -sS -H "X-Admin-Token: $ADMIN_TOKEN" \
  "https://gaymeet-api.onrender.com/api/subscriptions/google-status?ping=1" | jq
```

期望 `tokenTest: "ok"`(沒授權 / 24h 還沒到的話會看到 `"failed"` + `tokenError`)。

---

## 5. GCP Pub/Sub — RTDN Push Subscription

> 預計 15 分鐘。

RTDN(Real-Time Developer Notifications)讓 Play 在訂閱狀態變化時 push 給我們,backend 才能處理續訂、退款、取消。

1. GCP Console → `<PROJECT_ID>` → **Pub/Sub → Topics** → **Create topic**
2. Topic ID:`play-rtdn-meyou`
3. 其他預設 → **Create**
4. 進入 topic 詳情 → **Subscriptions** tab → **Create subscription**
5. Subscription ID:`play-rtdn-meyou-push`
6. **Delivery type:** Push
7. **Endpoint URL:** `https://gaymeet-api.onrender.com/api/subscriptions/google-webhook`
8. **Enable authentication:** 勾上
9. **Service account:** 選 `meyou-iap-server@<PROJECT_ID>.iam.gserviceaccount.com`(§2 那個)
10. **Audience:** `https://gaymeet-api.onrender.com/api/subscriptions/google-webhook`(和 endpoint URL 一致)
11. Acknowledgement deadline:**60 seconds**
12. Retention duration:預設 7 days 即可
13. **Create**

**回 Play Console:**

14. **Monetize → Monetization setup** → **Real-time developer notifications**
15. **Topic name:** `projects/<PROJECT_ID>/topics/play-rtdn-meyou`
16. **Send test notification** → 點下去

**驗證(在 Render 看 logs):**

應該看到一條:
```
[iap-google-webhook] test notification received, ack
```

如果看到 `OIDC verify failed` — 表示 §4 的 `GOOGLE_RTDN_VERIFY_AUDIENCE` 已設但和 Pub/Sub audience 不一致。檢查兩邊 URL 完全相同。

如果 webhook 完全沒收到 — Pub/Sub 的 service account 沒有 `roles/run.invoker` 權限。一般 Render Web Service 不需要這個,但如果你看到 401/403 — 那是 OIDC 沒對齊。

**§4 的 `GOOGLE_RTDN_VERIFY_AUDIENCE` 此時可以加進去了**(再 redeploy 一次),加完後重 send test notification 應該還是 ack ok。

---

## 6. EAS — 出 Production AAB 並提交 Play Console

> 預計 20 分鐘 build + 5 分鐘 submit。**注意:會 burn 一個 build。**

```bash
cd /Users/bot8008/gay/.claude/worktrees/zen-poincare-f2ff20/app-rn

# 確認 main 同步:
git fetch origin && git status

# Production build(AAB,非 APK):
npx eas build --profile production --platform android --non-interactive
```

⚠️ 這次的 production build 會用 `appVersionSource: local` 從 `app.json` 讀 `android.versionCode`。當前是 `4`(歷史所有 Android build 都是 preview profile,production 沒上傳過 Play,所以 4 應該還是乾淨的)。如果 Play 上傳被拒 `version code already exists`,bump +1 後 commit 再重 build。

Build 完成後 verify:
```bash
npx eas build:list --platform android --limit 1 --json \
  | jq '.[0] | {status, buildProfile, appBuildVersion, artifacts}'
```

期望 `buildProfile: "production"`,artifacts 是 `.aab`。

**Submit 到 Play Console internal track:**

需要 `play-service-account.json`(`eas.json` 配置的)— **這個 JSON 是上傳用,和 §2 的訂閱驗證 service account 是兩回事**(雖然可以是同一個帳號,但建議分開)。如果之前沒設過,需要先做:
- Play Console → API access → 新建一個 `meyou-eas-upload` service account
- 授權 "Release manager"
- 下載 JSON 到 `app-rn/play-service-account.json`
- 加進 `.gitignore`(應該已經在)

```bash
npx eas submit --profile production --platform android --latest --non-interactive
```

這會把 AAB 推到 Play Console **internal testing** track(`eas.json` 已配)。

**驗證:**
```bash
npx eas submit:list --platform android --limit 1 --json \
  | jq '.[0] | {status, appVersion, appBuildVersion}'
```
期望 `status: "FINISHED"`。

Play Console → **Testing → Internal testing** → **Releases** 應該看到剛上傳的 AAB,狀態 "Available to testers"。

---

## 7. 真機測試 — License Tester

> 預計 30 分鐘。IAP 在 sideloaded APK 上**不會**運作 — 必須從 Play 安裝測試版。

1. Play Console → **Setup → License testing** → **Add testers** → 填你的 Gmail
2. License response:**RESPOND_NORMALLY**
3. **Internal testing** → **Testers** tab → 把同樣的 Gmail 加進測試名單(可以建 Google Group 或直接列 email)
4. 同一頁複製 **opt-in URL**,在測試手機的瀏覽器打開,點 **Become a tester**
5. 從 Play Store search "Meyou" 或從 opt-in URL 的 **Download on Google Play** 連結安裝
6. 開 App → 登入測試帳號(`hafiz@example.com` / `password123`)→ 進 PremiumScreen → 選 monthly → 點訂閱
7. Play 結帳 sheet 應彈出,顯示 RM39.90 / 月。完成購買(license tester 不會真扣款)
8. 應該看到 "Premium 已啟用" Alert,User.isPremium 應為 true

**驗證(server side):**

Backend logs 應看到:
```
POST /api/subscriptions/verify-google-purchase 200
```

直接 query MongoDB 確認:
```bash
# 從 Render shell 或本地 mongo 連線
# (用測試帳號的 user._id)
db.users.findOne({ email: "hafiz@example.com" }, { isPremium: 1, premiumExpiresAt: 1, googleOriginalPurchaseToken: 1 })
```

期望:`isPremium: true`,`premiumExpiresAt` 是約 1 個月後,`googleOriginalPurchaseToken` 非空。

**測試 Restore:**

8. App → 殺進程重開 → 進 PremiumScreen → 點 "恢復購買 / Restore"
9. 應該看到 "已恢復" Alert,User 狀態保持 Premium

**測試 RTDN:**

10. 在 Play Store → 訂閱管理 → 取消測試訂閱
11. 數秒內 backend logs 應看到:
    ```
    [iap-google-webhook] SUBSCRIPTION_CANCELED tok= xxxxxxx
    ```
12. MongoDB 中該 user 的 `isPremium` 應變 false(或 `premiumExpiresAt` 推到當前時間)

---

## 8. 結束 Checklist

完成以下全部勾選 = Android Premium 上線完成:

- [ ] §1 Play Console 訂閱商品建立,2 個 base plans active
- [ ] §2 GCP service account JSON 已下載
- [ ] §3 Play Console 已邀請 + 授權該 service account
- [ ] §4 Render env `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` + `ADMIN_TOKEN` 已配,curl `google-status` 回 `configured: true`
- [ ] §4 24h 過後 `?ping=1` 回 `tokenTest: "ok"`
- [ ] §5 Pub/Sub topic + push subscription 建立,Play Console test notification 在 backend logs 看到 ack
- [ ] §5 `GOOGLE_RTDN_VERIFY_AUDIENCE` 也已配,test notification 仍然 ack ok
- [ ] §6 EAS production AAB build 成功,submit 到 Play internal track
- [ ] §7 License tester 真機測試 purchase / restore / cancel 全通
- [ ] (Apple parity)Play Console 商品 listing 文案:照搬 `docs/app-store-listing.md` 簡中段落,送 Play 審核

之後做 closed → open testing → production rollout 都是 Play Console 內部點擊,不用碰代碼。

---

## 9. 故障排查 / Troubleshooting

| 症狀 | 可能原因 | 修法 |
|---|---|---|
| `google-status` 回 503 `ADMIN_TOKEN env not set` | Render 沒設 `ADMIN_TOKEN` | §4 加 env |
| `google-status` 回 401 `invalid X-Admin-Token` | curl header 沒帶或值錯 | 重新對 Render 的值 |
| `google-status` 回 `configured: false` | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` 沒設或格式錯 | §4,確認 base64 沒被 newline 切斷 |
| `?ping=1` 回 `tokenTest: "failed"` + `403` | Service account 沒授權 / 24h 未到 | §3,等 24h |
| 客戶端 `iapError.skuMissing` | Play Console product / base plan ID 不對 | §1,確認 product ID = `com.meetupnearby.app.premium`,base plan IDs = `monthly`、`annual` |
| 客戶端購買成功但 backend 回 503 `Google Play verification not configured` | Backend env 沒到位但客戶端先打了 | §4 |
| 購買後 30 秒回 `Subscription not active (SUBSCRIPTION_STATE_PENDING)` | 測試環境延遲 / 真實購買 PSP 還沒 settle | 等幾秒重試 |
| RTDN test notification 在 backend 完全沒 log | Pub/Sub 沒對到 endpoint URL | §5,檢查 push endpoint 完全等於 `https://gaymeet-api.onrender.com/api/subscriptions/google-webhook` |
| RTDN webhook 回 401 OIDC | `GOOGLE_RTDN_VERIFY_AUDIENCE` 和 Pub/Sub 的 audience 不一致 | 兩邊 URL 必須完全相同 |
| App 從 Play 裝完但購買 sheet 沒彈 | License tester 沒設好 / 不是同個 Gmail | §7 step 1–4 |
| AAB submit 失敗 `versionCode X already exists` | `app.json` 的 `android.versionCode` 已上傳過 | bump versionCode +1 後重 build |

---

## 10. 相關代碼指引

| 文件 | 作用 |
|---|---|
| `app-rn/src/api/subscription.ts` | SKU 常數、Android 訂閱 ID、verify API 函式 |
| `app-rn/src/utils/iap.ts` | `purchaseAndroid` / `restoreAndroid`,offerToken 查找 |
| `app-rn/src/screens/premium/PremiumScreen.tsx` | UI(平台無關),Restore Purchases 按鈕 |
| `backend-express/src/utils/googlePlay.js` | Play API 客戶端 + `describeStatus` |
| `backend-express/src/routes/subscriptions-google.js` | verify、RTDN webhook、google-status 診斷 |
| `backend-express/src/models/User.js` | `googleOriginalPurchaseToken` 欄位 |
| `backend-express/src/utils/premium.js` | `isPremiumActive` 統一判斷 |

Premium 解鎖路徑(代碼層完全一致 iOS / Android):
- `req.user.isPremium === true` && `premiumExpiresAt > now`(via `isPremiumActive`)
- 後端 gate:`boost.js`、`who-liked-you.js`、`direct-intro`、`read-receipts`、`conversations.js`(edit/delete 訊息)
- 客戶端 gate:`(user as any).isPremium === true`

---

## Crash Reporting (Sentry) — HIGH-B

Sentry is wired on both backend and client but **disabled by default** and
dependency-soft, so nothing fires until explicitly enabled (no build/deploy
impact until then).

### Backend (`backend-express`)
1. `cd backend-express && npm i @sentry/node`
2. Render env: `SENTRY_DSN=<your-dsn>` (requires `NODE_ENV=production`, already set)
3. Redeploy. Look for `[sentry] backend crash reporting initialized` in logs.

Code: `src/lib/sentry.js` (`initSentry()` called in `src/app.js`;
`captureException(err)` invoked in the global error handler).

### Client (`app-rn`) — requires a new EAS build (native module)
1. `cd app-rn && npx expo install @sentry/react-native`
2. `app.json`: add `expo.extra.sentryDsn = "<your-dsn>"` and the
   `@sentry/react-native/expo` plugin to `expo.plugins`.
3. Rebuild via EAS.

Code: `src/lib/sentry.ts` (`initSentry()` called at `App.tsx` module load;
`ErrorBoundary` also forwards caught render errors).

### Env summary
| Var | Where | Required to enable |
|-----|-------|--------------------|
| `SENTRY_DSN` | Render (backend) | yes |
| `expo.extra.sentryDsn` | app.json (client) | yes |

Both stay no-ops (and never throw) if the package is missing or the DSN unset.
