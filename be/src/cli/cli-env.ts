/**
 * Imported first by every CLI (before AppModule). The CLIs boot the whole app
 * against MONGODB_URI, which is usually production, while ConfigModule also
 * reads the developer's be/.env, where SEED_DEMO_DATA=true is common. On an
 * empty database the demo seed would then add demo accounts with public
 * passwords (admin/admin123) and demo quizzes. dotenv never overrides a value
 * already in process.env, so setting it here wins.
 */
process.env.SEED_DEMO_DATA = 'false';
