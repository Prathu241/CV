import type { APIRoute } from 'astro';
import { AUTH_CONFIGURED, isAuthenticated, isTrustedOrigin } from '../../../lib/auth';
import { CAN_WRITE_RUNTIME_CONTENT, updateContent } from '../../../lib/content';

const MAX_CONTENT_BYTES = 1024 * 1024;

function json(data: unknown, status: number) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
}

function hasUnsafeKeys(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
        return false;
    }

    if (Array.isArray(value)) {
        return value.some((item) => hasUnsafeKeys(item));
    }

    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            return true;
        }
        if (hasUnsafeKeys(obj[key])) {
            return true;
        }
    }

    return false;
}

export const POST: APIRoute = async ({ request, cookies }) => {
    if (!AUTH_CONFIGURED) {
    return json({ error: 'Editor access is not configured' }, 503);
    }

    if (!isTrustedOrigin(request)) {
            return json({ error: 'Forbidden origin' }, 403);
    }

  if (!isAuthenticated(cookies)) {
            return json({ error: 'Unauthorized' }, 401);
  }

  if (!CAN_WRITE_RUNTIME_CONTENT) {
        return json({
            error: 'Live editor writes are not configured for this deployment.'
        }, 501);
  }

  try {
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            return json({ error: 'Unsupported content type' }, 415);
        }

            const rawBody = await request.text();
            if (!rawBody || rawBody.length > MAX_CONTENT_BYTES) {
                    return json({ error: 'Payload too large or empty' }, 400);
            }

            const data = JSON.parse(rawBody);

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    return json({ error: 'Invalid payload' }, 400);
            }

            if (hasUnsafeKeys(data)) {
                    return json({ error: 'Unsafe payload' }, 400);
      }

        const success = await updateContent(data);
      
      if (success) {
                    return json({ success: true }, 200);
      }
            return json({ error: 'Write failed' }, 500);
  } catch (e) {
                        const message = e instanceof Error ? e.message : 'Invalid data';
                        return json({ error: message }, 500);
  }
}
