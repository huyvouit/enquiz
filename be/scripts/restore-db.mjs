/**
 * Restores a backup made by backup-db.mjs into MONGODB_URI.
 *
 *   node scripts/restore-db.mjs <file.ndjson.gz>
 *       Only into a database whose collections in the backup are all empty
 *       (a new cluster, a test database).
 *   node scripts/restore-db.mjs <file.ndjson.gz> --replace <db name>
 *       Drops those collections first. The db name must be typed again, so
 *       production is never replaced by accident.
 *
 * Indexes come from the backup; the app also creates its own at start-up.
 */
import mongoose from 'mongoose';
import fs from 'node:fs';
import readline from 'node:readline';
import { createGunzip } from 'node:zlib';

const { EJSON } = mongoose.mongo.BSON;
const [file, flag, confirmDb] = process.argv.slice(2);
const uri = process.env.MONGODB_URI;
if (!file || !fs.existsSync(file)) {
  console.error(
    'Usage: node scripts/restore-db.mjs <backup.ndjson.gz> [--replace <db name>]',
  );
  process.exit(1);
}
if (!uri || uri === 'memory') {
  console.error('✗ Set MONGODB_URI to the target database.');
  process.exit(1);
}

const lines = () =>
  readline.createInterface({
    input: fs.createReadStream(file).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
const db = mongoose.connection.db;
let meta;
for await (const line of lines()) {
  meta = JSON.parse(line).meta;
  break;
}
if (!meta) throw new Error('Not a backup file');

const replace = flag === '--replace';
if (replace && confirmDb !== db.databaseName) {
  console.error(
    `✗ --replace needs the target db name: --replace ${db.databaseName}`,
  );
  await mongoose.disconnect();
  process.exit(1);
}
if (!replace) {
  for (const name of meta.collections) {
    if ((await db.collection(name).estimatedDocumentCount()) > 0) {
      console.error(
        `✗ "${name}" is not empty in ${db.databaseName}. Use --replace ${db.databaseName} to drop it first.`,
      );
      await mongoose.disconnect();
      process.exit(1);
    }
  }
} else {
  for (const name of meta.collections) {
    await db
      .collection(name)
      .drop()
      .catch(() => {});
  }
}

const counts = {};
let batch = [];
let current = null;
const flush = async () => {
  if (batch.length)
    await db.collection(current).insertMany(batch, { ordered: false });
  batch = [];
};
let first = true;
for await (const line of lines()) {
  if (first) {
    first = false;
    continue;
  }
  const row = JSON.parse(line);
  if (row.collection) {
    await flush();
    current = row.collection;
    counts[current] = 0;
    await db.createCollection(current).catch(() => {});
    for (const { v: _v, ns: _ns, ...ix } of row.indexes) {
      const { key, ...options } = ix;
      await db.collection(current).createIndex(key, options);
    }
    continue;
  }
  batch.push(EJSON.deserialize(row.d, { relaxed: false }));
  counts[current] += 1;
  if (batch.length >= 500) await flush();
}
await flush();
await mongoose.disconnect();
console.log(
  `✓ restored ${meta.db} (${meta.createdAt}) into ${db.databaseName}`,
);
for (const [name, n] of Object.entries(counts)) console.log(`  ${name}: ${n}`);
