# Meetup Nearby - Project Guidelines

## Working Principles
- 先思考后行动。在编写代码之前先阅读现有文件。
- 输出要简洁，但推理要全面。
- 倾向于编辑而不是重写整个文件。
- 不要重新读取你已经读过的文件，除非该文件可能已更改。
- 在声称完成之前测试你的代码。
- 不要使用谄媚的开场白或冗余的结尾。
- 保持解决方案简洁直接。
- 用户指令始终优先于此文件。

## Project Structure
- `/app/` — Flutter mobile app (195 dart files, 32 feature modules)
- `/backend-express/` — Node.js + Express + MongoDB backend
- `/backend/` — Legacy NestJS (not used)

## Key Info
- Bundle ID: com.meetupnearby.app
- API: https://gaymeet-api.onrender.com
- MongoDB: m0free.lusat6n.mongodb.net (database: gaymeet)
- GitHub: blessingfoodsdnbhd-spec/gaymeet-app
- Test account: hafiz@example.com / password123

## Common Commands
- APK build: `cd app && flutter build apk --release`
- iOS build: `cd app && flutter build ios --no-codesign`
- Backend local: `cd backend-express && node server.js`
- Seed data: `cd backend-express && node src/seed.js`
- Local dev: `flutter run --dart-define=API_URL=http://localhost:3000`

## 32 Feature Modules
auth, business, calendar, call, chat, date_room, discover, dm, events, gifts, groups, health, home, location, maintenance, matches, moments, nearby, onboarding, places, premium, profile, questions, referral, safety, saw_you, secret_code, security, settings, stickers, stories, verification

## Backend Routes (37)
account, auth, blocks, boost, business, calendar, calls, date-rooms, direct-messages, energy, events, follows, gifts, groups, matches, moments, notifications, photos, places, plates, popular, private-photos, promotions, questions, referrals, safe-date, secret-codes, shouts, status, stickers, stories, subscriptions, swipes, two-factor, users, verification

## Status
- Flutter analyze: 0 errors
- Backend: deployed and connected to MongoDB
- iOS: builds successfully
- Android APK: builds but crashes on launch (Firebase issue being fixed)
- Apple Developer: registered
