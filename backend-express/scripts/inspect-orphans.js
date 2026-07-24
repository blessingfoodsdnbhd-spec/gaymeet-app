/**
 * READ-ONLY orphan scanner. No writes, ever.
 *
 * For every collection that references a User, counts rows whose referenced
 * user no longer exists (i.e. was deleted without a cascade). This is the
 * dry-run the boss asked for: it tells us exactly how much orphaned data the
 * account-delete gap has left behind, per collection, before anyone decides
 * what to clean up.
 *
 * Run:  node scripts/inspect-orphans.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// (ModelFile, [userRefFields], bucket). bucket: 'content' = user-visible / feed
// (orphans can ghost or crash the UI) · 'money' = payouts/wallet · 'audit' =
// moderation/records we probably KEEP for history.
const MAP = [
  // ── content / feed ────────────────────────────────────────────────────────
  ['VoteEvent', ['creatorId'], 'content'],
  ['VoteEntry', ['submitterId'], 'content'],
  ['Vote', ['voterId'], 'content'],
  ['VoteReadState', ['userId'], 'content'],
  ['VoteReport', ['reporterId'], 'content'],
  ['UserHighlight', ['userId'], 'content'],
  ['Story', ['user'], 'content'],
  ['Shout', ['user'], 'content'],
  ['WorldChatMessage', ['userId'], 'content'],
  ['DirectMessage', ['sender', 'recipient'], 'content'],
  ['Note', ['senderId', 'recipientId'], 'content'],
  ['ChatRoom', ['creatorId'], 'content'],
  ['RoomMembership', ['userId'], 'content'],
  ['GroupChat', ['creator'], 'content'],
  ['GroupMessage', ['sender'], 'content'],
  ['SafeDate', ['userId', 'user'], 'content'],
  ['Event', ['user'], 'content'],
  ['CalendarEvent', ['user', 'withUser'], 'content'],
  ['Place', ['user'], 'content'],
  ['PlaceEvent', ['user'], 'content'],
  ['Question', ['targetUser', 'senderUser'], 'content'],
  ['Moment', ['user'], 'content'],
  ['MomentComment', ['user'], 'content'],
  ['ProfileView', ['viewerId', 'viewedId'], 'content'],
  ['Notification', ['userId'], 'content'],
  ['Message', ['senderId'], 'content'],
  ['Swipe', ['fromUser', 'toUser'], 'content'],
  ['Follow', ['follower', 'following'], 'content'],
  ['PhotoRequest', ['owner', 'requester'], 'content'],
  ['PhotoLibrary', ['user'], 'content'],
  ['TopicPersona', ['userId'], 'content'],
  ['HiddenPhotoRequest', ['fromUserId', 'toUserId'], 'content'],
  ['PlateMessage', ['sender'], 'content'],
  // ── money / payouts ───────────────────────────────────────────────────────
  ['Referral', ['referrer', 'referred'], 'money'],
  ['Commission', ['referrer', 'referred'], 'money'],
  ['Wallet', ['user'], 'money'],
  ['Withdrawal', ['user'], 'money'],
  ['Payment', ['user'], 'money'],
  ['GiftTransaction', ['sender', 'receiver'], 'money'],
  ['PremiumGift', ['gifter', 'recipient'], 'money'],
  ['Energy', ['sender', 'receiver'], 'money'],
  // ── moderation / audit (probably KEEP) ────────────────────────────────────
  ['UserReport', ['reporterId', 'reportedUserId'], 'audit'],
  ['ContentReport', ['reporterId'], 'audit'],
  ['FlaggedImage', ['user'], 'audit'],
  ['AdminAction', ['targetUser'], 'audit'],
  ['Verification', ['user'], 'audit'],
  ['InviteCode', ['userId'], 'audit'],
  ['InviteUsage', ['inviterId', 'inviteeId'], 'audit'],
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const modelsDir = path.join(__dirname, '..', 'src', 'models');
  const users = mongoose.connection.db.collection('users');
  const userIds = new Set((await users.distinct('_id')).map((id) => id.toString()));
  console.log(`DB: ${mongoose.connection.name} · users alive: ${userIds.size}\n`);

  const rows = [];
  for (const [modelName, fields, bucket] of MAP) {
    if (!fs.existsSync(path.join(modelsDir, `${modelName}.js`))) { rows.push([bucket, modelName, '(no model file)', 0, 0]); continue; }
    let Model;
    try { Model = require(path.join(modelsDir, modelName)); } catch (e) { rows.push([bucket, modelName, `require err: ${e.message}`, 0, 0]); continue; }
    for (const field of fields) {
      let orphanDocs = 0, orphanRefs = 0;
      try {
        const distinct = await Model.distinct(field);
        const missing = distinct.filter((v) => v && mongoose.isValidObjectId(String(v)) && !userIds.has(String(v)));
        orphanRefs = missing.length;
        if (missing.length) orphanDocs = await Model.countDocuments({ [field]: { $in: missing } });
      } catch (e) { rows.push([bucket, modelName, `${field} (err: ${e.message})`, 0, 0]); continue; }
      if (orphanDocs) rows.push([bucket, modelName, field, orphanDocs, orphanRefs]);
    }
  }

  const order = { content: 0, money: 1, audit: 2 };
  rows.sort((a, b) => order[a[0]] - order[b[0]] || b[3] - a[3]);
  let cur = null, totalDocs = 0;
  for (const [bucket, model, field, docs, refs] of rows) {
    if (bucket !== cur) { cur = bucket; console.log(`\n── ${bucket.toUpperCase()} ──`); }
    console.log(`  ${String(docs).padStart(6)} orphan rows  ${model}.${field}  (${refs} deleted user(s))`);
    totalDocs += docs;
  }
  if (!rows.length) console.log('No orphans found in any scanned collection. 🎉');
  else console.log(`\nTOTAL orphan rows across scanned collections: ${totalDocs}`);
  await mongoose.disconnect();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
