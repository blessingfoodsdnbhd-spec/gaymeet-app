# Meyou OTA & 强制升级 — 老板日常手册

两件事,全部 **免费($0/月)**、**不依赖 EAS**:

1. **OTA 热更新** — 改一个 JS bug,5 分钟推到所有已安装用户,**不用过审、不用重新上架**。
2. **强制/温柔升级弹窗** — 打开网页拉高最低版本,老用户打开 App 就被挡住要求更新。

> ⚠️ **一句话前提**:OTA 只能改 **JavaScript**(界面、逻辑、文案、修 bug)。
> 只要动了**原生模块**(新加一个 `expo-*` / react-native 原生库)、改了图标/权限/
> `runtimeVersion`,就必须走老的 **EAS build + 上架**,OTA 推不动。

---

## 0. 首次准备(只做一次)

- **基础设施部署**:见 [`webpage/meyou-ota/README.md`](webpage/meyou-ota/README.md)(约 5 分钟点完 Cloudflare)。
- 部署完把那个 admin 密钥存好,然后在电脑上设一次环境变量:
  ```bash
  export OTA_ADMIN_TOKEN=<你在 wrangler secret put 时设的那个串>
  ```
  (想每次开终端自动带上,就把这行加到 `~/.zshrc`。)
- **第一个带 OTA 的正式包**:OTA 从「下一个原生构建」才开始生效——因为要把
  `expo-updates` 打进包里。所以先 `npx expo install expo-updates` 后照常
  EAS build 出一版 **vc130+** 上架。**这一版之后**,所有 JS 改动都能走 OTA。

---

## 1. 推一次 OTA(修 JS bug → 全员更新)

```bash
# 在仓库根目录
export OTA_ADMIN_TOKEN=<你的密钥>   # 若已写进 ~/.zshrc 可跳过
./scripts/publish-ota.sh            # 默认推到 production
```

脚本会自动:打 JS 包(metro)→ 算哈希 → 上传到 R2 → 注册 manifest。跑完看到:

```
  ✓ ios      rtv=1.0.0  channel=production  id=xxxx  (bundle uploaded, N assets)
  ✓ android  rtv=1.0.0  channel=production  id=yyyy  (bundle uploaded, N assets)
  ✅ OTA published — Users get it on their next cold start.
```

**用户什么时候拿到?** 下次**冷启动**(完全退出再打开)时,App 后台悄悄下载新
JS,**再下一次**冷启生效。一般几分钟到一天内自然铺开,不打扰正在用的人。

**灰度 / 测试轨**:先推到 staging(只有装了 staging 包的测试机会拿到):
```bash
./scripts/publish-ota.sh staging
```

**看现在线上是哪一版:**
```bash
curl "https://updates.meyou.uk/admin/state?platform=ios&runtimeVersion=1.0.0&token=$OTA_ADMIN_TOKEN"
```
返回 `current`(当前 id)+ `history`(最近 30 次发布)。

---

## 2. OTA 回滚(推错了 / 新版有 bug)

从上面 `history` 里挑一个想退回的 `id`,一条命令:

```bash
curl -X POST "https://updates.meyou.uk/admin/rollback" \
  -H "x-ota-admin-token: $OTA_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"channel":"production","platform":"ios","runtimeVersion":"1.0.0","id":"<老版本id>"}'
```

**iOS 和 Android 是分开的**,两个平台都要退就把 `platform` 改成 `android` 再跑一次。
退回后用户下次冷启就回到老 JS。

---

## 3. 强制 / 温柔升级弹窗

### 怎么用
打开管理页:**`https://meyou.uk/admin/version.html`**(部署方式见下)。填两个凭据:
- **API Base**:`https://gaymeet-api.onrender.com`(默认已填好)
- **Admin Token**:后端的 `ADMIN_TOKEN` 环境变量(Render → 环境变量里那个)

点 **载入 Load** 看当前值,改完点 **保存 Save**。App 端 1 分钟内(客户端缓存)拿到新
规则,下次冷启按规则弹窗。

### 三个版本号什么意思(每个平台各一套)

| 字段 | 作用 | 例子 |
|---|---|---|
| **minimum** | App 版本 **低于**它 → **强制弹窗**,不能关,只能「立即更新」跳商店 | 想逼 3.1.13 以下升级 → 填 `3.1.14` |
| **recommended** | 低于它(但 ≥ minimum)→ **温柔提示**,可以「稍后再说」 | 填 `3.1.16` |
| **latest** | 只在弹窗文案里展示「最新版本 x」,不影响拦截 | `3.1.16` |

> 逻辑:`当前版本 < minimum` → 强制;`< recommended` → 温柔;`≥ recommended` → 不弹。
> 默认都是 `0.0.0`,即**谁都不挡**——只有你主动拉高才会开始拦人。

### 典型操作
- **逼所有老用户升级到 3.1.16**:把 minimum 填 `3.1.16`,保存。3.1.16 以下全部强制。
- **只是提醒一下**:minimum 不动,recommended 填 `3.1.16`。老用户看到可关闭的提示。
- **紧急**(线上有严重 bug,必须升):minimum 拉到新版本号,老用户全被挡在更新页。

### 弹窗长什么样
粉色玻璃拟态、中英双语,跟 App 一致。「立即更新」按钮跳对应商店(iOS App Store /
Google Play,链接在管理页的 Store URL 里,可改)。强制模式关不掉、返回键也没用。

---

## 该用 OTA 还是重新上架?

| 你改了什么 | 用哪个 |
|---|---|
| 文案、颜色、布局、业务逻辑、修 JS bug | **OTA**(`./scripts/publish-ota.sh`) |
| 想逼老用户去商店更新 | **强制弹窗**(admin/version.html) |
| 新装了原生库 / 改图标 / 改权限 / 改 `runtimeVersion` | **EAS build + 上架**(老流程) |

---

## admin/version.html 怎么上线

它是个纯静态页,放在 `webpage/meyou-extract/admin/version.html`,跟着 `meyou.uk`
的 Cloudflare Pages 项目一起直传部署即可(和站点其他页面同一个发布流程)。上线后
访问 `https://meyou.uk/admin/version.html`。

> 页面不含任何密钥;Admin Token 只存在你自己浏览器的 localStorage 里。别把这个
> 网址随便发人。后端 `CLIENT_URL` 若不是 `*`,要把 `https://meyou.uk` 加进白名单,
> 否则浏览器跨域会被拦(报 Network error)。

---

## 速查

```bash
# 推 OTA(生产)
./scripts/publish-ota.sh

# 推 OTA(测试轨)
./scripts/publish-ota.sh staging

# 看线上版本 + 历史
curl "https://updates.meyou.uk/admin/state?platform=ios&runtimeVersion=1.0.0&token=$OTA_ADMIN_TOKEN"

# 回滚(iOS,记得 android 再来一次)
curl -X POST https://updates.meyou.uk/admin/rollback \
  -H "x-ota-admin-token: $OTA_ADMIN_TOKEN" -H "content-type: application/json" \
  -d '{"channel":"production","platform":"ios","runtimeVersion":"1.0.0","id":"<id>"}'

# 改最低版本 → 打开 https://meyou.uk/admin/version.html
```
