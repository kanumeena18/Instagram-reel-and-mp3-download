import bcrypt from 'bcryptjs';
import connectSqlite3 from 'connect-sqlite3';
import { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import fs from 'fs';
import path from 'path';

// Augment express-session types to include adminUser in SessionData
declare module 'express-session' {
  interface SessionData {
    adminUser?: {
      username: string;
      authenticatedAt: number;
      ip: string;
    };
  }
}

export interface AdminUser {
  username: string;
  passwordHash: string;
}

// Track login attempts for brute-force defense
interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}
const loginAttempts = new Map<string, LoginAttempt>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout
const BCRYPT_SALT_ROUNDS = 12;

// Initial admin credential setup hashed with bcrypt
const defaultUsername = process.env.ADMIN_USERNAME?.trim() || 'admin';
const defaultPassword = process.env.ADMIN_PASSWORD?.trim() || 'Admin@MediaFetch2026!';

let currentAdminUser: AdminUser = {
  username: defaultUsername,
  passwordHash: bcrypt.hashSync(defaultPassword, BCRYPT_SALT_ROUNDS),
};

/**
 * Configure connect-sqlite3 persistent session store
 */
export function getSqliteSessionStore(): session.Store {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQLiteStore = connectSqlite3(session);
  return new SQLiteStore({
    db: 'sessions.sqlite',
    dir: dataDir,
  }) as unknown as session.Store;
}

/**
 * Check if IP is temporarily locked out due to excessive failed logins
 */
export function checkLoginLockout(ip: string): { isLocked: boolean; remainingSeconds: number } {
  const record = loginAttempts.get(ip);
  if (!record || !record.lockedUntil) {
    return { isLocked: false, remainingSeconds: 0 };
  }
  const now = Date.now();
  if (record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }
  // Lockout expired; reset attempts
  loginAttempts.delete(ip);
  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Record a failed login attempt
 */
export function recordFailedLogin(ip: string): { locked: boolean; remainingAttempts: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, firstAttemptAt: now };

  if (now - record.firstAttemptAt > LOCKOUT_DURATION_MS) {
    record.count = 0;
    record.firstAttemptAt = now;
    delete record.lockedUntil;
  }

  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    loginAttempts.set(ip, record);
    return { locked: true, remainingAttempts: 0 };
  }

  loginAttempts.set(ip, record);
  return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - record.count };
}

/**
 * Reset failed attempts on valid login
 */
export function resetLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

/**
 * Authenticate admin credentials using bcrypt comparison
 */
export async function authenticateAdmin(
  username: string,
  plainPassword: string,
  ip: string
): Promise<{ success: boolean; username?: string; error?: string }> {
  const lockout = checkLoginLockout(ip);
  if (lockout.isLocked) {
    return {
      success: false,
      error: `Too many failed login attempts. IP temporarily locked. Please try again in ${lockout.remainingSeconds} seconds.`,
    };
  }

  const isUsernameMatch = username === currentAdminUser.username;
  const isPasswordMatch = isUsernameMatch
    ? await bcrypt.compare(plainPassword, currentAdminUser.passwordHash)
    : false;

  if (!isUsernameMatch || !isPasswordMatch) {
    const attemptStatus = recordFailedLogin(ip);
    if (attemptStatus.locked) {
      return {
        success: false,
        error: 'Too many failed login attempts. Your IP has been temporarily locked for 15 minutes.',
      };
    }
    return {
      success: false,
      error: `Invalid admin credentials. (${attemptStatus.remainingAttempts} attempts remaining before temporary lockout)`,
    };
  }

  resetLoginAttempts(ip);
  return { success: true, username: currentAdminUser.username };
}

/**
 * Change admin password with bcrypt hashing
 */
export async function changeAdminPassword(
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const isMatch = await bcrypt.compare(oldPassword, currentAdminUser.passwordHash);
  if (!isMatch) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters long.' };
  }

  currentAdminUser.passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  return { success: true };
}

/**
 * Session-based middleware protecting /admin routes
 * Verifies that an active, valid admin session exists in SQLite store
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.adminUser) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Valid admin session required to access this resource.',
  });
}
