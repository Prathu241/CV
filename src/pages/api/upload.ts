import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../lib/auth';
import fs from 'node:fs';
import path from 'node:path';

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
          return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
      }

      const buffer = await file.arrayBuffer();
      const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      
      if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
      }

      fs.writeFileSync(path.join(uploadDir, fileName), Buffer.from(buffer));
      
      return new Response(JSON.stringify({ 
          success: true, 
          url: `/uploads/${fileName}` 
      }), { status: 200 });

  } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500 });
  }
}
