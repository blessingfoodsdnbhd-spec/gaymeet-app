/**
 * Restore Nearby visibility for the 5 demo PEER accounts so the Apple reviewer
 * (isDemo=true) can see them in the Nearby grid and exercise long-press →
 * Block/Report. Safe: real users never see isDemo accounts — the live backend
 * filters every discovery query with demoVisibility(req.user). The stealthMode/
 * hideFromNearby flags were a STOPGAP from remediate-demo-isolation.js for an
 * older backend that lacked isDemo filters.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const PEERS = [
  'demo-jordan@meyou.uk',
  'demo-sam@meyou.uk',
  'demo-kai@meyou.uk',
  'demo-noah@meyou.uk',
  'demo-rio@meyou.uk',
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const U = mongoose.connection.collection('users');

  const before = await U.find({ email: { $in: PEERS } },
    { projection: { email:1, nearbyEnabled:1, 'preferences.hideFromNearby':1, 'preferences.stealthMode':1, isDemo:1 } }).toArray();
  console.log('BEFORE:'); before.forEach(d => console.log(' ', d.email, 'isDemo=',d.isDemo,'nearbyEnabled=',d.nearbyEnabled,'hide=',d.preferences?.hideFromNearby,'stealth=',d.preferences?.stealthMode));

  const r = await U.updateMany(
    { email: { $in: PEERS } },
    { $set: {
        isDemo: true,
        nearbyEnabled: true,
        'preferences.hideFromNearby': false,
        'preferences.stealthMode': false,
        lastActiveAt: new Date(),
      } }
  );
  console.log('\nmatched=%d modified=%d', r.matchedCount, r.modifiedCount);

  const after = await U.find({ email: { $in: PEERS } },
    { projection: { email:1, nearbyEnabled:1, 'preferences.hideFromNearby':1, 'preferences.stealthMode':1, isDemo:1 } }).toArray();
  console.log('\nAFTER:'); after.forEach(d => console.log(' ', d.email, 'isDemo=',d.isDemo,'nearbyEnabled=',d.nearbyEnabled,'hide=',d.preferences?.hideFromNearby,'stealth=',d.preferences?.stealthMode));

  // Sanity: no NON-demo account was touched.
  const leaked = await U.countDocuments({ email: { $in: PEERS }, isDemo: { $ne: true } });
  console.log('\nnon-demo accounts touched (must be 0):', leaked);

  await mongoose.disconnect();
})();
