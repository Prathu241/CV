import type { APIRoute } from 'astro';
import { AUTH_CONFIGURED, destroySession, isTrustedOrigin } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Logout is intentionally idempotent: an expired or missing session should
  // still be cleared and redirected, rather than trapping the user in admin.
  if (AUTH_CONFIGURED && !isTrustedOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
      status: 403,
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
