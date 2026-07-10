import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from './db';
import * as schema from './db/schema';

export function getAuth(d1: D1Database, secret: string, baseUrl: string) {
  const db = getDb(d1);
  const origins: string[] = [];
  if (baseUrl) origins.push(baseUrl);
  if (baseUrl && !baseUrl.includes('localhost')) {
    origins.push('http://localhost:5173', 'http://localhost:8787');
  }
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
    trustedOrigins: origins,
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });
}
