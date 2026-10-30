import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bitfriend_super_secure_jwt_secret_key_2026';

export interface AuthenticatedUser {
  pubkey: string;
  role: string;
  username?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      rawToken?: string;
    }
  }
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      const tokenHash = hashSessionToken(token);
      const session = db.prepare('SELECT id, expires_at FROM user_sessions WHERE token_hash = ?').get(tokenHash) as { id: string; expires_at: number } | undefined;

      if (!session || Date.now() > session.expires_at) {
        res.status(401).json({
          success: false,
          error: 'Session has been revoked or expired. Please re-authenticate.',
        });
        return;
      }

      req.user = decoded;
      req.rawToken = token;
      return next();
    } catch (err) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired session token. Please re-authenticate.',
      });
      return;
    }
  }

  // Fallback: Check for x-pubkey header for local mesh / offline P2P development (32-byte x-only or 33-byte compressed hex)
  const pubkeyHeader = req.headers['x-pubkey'] as string;
  if (pubkeyHeader && (pubkeyHeader.length === 64 || pubkeyHeader.length === 66)) {
    req.user = {
      pubkey: pubkeyHeader,
      role: 'vendor',
      username: 'Vendor_' + pubkeyHeader.slice(0, 6)
    };
    return next();
  }

  res.status(401).json({
    success: false,
    error: 'Authentication required. Missing Bearer authorization token.',
  });
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
      req.rawToken = token;
    } catch {
      // Ignored for optional auth
    }
  } else {
    const pubkeyHeader = req.headers['x-pubkey'] as string;
    if (pubkeyHeader) {
      req.user = {
        pubkey: pubkeyHeader,
        role: 'vendor',
      };
    }
  }
  next();
}

export function generateToken(payload: AuthenticatedUser): string {
  return jwt.sign({ ...payload, jti: crypto.randomBytes(8).toString('hex') }, JWT_SECRET, { expiresIn: '7d' });
}
