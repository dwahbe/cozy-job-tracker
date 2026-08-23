import { createHash, randomBytes } from 'crypto';
import { redis } from '@/lib/redis';
import { unsafeUrlReason } from '@/lib/safe-url';

// ── Types ──────────────────────────────────────────────────

export interface AuthCodeData {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}

export interface TokenData {
  userId: string;
  clientId: string;
  scope: string;
}

export interface ClientMetadata {
  client_id: string;
  client_name?: string;
  redirect_uris?: string[];
  logo_uri?: string;
}

// ── Constants ──────────────────────────────────────────────

const AUTH_CODE_TTL = 600; // 10 minutes
export const ACCESS_TOKEN_TTL = 60 * 60 * 24 * 90; // 90 days
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 365; // 1 year

const PREFIX_CODE = 'oauth:code:';
const PREFIX_ACCESS = 'oauth:access:';
const PREFIX_REFRESH = 'oauth:refresh:';

export const SUPPORTED_SCOPES = ['board:read', 'board:write'] as const;
export const DEFAULT_SCOPE = SUPPORTED_SCOPES.join(' ');

/** Split a space-delimited scope string; `unsupported` lists anything we don't offer. */
export function parseScopes(scope: string | undefined): {
  scopes: string[];
  unsupported: string[];
} {
  const scopes = (scope ?? '').split(/\s+/).filter(Boolean);
  const unsupported = scopes.filter((s) => !(SUPPORTED_SCOPES as readonly string[]).includes(s));
  return { scopes, unsupported };
}

// ── Crypto helpers ─────────────────────────────────────────

export function generateCode(): string {
  return randomBytes(32).toString('base64url');
}

export function generateToken(): string {
  return randomBytes(48).toString('base64url');
}

export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash('sha256').update(codeVerifier).digest('base64url');
  return computed === codeChallenge;
}

// ── Auth code operations ───────────────────────────────────

export async function storeAuthCode(code: string, data: AuthCodeData): Promise<void> {
  await redis.set(PREFIX_CODE + code, data, { ex: AUTH_CODE_TTL });
}

export async function consumeAuthCode(code: string): Promise<AuthCodeData | null> {
  const key = PREFIX_CODE + code;
  const [data, deleted] = await redis.multi().get<AuthCodeData>(key).del(key).exec();
  if (!data || !deleted) return null;
  return data;
}

// ── Access token operations ────────────────────────────────

export async function storeAccessToken(token: string, data: TokenData): Promise<void> {
  await redis.set(PREFIX_ACCESS + token, data, { ex: ACCESS_TOKEN_TTL });
}

export async function validateAccessToken(token: string): Promise<TokenData | null> {
  return redis.get<TokenData>(PREFIX_ACCESS + token);
}

export async function revokeToken(token: string): Promise<void> {
  await Promise.all([redis.del(PREFIX_ACCESS + token), redis.del(PREFIX_REFRESH + token)]);
}

// ── Refresh token operations ───────────────────────────────

export async function storeRefreshToken(token: string, data: TokenData): Promise<void> {
  await redis.set(PREFIX_REFRESH + token, data, { ex: REFRESH_TOKEN_TTL });
}

export async function consumeRefreshToken(token: string): Promise<TokenData | null> {
  const key = PREFIX_REFRESH + token;
  const [data, deleted] = await redis.multi().get<TokenData>(key).del(key).exec();
  if (!data || !deleted) return null;
  return data;
}

// ── Client metadata (Client ID Metadata Documents) ────────

export async function fetchClientMetadata(clientId: string): Promise<ClientMetadata | null> {
  // Client IDs are URLs fetched server-side: https only, public hosts only, no redirects
  // (a document reached through a redirect could never carry a matching client_id anyway).
  if (!clientId.startsWith('https://') || unsafeUrlReason(clientId)) return null;

  try {
    const res = await fetch(clientId, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const doc = (await res.json()) as ClientMetadata;

    if (doc.client_id !== clientId) return null;

    return doc;
  } catch {
    return null;
  }
}

/**
 * Validate that a redirect_uri is allowed for a given client.
 * If the client_id is a URL (CIMD), fetches metadata and checks redirect_uris.
 * Otherwise, allows localhost redirects for pre-registered/unknown clients.
 */
export async function validateRedirectUri(
  clientId: string,
  redirectUri: string
): Promise<{ valid: boolean; clientName: string }> {
  const parsed = safeParseUrl(redirectUri);
  if (!parsed) return { valid: false, clientName: clientId };

  if (clientId.startsWith('https://')) {
    const meta = await fetchClientMetadata(clientId);
    if (!meta) return { valid: false, clientName: clientId };

    const allowed = meta.redirect_uris?.some((uri) => uri === redirectUri) ?? false;
    return { valid: allowed, clientName: meta.client_name || clientId };
  }

  const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  const isHttps = parsed.protocol === 'https:';
  return { valid: isLocalhost || isHttps, clientName: clientId };
}

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
