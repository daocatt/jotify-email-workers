import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

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
}, (table) => {
  return {
    userIdIdx: index('session_user_id_idx').on(table.userId),
  };
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
}, (table) => {
  return {
    userIdIdx: index('account_user_id_idx').on(table.userId),
  };
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }),
}, (table) => {
  return {
    identifierIdx: index('verification_identifier_idx').on(table.identifier),
  };
});

// ── Inbound Domains ──────────────────────────────────────────────────────────

export const domains = sqliteTable('domains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  domain: text('domain').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
}, (table) => {
  return {
    userIdIdx: index('domains_user_id_idx').on(table.userId),
  };
});

// ── Forwarding Target Emails ─────────────────────────────────────────────────

export const destinations = sqliteTable('destinations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
}, (table) => {
  return {
    userIdIdx: index('destinations_user_id_idx').on(table.userId),
  };
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
}, (table) => {
  return {
    userIdIdx: index('forward_rules_user_id_idx').on(table.userId),
    domainIdIdx: index('forward_rules_domain_id_idx').on(table.domainId),
    destinationIdIdx: index('forward_rules_destination_id_idx').on(table.destinationId),
  };
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
}, (table) => {
  return {
    userIdIdx: index('webhooks_user_id_idx').on(table.userId),
  };
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
}, (table) => {
  return {
    userIdIdx: index('webhook_rules_user_id_idx').on(table.userId),
    domainIdIdx: index('webhook_rules_domain_id_idx').on(table.domainId),
    webhookIdIdx: index('webhook_rules_webhook_id_idx').on(table.webhookId),
  };
});

// ── Failed Webhooks Persistence (legacy, kept for backward compat) ────────────

export const failedWebhooks = sqliteTable('failed_webhooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  webhookId: integer('webhookId').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  headers: text('headers').notNull(), // JSON string representing headers
  payload: text('payload').notNull(), // JSON string representing webhook payload
  attempts: integer('attempts').notNull().default(0),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
}, (table) => {
  return {
    userIdIdx: index('failed_webhooks_user_id_idx').on(table.userId),
    webhookIdIdx: index('failed_webhooks_webhook_id_idx').on(table.webhookId),
  };
});

// ── Inbound Delivery Idempotency (dedup Cloudflare re-delivery) ──────────────

export const deliveryIdempotency = sqliteTable('delivery_idempotency', {
  idempotencyKey: text('idempotency_key').primaryKey(),
  status: text('status').notNull(), // 'pending' | 'sent' | 'failed'
  createdAt: text('created_at').notNull(),
}, (table) => {
  return {
    createdAtIdx: index('delivery_idempotency_created_at_idx').on(table.createdAt),
  };
});
