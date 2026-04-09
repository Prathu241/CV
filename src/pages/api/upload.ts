import type { APIRoute } from 'astro';
import { AUTH_CONFIGURED, isAuthenticated, isTrustedOrigin } from '../../lib/auth';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function json(data: unknown, status: number) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
}

function hasValidImageSignature(buffer: Buffer): boolean {
    if (buffer.length < 12) {
        return false;
    }

    const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isGif = buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a';
    const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    return isPng || isJpeg || isGif || isWebp;
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

  try {
      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!(file instanceof File)) {
          return json({ error: 'No file provided' }, 400);
      }

      if (!file.type.startsWith('image/')) {
          return json({ error: 'Only image uploads are allowed' }, 400);
      }

      if (file.size > MAX_UPLOAD_SIZE) {
          return json({ error: 'File too large (max 5MB)' }, 400);
      }

      const originalExt = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(originalExt)) {
          return json({ error: 'Unsupported file extension' }, 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (!hasValidImageSignature(buffer)) {
          return json({ error: 'Invalid image file' }, 400);
      }

      const fileName = `${Date.now()}-${crypto.randomUUID()}${originalExt}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      
      if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
      }

      fs.writeFileSync(path.join(uploadDir, fileName), buffer);
      
      return json({ 
          success: true, 
          url: `/uploads/${fileName}` 
      }, 200);

  } catch (e) {
      console.error(e);
      return json({ error: 'Upload failed' }, 500);
  }
}
