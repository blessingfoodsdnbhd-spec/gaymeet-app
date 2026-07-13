# Changelog / 更新日志

All notable changes to the Meyou app. / Meyou 应用的重要更新记录。

## [3.1.19] — build 133 (2026-07-14)

### English
- **6 brand-new alternate app icons.** Pick a look that fits you — Heartbeat, Sakura, Starry, Neon, Pixel, or Beary — each a fully distinct design, switchable from settings.
- **Fixed: no-photo profiles no longer show through in Discover.** The placeholder card for users without a photo is now fully opaque, so cards behind it no longer bleed through.
- **Admin report review revamped.** The report page now lets moderators view the reported content and act with four one-tap buttons: Allow, Delete content, Ban user, or Ban IP.

### 中文
- **6 个全新风格 App 图标可选。** 心跳 / 樱花 / 星空 / 霓虹 / 像素 / 熊哥 —— 每款都是完全不同的独立设计,可在设置里随时切换。
- **修复:Discover 无照片用户占位卡半透明穿透。** 没有照片用户的占位卡片现在完全不透明,后面的卡片不再透出来。
- **Admin 举报页改造。** 举报页现在可以查看被举报内容,并用四个一键按钮处理:放行 / 删除内容 / 封禁用户 / 封禁 IP。

## [3.1.18] — build 131 (2026-07-08)

### English
- **Unread notification badge on the "Me" tab.** A red badge (unread count, shown as `99+` when over 99) now appears on the "Me" tab icon so you can see new notifications without opening the page. It updates in real time and clears when you open the notification center.
- **"Liked" now sticks on a profile.** After you like someone, their profile keeps showing "Liked" — even after re-opening the profile or restarting the app — instead of reverting to "Like". (Builds on the 3.1.17 fix where liking no longer bounced you back to the list.)

### 中文
- **「我」tab 未读通知红点。** 底部「我」tab 图标右上角新增红色未读数徽标(超过 99 显示 `99+`),不用打开通知页就能看到有新通知。实时刷新,打开通知中心后自动消失。
- **资料页「已喜欢」状态现在会保留。** 点了「想认识」之后,重新打开该资料页或重启 App,按钮都会保持「已喜欢」,不再变回「想认识」。(接续 3.1.17 —— 点赞不再把你弹回列表。)

## [3.1.17] — build 130 (2026-07-08)

### English
- **Fixed: tapping "Like" on a profile no longer bounces you back to the list.** Liking someone from their profile now keeps the profile open and flips the button to "Liked" with a confirmation toast, instead of silently closing the profile — so you can see the like registered. A mutual match still triggers the full-screen match celebration.
- **Fixed: moment likes / comments / mentions now reach your notifications.** These interactions are now persisted as notification records and route correctly when tapped, so you actually get notified when someone likes or comments on your moment.

### 中文
- **修复:在资料页点「想认识」不再被弹回列表。** 从对方资料页点「想认识」后,资料页会保留,按钮变成「已喜欢」并弹出提示,而不是无声关闭页面 —— 你能确认操作已生效。双向配对仍会触发全屏配对弹窗。
- **修复:动态的点赞 / 评论 / @提及 现在会进通知中心。** 这些互动现已持久化为通知记录并可正确跳转,别人点赞或评论你的动态时你会收到通知。

## [3.1.16] — build 129 (2026-07-07)

### English
- **Fixed: email sign-up / sign-in could dump you back to the start screen.** New email accounts (and returning ones) could complete registration or password login yet land back on the "Create your account" / Welcome screen instead of entering the app. Two causes, both fixed: (1) the best-effort push-notification-token registration could return 401 during a boot-time race and wrongly log the session out; (2) the interest-picker onboarding step is now a reliable top-level screen, so a fresh sign-in always advances to it. Google / Apple sign-in were never affected.

### 中文
- **修复:邮箱注册 / 登录后被弹回起始页。** 新邮箱账号(以及老账号)完成注册或密码登录后,可能没有进入 App,而是弹回「创建账号 / 欢迎」页。两个原因均已修复:(1) 尽力而为的推送通知 token 注册在启动竞态下可能返回 401,被误判为会话过期而登出;(2) 兴趣选择这一 onboarding 步骤现改为可靠的顶层页面,新登录后必定进入该页。Google / Apple 登录一直不受影响。

## [3.1.15] — build 128 (2026-07-07)

### English
- **Email + password sign-in.** You can now register and log in with an email and password. Registration verifies your email with a one-time code first. Password reset (email → code → new password) is included.
- **Set a password for OTP-only accounts.** Existing verification-code users are offered a one-time prompt after login to set a password for faster sign-in next time. Code login remains available as a fallback.
- **Google / Apple sign-in unchanged.**
- **Admin: IP quarantine review.** Admins get a new in-app screen to review IPs flagged by the anti-spam system — see the involved accounts and hidden content, then ban or approve each with one tap.
- **Anti-spam IP cooldown (server).** Signups and vote creation are now rate-limited per IP, and IPs that exceed the daily limit are quarantined (their accounts + content hidden) pending admin review, with cascade auto-ban support.
- Plus the vc121–126 improvements: room editing (rename / recolor / kick / close), "find my location" GPS button in the map picker, and the 24-hour "don't show today" fix for announcements.

### 中文
- **邮箱 + 密码登录。** 现在可以用邮箱和密码注册、登录。注册前会先用一次性验证码验证邮箱。包含忘记密码流程(邮箱 → 验证码 → 新密码)。
- **老验证码用户设置密码。** 现有的验证码登录用户,登录后会收到一次性引导,可为下次快速登录设置密码。验证码登录仍作为备用方式保留。
- **Google / Apple 登录不变。**
- **管理员:IP 隔离审核。** 管理员新增应用内审核界面,查看被反垃圾系统标记的 IP —— 显示涉及的账号与被隐藏的内容,一键封禁或放行。
- **反垃圾 IP 冷却(服务端)。** 注册和创建投票现按 IP 限流;超过每日上限的 IP 会被隔离(其账号 + 内容隐藏),等待管理员审核,并支持级联自动封禁。
- 另含 vc121–126 改进:房间编辑(改名 / 改色 / 踢人 / 关闭)、地图选点的「找我位置」GPS 按钮、公告「今天不显示」改为 24 小时后重现的修复。
