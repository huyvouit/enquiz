/**
 * Database backup (launch checklist C2). Atlas M0 has no automatic backup,
 * so this copies every collection of MONGODB_URI, with its indexes, into one
 * gzip file of EJSON lines (types such as ObjectId and Date survive):
 *
 *   MONGODB_URI=$(gcloud secrets versions access latest --secret=mongodb-uri) \
 *     node scripts/backup-db.mjs                # -> backups/<db>-<time>.ndjson.gz
 *   node scripts/backup-db.mjs --out <dir>
 *
 * Read-only on the database. The file holds student data and password
 * hashes: keep it private (be/backups/ is gitignored). Restore with
 * restore-db.mjs.
 */
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';

const { EJSON } = mongoose.mongo.BSON;
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, a, i, all) => {
    if (a.startsWith('--')) pairs.push([a.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const uri = process.env.MONGODB_URI;
if (!uri || uri === 'memory') {
  console.error('✗ Set MONGODB_URI to the database to back up.');
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
const db = mongoose.connection.db;
const collections = (await db.listCollections({ type: 'collection' }).toArray())
  .map((c) => c.name)
  .filter((n) => !n.startsWith('system.'))
  .sort();
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const dir = path.resolve(args.out ?? 'backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${db.databaseName}-${stamp}.ndjson.gz`);
const counts = {};

async function* lines() {
  yield `${JSON.stringify({ meta: { db: db.databaseName, createdAt: new Date().toISOString(), collections, format: 1 } })}\n`;
  for (const name of collections) {
    const indexes = (await db.collection(name).indexes()).filter(
      (ix) => ix.name !== '_id_',
    );
    yield `${JSON.stringify({ collection: name, indexes })}\n`;
    counts[name] = 0;
    for await (const doc of db.collection(name).find()) {
      counts[name] += 1;
      yield `${JSON.stringify({ c: name, d: EJSON.serialize(doc, { relaxed: false }) })}\n`;
    }
  }
}

await pipeline(
  Readable.from(lines()),
  createGzip(),
  fs.createWriteStream(file),
);
await mongoose.disconnect();
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(
  `✓ ${total} documents from ${collections.length} collections → ${file}`,
);
for (const [name, n] of Object.entries(counts)) console.log(`  ${name}: ${n}`);
