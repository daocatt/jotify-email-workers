import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from './db';
import * as schema from './db/schema';

export function getAuth(d1: D1Database, secret: string, baseUrl: string) {
  const db = getDb(d1);
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
    },
    secret,
    baseURL: baseUrl,
    trustedOrigins: [
      'http://localhost:5173',
      'http://localhost:5174',
    ],
  });
}
