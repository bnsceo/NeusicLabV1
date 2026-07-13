import { isProductionMode } from './runtimeMode';

export const AUTH_COOKIE_NAME = 'cyvora_session';
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getAuthSecret(): string {
  return process.env.CYVORA_AUTH_SECRET || process.env.TUNNEL_ACCESS_CODE || '';
}

export function getAccessCode(): string {
  return process.env.TUNNEL_ACCESS_CODE || '';
}

export function isAuthRequired(): boolean {
  return isProductionMode() || Boolean(getAccessCode()) || process.env.CYVORA_AUTH_REQUIRED === 'true';
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createAuthSession(durationSeconds = AUTH_COOKIE_MAX_AGE): Promise<string> {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error('Auth secret is not configured');
  }

  const expiresAt = Date.now() + durationSeconds * 1000;
  const payload = String(expiresAt);
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyAuthSession(session: string | undefined | null): Promise<boolean> {
  if (!session) return false;

  const secret = getAuthSecret();
  if (!secret) return false;

  const [expiresAtRaw, signatureRaw] = session.split('.');
  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  if (!signatureRaw) return false;

  const key = await importHmacKey(secret);
  const payload = encoder.encode(expiresAtRaw);
  const signatureBytes = base64UrlDecode(signatureRaw) as unknown as BufferSource;
  return crypto.subtle.verify('HMAC', key, signatureBytes, payload);
}

export function getAuthCookieOptions(maxAge = AUTH_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: true,
    path: '/',
    maxAge,
  };
}

export function decodeSessionExpiration(session: string | undefined | null): number | null {
  if (!session) return null;
  const [expiresAtRaw] = session.split('.');
  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  return Number.isFinite(expiresAt) ? expiresAt : null;
}
