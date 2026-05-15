import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import type { IncomingHttpHeaders } from 'http';
import type { TeacherPublic } from '../shared/types';
import type { TeacherStore } from './teacherStore';

export const teacherCookieName = 'eleusia.teacher';
export const teacherSessionDurationMs = 30 * 24 * 60 * 60 * 1000;

export interface AuthenticatedTeacher extends TeacherPublic {
  sessionTokenHash: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > 254 || !emailPattern.test(normalized)) return null;
  return normalized;
}

export function isValidPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionCookie(token: string, nodeEnv: string | undefined) {
  const secure = nodeEnv === 'production' ? '; Secure' : '';
  const maxAge = Math.floor(teacherSessionDurationMs / 1000);
  return `${teacherCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge.toString()}${secure}`;
}

export function clearSessionCookie() {
  return `${teacherCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readCookie(headers: IncomingHttpHeaders, name: string) {
  const rawCookie = headers.cookie;
  if (!rawCookie) return null;

  for (const segment of rawCookie.split(';')) {
    const [key, ...valueParts] = segment.trim().split('=');
    if (key === name) return valueParts.join('=');
  }

  return null;
}

export async function authenticateTeacher(headers: IncomingHttpHeaders, store: TeacherStore): Promise<AuthenticatedTeacher | null> {
  if (!store.available) return null;
  const token = readCookie(headers, teacherCookieName);
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await store.findTeacherSession(tokenHash);
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;

  return {
    id: session.teacher.id,
    email: session.teacher.email,
    sessionTokenHash: tokenHash,
  };
}
