/**
 * Shared helpers for the data migration scripts (scripts/migrate-*.mjs).
 * Reads MONGODB_URI from the environment or from be/.env.
 */
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';

export function mongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const match = env.match(/^MONGODB_URI=(.+)$/m);
  if (!match) throw new Error('MONGODB_URI not found in env or be/.env');
  return match[1].trim();
}

/** `--dry-run`: report what would change, write nothing. */
export const dryRun = process.argv.includes('--dry-run');

/** Connects and returns the native db, or exits when there is nothing to migrate. */
export async function connect() {
  const uri = mongoUri();
  if (uri === 'memory') {
    console.log('MONGODB_URI=memory: nothing to migrate.');
    process.exit(0);
  }
  await mongoose.connect(uri);
  if (dryRun) console.log('DRY RUN: no changes will be written.\n');
  return mongoose.connection.db;
}

export const disconnect = () => mongoose.disconnect();
