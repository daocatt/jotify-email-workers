export interface PublicConfig {
  allowRegister: boolean;
  requireApproval: boolean;
  maxDomainsPerUser: number;
  turnstileSiteKey: string | null;
}

export interface DbUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: 'user' | 'admin' | 'superadmin';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface SessionData {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface Domain {
  id: number;
  userId: string;
  domain: string;
  createdAt: string;
}

export interface Destination {
  id: number;
  userId: string;
  email: string;
  createdAt: string;
}

export interface ForwardRule {
  id: number;
  userId: string;
  usernamePattern: string;
  subdomain: string | null;
  domainId: number;
  destinationId: number;
  createdAt: string;
}

export interface Webhook {
  id: number;
  userId: string;
  name: string;
  url: string;
  authType: 'none' | 'bearer' | 'header';
  authToken: string | null;
  createdAt: string;
}

export interface WebhookRule {
  id: number;
  userId: string;
  usernamePattern: string;
  subdomain: string | null;
  domainId: number;
  webhookId: number;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}
