/**
 * npm run set:password -- <username>
 *
 * Sets a new password for any account, admins included, in the configured
 * database (MONGODB_URI). Needed once when passwords started being hashed in
 * the browser (v1.1.0): accounts created before can no longer log in, since
 * the server never saw their password in a form it can convert.
 *
 * Password: NEW_PASSWORD if set (admins: at least 12 characters, others 6),
 * otherwise a random one printed once. Every session of the account ends.
 */
// Must stay the first import: turns the demo seed off (see cli-env.ts).
import './cli-env.js';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../app.module.js';
import { Role } from '../common/enums/role.enum.js';
import { hashPlainForStorage } from '../common/utils/passwords.js';
import { passwordChangeStamp } from '../modules/users/account-status.service.js';
import { User } from '../modules/users/schemas/user.schema.js';
import { AuthSessionService } from '../modules/users/sessions/auth-session.service.js';

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const username = process.argv[2]?.trim().toLowerCase();
  if (!username) fail('Usage: npm run set:password -- <username>');
  if (process.env.MONGODB_URI === 'memory') {
    fail('MONGODB_URI=memory: the change would be lost on exit.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const userModel = app.get<Model<User>>(getModelToken(User.name));
    const user = await userModel.findOne({ username }).lean();
    if (!user) fail(`"${username}" does not exist.`);

    const min = user.role === Role.ADMIN ? 12 : 6;
    const given = process.env.NEW_PASSWORD;
    if (given !== undefined && given.length < min) {
      fail(
        `NEW_PASSWORD must be at least ${min} characters for a ${user.role}`,
      );
    }
    if (given !== undefined && given.toLowerCase() === username) {
      fail('NEW_PASSWORD must not be the username');
    }
    const password = given ?? randomBytes(12).toString('base64url');

    await userModel.updateOne(
      { _id: user._id },
      {
        password: await hashPlainForStorage(username, password),
        passwordChangedAt: passwordChangeStamp(),
      },
    );
    const ended = await app
      .get(AuthSessionService)
      .revokeAll(user._id.toString());
    console.log(
      `✓ New password set for "${username}" (${user.role}); ${ended} session(s) ended.`,
    );
    if (given === undefined) {
      console.log(`  Password (shown only once): ${password}`);
    }
  } finally {
    await app.close();
  }
}

await main();
