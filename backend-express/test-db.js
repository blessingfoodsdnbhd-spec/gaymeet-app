#!/usr/bin/env node
/**
 * MongoDB connection test script
 * Usage:
 *   node test-db.js
 *   node test-db.js "mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/gaymeet"
 *
 * If no argument is given, reads MONGODB_URI from .env or environment.
 */

const path = require('path');

// Load .env if present
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {
  // dotenv not installed — rely on real env vars
}

const dns  = require('dns').promises;
const mongoose = require('mongoose');

const uri = process.argv[2] || process.env.MONGODB_URI;

// ── Helpers ────────────────────────────────────────────────────────────────────

function redact(u) {
  if (!u) return '(empty)';
  return u.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
}

function parseClusterHost(u) {
  // mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/db?...
  const m = u.match(/@([^/?]+)/);
  return m ? m[1] : null;
}

async function dnsCheck(host) {
  console.log(`\n🔍 DNS check for: ${host}`);
  try {
    const addresses = await dns.lookup(host);
    console.log(`   ✅ Resolves to: ${addresses.address}`);
    return true;
  } catch (e) {
    console.log(`   ❌ DNS lookup failed: ${e.code} — ${e.message}`);
  }

  // For SRV (mongodb+srv) the real record is _mongodb._tcp.<host>
  const srvHost = `_mongodb._tcp.${host}`;
  console.log(`\n🔍 SRV DNS check for: ${srvHost}`);
  try {
    const records = await dns.resolveSrv(srvHost);
    console.log(`   ✅ SRV records found: ${records.map(r => r.name).join(', ')}`);
    return true;
  } catch (e) {
    console.log(`   ❌ SRV lookup failed: ${e.code} — ${e.message}`);
    return false;
  }
}

function diagnose(uri) {
  console.log('\n📋 Diagnosis:');

  if (!uri) {
    console.log('   • MONGODB_URI is not set at all.');
    console.log('   • On Render: go to your service → Environment → add MONGODB_URI');
    return;
  }

  if (!uri.startsWith('mongodb+srv://') && !uri.startsWith('mongodb://')) {
    console.log('   • URI does not start with mongodb+srv:// or mongodb://');
    console.log('   • Example: mongodb+srv://user:pass@cluster0.abcde.mongodb.net/gaymeet?retryWrites=true&w=majority');
    return;
  }

  const hasCreds = uri.includes('@');
  if (!hasCreds) {
    console.log('   • No credentials found in URI (missing user:pass@)');
  }

  if (uri.includes('<') || uri.includes('>') || uri.includes('xxxxx')) {
    console.log('   • URI still contains placeholder text (<user>, <password>, xxxxx)');
    console.log('   • Replace with your actual Atlas username and password');
    return;
  }

  const host = parseClusterHost(uri);
  if (host) {
    const parts = host.split('.');
    if (parts.length < 3) {
      console.log(`   • Cluster host looks malformed: ${host}`);
    } else {
      const clusterId = parts[0].split('-').pop(); // cluster0 or cluster0-shard-00-00
      console.log(`   • Cluster host: ${host}`);
      console.log('   • To verify: log into MongoDB Atlas → your project → connect button');
      console.log('     The connection string shown there is the correct one to copy.');
    }
  }

  console.log('\n🛠  Common fixes:');
  console.log('   1. Copy the connection string fresh from Atlas (click Connect → Drivers)');
  console.log('   2. Make sure the cluster exists and is not paused (Atlas free tier pauses after 60 days of inactivity)');
  console.log('   3. Add your Render server IP (or 0.0.0.0/0) to Atlas Network Access → IP Allowlist');
  console.log('   4. Check that the database user exists and has read/write on the database');
  console.log('   5. URL-encode special chars in password: @ → %40, # → %23, $ → %24');
}

// ── Main ───────────────────────────────────────────────────────────────────────

(async () => {
  console.log('='.repeat(60));
  console.log('  GayMeet — MongoDB Connection Test');
  console.log('='.repeat(60));
  console.log(`\n📌 URI (redacted): ${redact(uri)}`);

  if (!uri || uri.includes('xxxxx') || uri.includes('<user>') || uri.includes('<password>')) {
    diagnose(uri);
    process.exit(1);
  }

  // DNS pre-check
  const host = parseClusterHost(uri);
  if (host) {
    const dnsOk = await dnsCheck(host);
    if (!dnsOk) {
      console.log('\n⚠️  DNS resolution failed — the cluster hostname cannot be found.');
      diagnose(uri);
      process.exit(1);
    }
  }

  // Actual connection attempt
  console.log('\n🔌 Attempting mongoose.connect()...');
  const timeout = setTimeout(() => {
    console.log('\n⏱  Connection timed out after 15 seconds.');
    diagnose(uri);
    process.exit(1);
  }, 15_000);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 12_000 });
    clearTimeout(timeout);
    console.log(`\n✅ Connected! Host: ${mongoose.connection.host}`);
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log('\n🎉 Your MONGODB_URI is correct. Copy this exact value to Render.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    clearTimeout(timeout);
    console.log(`\n❌ Connection failed: ${err.message}`);
    diagnose(uri);
    process.exit(1);
  }
})();
