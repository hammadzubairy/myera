import { Request, Response, NextFunction } from 'express';
import { getAdminClient } from '../supabase';

export interface AuthUser {
  id: string;
  email: string;
  role?: 'member' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      accessToken?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  const token = header.slice(7);
  try {
    const { data, error } = await getAdminClient().auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = { id: data.user.id, email: data.user.email || '' };
    req.accessToken = token;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'Auth failed' });
  }
}

/** Block deleted / suspended members from member APIs. */
export async function requireActiveMember(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await getAdminClient()
    .from('profiles')
    .select('role, suspended_at, deleted_at')
    .eq('id', req.user.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.deleted_at) {
    return res.status(401).json({ error: 'Account deleted' });
  }
  if (data.suspended_at) {
    return res.status(403).json({ error: 'Account suspended' });
  }
  req.user.role = (data.role as 'member' | 'admin') || 'member';
  return next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await getAdminClient()
    .from('profiles')
    .select('role, suspended_at, deleted_at')
    .eq('id', req.user.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.deleted_at || data.suspended_at || data.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  req.user.role = 'admin';
  return next();
}
