import type { APIRoute } from 'astro';
import { isAuthConfigured, createSession, credentialsMatch, getEditorPass, getEditorUser, isTrustedOrigin } from '../../../lib/auth';

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthConfigured()) {
    return json({ error: 'Editor access is not configured' }, 503);
  }

  if (!isTrustedOrigin(request)) {
    return json({ error: 'Forbidden origin' }, 403);
  }

  const clientIp = getClientIp(request);
  const now = Date.now();
  const attempts = loginAttempts.get(clientIp);

  if (attempts && attempts.resetAt > now && attempts.count >= MAX_ATTEMPTS) {
    return json({ error: 'Too many attempts, try again later' }, 429);
  }

  const data = await request.formData();
  const username = data.get('username')?.toString().trim();
  const password = data.get('password')?.toString();

  if (!getEditorUser() || !getEditorPass()) {
    return json({ error: 'Server authentication is not configured' }, 503);
  }

  if (!username || !password) {
    return json({ error: 'Missing credentials' }, 400);
  }

  if (credentialsMatch(username, password)) {
      loginAttempts.delete(clientIp);
      createSession(cookies);
      return json({ success: true }, 200);
  }

  if (!attempts || attempts.resetAt <= now) {
    loginAttempts.set(clientIp, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    loginAttempts.set(clientIp, { count: attempts.count + 1, resetAt: attempts.resetAt });
  }

  return json({ error: 'Invalid credentials' }, 401);
}
