import { Request, Response, NextFunction } from 'express';

// ==========================================
// 1. INPUT SANITIZATION & SSRF DEFENSES
// ==========================================

// Allowed Instagram Hostnames Whitelist (Strict SSRF Prevention)
const ALLOWED_INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'www.instagr.am',
]);

// Private & Reserved IP ranges / hostnames to block against SSRF
const FORBIDDEN_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // AWS / GCP link-local metadata service
  /^0\.0\.0\.0/,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

export interface ValidatedInstagramUrl {
  isValid: boolean;
  cleanUrl: string;
  error?: string;
}

/**
 * Validates and sanitizes Instagram URLs with strict SSRF defense.
 * Ensures the target URL strictly belongs to legitimate Instagram domains,
 * uses http/https protocol, and cannot be manipulated into SSRF or local network traversal.
 */
export function validateAndSanitizeUrl(input: unknown): ValidatedInstagramUrl {
  if (typeof input !== 'string') {
    return { isValid: false, cleanUrl: '', error: 'URL must be a string.' };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false, cleanUrl: '', error: 'URL cannot be empty.' };
  }

  // Prevent buffer overflow or excessive regex denial of service
  if (trimmed.length > 2048) {
    return { isValid: false, cleanUrl: '', error: 'URL exceeds maximum permitted length (2048 chars).' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, cleanUrl: '', error: 'Invalid URL format.' };
  }

  // Enforce protocol
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, cleanUrl: '', error: 'Only HTTP and HTTPS protocols are permitted.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check SSRF blacklist (loopbacks, link-local, private IPs)
  for (const pattern of FORBIDDEN_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      return { isValid: false, cleanUrl: '', error: 'Target host is not permitted.' };
    }
  }

  // Check strict whitelist for Instagram
  if (!ALLOWED_INSTAGRAM_HOSTS.has(hostname)) {
    return {
      isValid: false,
      cleanUrl: '',
      error: 'Only public Instagram links (posts, reels, tv, stories) are supported.',
    };
  }

  // Ensure no user credentials embedded in URL (e.g. https://user:pass@domain)
  if (parsed.username || parsed.password) {
    return { isValid: false, cleanUrl: '', error: 'URLs with embedded user credentials are not allowed.' };
  }

  // Disallow command injection flags (e.g., URLs crafted to look like CLI options)
  if (parsed.href.startsWith('-')) {
    return { isValid: false, cleanUrl: '', error: 'Malformed URL pattern detected.' };
  }

  // Clean and normalize URL
  const cleanUrl = parsed.href;
  return { isValid: true, cleanUrl };
}

/**
 * Sanitize plain text input against XSS, control characters, and injection attacks.
 */
export function sanitizeString(input: unknown, maxLength = 1000): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/[<>'"&]/g, (match) => {
      switch (match) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case "'": return '&#39;';
        case '"': return '&quot;';
        case '&': return '&amp;';
        default: return match;
      }
    })
    .trim();
}

/**
 * Sanitize filenames to prevent Path Traversal attacks (e.g., ../../../etc/passwd)
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, '') // remove directory separators
    .replace(/\.\.+/g, '') // remove double dots
    .replace(/[^\w.\- ]/g, '') // allow only alphanumeric, period, hyphen, space
    .trim()
    .slice(0, 120) || 'instagram_media';
}

// ==========================================
// 2. IN-MEMORY RATE LIMITING MIDDLEWARE
// ==========================================

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Cleanup interval every minute
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(ip);
      }
    }
  }, 60 * 1000);

  return (req: Request, res: Response, next: NextFunction) => {
    // Get client IP (support reverse proxies / X-Forwarded-For)
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    let record = store.get(clientIp);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      store.set(clientIp, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, options.maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > options.maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        error: options.message || 'Too many requests. Please slow down and try again shortly.',
        retryAfterSeconds: resetSeconds,
      });
    }

    next();
  };
}

// ==========================================
// 3. SECURITY HEADERS MIDDLEWARE
// ==========================================

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS Auditor
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict sensitive browser APIs
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );

  // Content Security Policy (allows necessary Vite & fonts resources while blocking malicious injections)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: https: blob:; " +
    "media-src 'self' blob:; " +
    "connect-src 'self' https:; " +
    "object-src 'none'; " +
    "base-uri 'self';"
  );

  next();
}

// ==========================================
// 4. EXPOSED FILES & SENSITIVE PATH GUARD
// ==========================================

const BLOCKED_FILE_PATTERNS = [
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/\.gitignore/i,
  /^\/package(-lock)?\.json/i,
  /^\/bun\.lock/i,
  /^\/tsconfig\.json/i,
  /^\/server\.ts/i,
  /^\/metadata\.json/i,
  /\.(bak|config|swp|old|save|env)$/i,
];

export function blockSensitiveFiles(req: Request, res: Response, next: NextFunction) {
  const urlPath = decodeURI(req.path || '');

  // Prevent path traversal attempts
  if (urlPath.includes('..') || urlPath.includes('\0')) {
    return res.status(403).json({ error: 'Access denied: Directory traversal detected.' });
  }

  for (const pattern of BLOCKED_FILE_PATTERNS) {
    if (pattern.test(urlPath)) {
      return res.status(404).json({ error: 'Resource not found.' });
    }
  }

  next();
}

// ==========================================
// 5. SECURE CORS CONFIGURATION
// ==========================================

export function configureCors(allowedOrigins?: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // Check if origin is permitted
    let isAllowed = false;

    if (!origin) {
      // Same-origin request or non-browser client
      isAllowed = true;
    } else if (allowedOrigins && allowedOrigins.length > 0) {
      isAllowed = allowedOrigins.includes(origin);
    } else {
      // Default: allow localhost, 127.0.0.1, or same host
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      isAllowed = isLocalhost;
    }

    if (isAllowed && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  };
}
