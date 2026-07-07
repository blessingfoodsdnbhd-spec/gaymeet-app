# Changelog / 更新日志

All notable changes to the Meyou app. / Meyou 应用的重要更新记录。

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
