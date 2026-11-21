/**
 * npm run create:admin -- <username> "<Full Name>"
 *
 * Creates the first admin account in the configured database (MONGODB_URI).
 * Production runs with SEED_DEMO_DATA=false, so without this there is nobody
 * to approve teachers or order the quest map.
 *
 * Password: ADMIN_PASSWORD if set (at least 12 characters), otherwise a random
 * one printed once. An existing username is never changed.
 */
// Must stay the first import: turns the demo seed off (see cli-env.ts).
import './cli-env.js';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import type { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../app.module.js';
import { AccountStatus } from '../common/enums/account-status.enum.js';
import { Role } from '../common/enums/role.enum.js';
import { BCRYPT_ROUNDS } from '../common/utils/passwords.js';
import { User } from '../modules/users/schemas/user.schema.js';

/** Same rule as sign-up (RegisterDto). */
const USERNAME = /^[a-zA-Z0-9_.]{3,30}$/;
const MIN_PASSWORD = 12;

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  // npm on Windows passes arguments through cmd.exe, which can leave `^`
  // escapes in a quoted name ("^Admin^ Enquiz^"); a name never contains one.
  const [rawUsername, rawFullName] = process.argv.slice(2);
  const fullName = rawFullName?.replaceAll('^', '');
  if (!rawUsername || !fullName?.trim()) {
    fail('Usage: npm run create:admin -- <username> "<Full Name>"');
  }
  if (!USERNAME.test(rawUsername)) {
    fail('username: 3-30 characters, letters, digits, _ and . only');
  }
  if (process.env.MONGODB_URI === 'memory') {
    fail('MONGODB_URI=memory: the account would be lost on exit.');
  }

  const given = process.env.ADMIN_PASSWORD;
  if (given !== undefined && given.length < MIN_PASSWORD) {
    fail(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD} characters`);
  }
  const password = given ?? randomBytes(18).toString('base64url');
  const username = rawUsername.toLowerCase();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const userModel = app.get<Model<User>>(getModelToken(User.name));
    if (await userModel.exists({ username })) {
      fail(`"${username}" already exists; nothing was changed.`);
    }
    await userModel.create({
      username,
      fullName: fullName.trim(),
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
    });
    console.log(`✓ Admin "${username}" created.`);
    if (given === undefined) {
      console.log(`  Password (shown only once): ${password}`);
    }
  } finally {
    await app.close();
  }
}

await main();
