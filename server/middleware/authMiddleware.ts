import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
      return next();
    } catch (err) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired session token. Please re-authenticate.',
      });
      return;
    }
  }

  // Fallback: Check for x-pubkey header for local mesh / offline P2P development
  const pubkeyHeader = req.headers['x-pubkey'] as string;
  if (pubkeyHeader && pubkeyHeader.length === 66) {
    req.user = {
      pubkey: pubkeyHeader,
      role: 'vendor',
      username: 'Vendor ' + pubkeyHeader.slice(0, 6)
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
