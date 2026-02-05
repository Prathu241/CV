import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../lib/auth';
import { updateContent } from '../../../lib/content';

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
      const data = await request.json();
      const success = updateContent(data);
      
      if (success) {
          return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "Write failed" }), { status: 500 });
  } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid Data" }), { status: 400 });
  }
}
