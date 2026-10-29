import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const SECRET = process.env.AUTH_SECRET || 'hpio-kcic-secure-admin-secret-2026-v1';
export const ADMIN_COOKIE_NAME = 'hpio_admin_session';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role_id: string | null;
}

export function createSessionToken(user: SessionUser): string {
  const payload = JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    role_id: user.role_id,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days valid
  });
  const b64Payload = Buffer.from(payload, 'utf-8').toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(b64Payload).digest('base64url');
  return `${b64Payload}.${signature}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [b64Payload, signature] = parts;
    if (!b64Payload || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', SECRET).update(b64Payload).digest('base64url');
    if (Buffer.byteLength(signature) !== Buffer.byteLength(expectedSig)) {
      return null;
    }
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf-8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role_id: payload.role_id,
    };
  } catch {
    return null;
  }
}

export async function verifyUserPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    // Convert PHP / Laravel blowfish $2y$ prefix to $2a$ for bcryptjs compatibility
    const normalized = hashed.startsWith('$2y$') ? hashed.replace(/^\$2y\$/, '$2a$') : hashed;
    return await bcrypt.compare(plain, normalized);
  } catch (err) {
    console.error('Error verifying password:', err);
    return false;
  }
}

export async function getAdminSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}
