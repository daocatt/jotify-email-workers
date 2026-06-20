import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ── Better Auth Tables ───────────────────────────────────────────────────────

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('user'), // 'user', 'admin', 'superadmin'
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected'
  resetToken: text('resetToken'),
  resetTokenExpires: integer('resetTokenExpires'),
  tgToken: text('tgToken'),
  tgChatId: text('tgChatId'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }),
});

// ── Inbound Domains ──────────────────────────────────────────────────────────

export const domains = sqliteTable('domains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  domain: text('domain').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

// ── Forwarding Target Emails ─────────────────────────────────────────────────

export const destinations = sqliteTable('destinations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

// ── Forwarding Rules ─────────────────────────────────────────────────────────

export const forwardRules = sqliteTable('forward_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  usernamePattern: text('usernamePattern').notNull(), // regex pattern, e.g. "u.*"
  subdomain: text('subdomain'), // optional subdomain
  domainId: integer('domainId').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  destinationId: integer('destinationId').notNull().references(() => destinations.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

// ── Webhooks ─────────────────────────────────────────────────────────────────

export const webhooks = sqliteTable('webhooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  authType: text('authType').notNull().default('none'), // 'none', 'bearer', 'header'
  authToken: text('authToken'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

// ── Webhook Forwarding Rules ─────────────────────────────────────────────────

export const webhookRules = sqliteTable('webhook_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  usernamePattern: text('usernamePattern').notNull(), // regex pattern, e.g. "jot_*"
  subdomain: text('subdomain'), // optional subdomain
  domainId: integer('domainId').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  webhookId: integer('webhookId').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});
