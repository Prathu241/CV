import type { APIRoute } from 'astro';
import { ADMIN_USER, ADMIN_PASS, createSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const data = await request.formData();
  const username = data.get('username');
  const password = data.get('password');

  if (username === ADMIN_USER && password === ADMIN_PASS) {
      createSession(cookies);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
}
