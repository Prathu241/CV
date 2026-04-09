import type { APIRoute } from 'astro';
import { AUTH_CONFIGURED, destroySession, isAuthenticated, isTrustedOrigin } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!AUTH_CONFIGURED) {
    return new Response(JSON.stringify({ error: 'Editor access is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  if (!isTrustedOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  destroySession(cookies);
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/?logged_out=1',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
};
