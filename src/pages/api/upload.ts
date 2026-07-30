import type { APIRoute } from 'astro';
import { AUTH_CONFIGURED, isAuthenticated, isTrustedOrigin } from '../../lib/auth';
import { CAN_WRITE_RUNTIME_CONTENT } from '../../lib/content';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const GITHUB_API_BASE = 'https://api.github.com';
const runtimeEnv = process.env;

function getContentRepoOwner(): string {
    return runtimeEnv.CONTENT_REPO_OWNER || '';
}

function getContentRepoName(): string {
    return runtimeEnv.CONTENT_REPO_NAME || '';
}

function getContentRepoBranch(): string {
    return runtimeEnv.CONTENT_REPO_BRANCH || 'main';
}

function getContentRepoUploadPath(): string {
    return runtimeEnv.CONTENT_REPO_UPLOAD_PATH || 'public/uploads';
}

function getGithubToken(): string {
    return runtimeEnv.GITHUB_TOKEN || '';
}

function hasGithubUploadConfig(): boolean {
    return Boolean(getContentRepoOwner() && getContentRepoName() && getGithubToken());
}

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

    if (!CAN_WRITE_RUNTIME_CONTENT) {
            return json({ error: 'Live uploads are not configured for this deployment.' }, 501);
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
      const uploadPath = path.posix.join(getContentRepoUploadPath().replace(/\\/g, '/'), fileName);

      if (hasGithubUploadConfig()) {
          const CONTENT_REPO_OWNER = getContentRepoOwner();
          const CONTENT_REPO_NAME = getContentRepoName();
          const CONTENT_REPO_BRANCH = getContentRepoBranch();
          const GITHUB_TOKEN = getGithubToken();

          const existingFileResponse = await fetch(
              `${GITHUB_API_BASE}/repos/${CONTENT_REPO_OWNER}/${CONTENT_REPO_NAME}/contents/${uploadPath}?ref=${encodeURIComponent(CONTENT_REPO_BRANCH)}`,
              {
                  headers: {
                      Authorization: `Bearer ${GITHUB_TOKEN}`,
                      Accept: 'application/vnd.github+json',
                      'X-GitHub-Api-Version': '2022-11-28'
                  }
              }
          );

          let sha: string | undefined;
          if (existingFileResponse.ok) {
              const existingJson = await existingFileResponse.json() as { sha?: string };
              sha = existingJson.sha;
          }

          const response = await fetch(
              `${GITHUB_API_BASE}/repos/${CONTENT_REPO_OWNER}/${CONTENT_REPO_NAME}/contents/${uploadPath}`,
              {
                  method: 'PUT',
                  headers: {
                      Authorization: `Bearer ${GITHUB_TOKEN}`,
                      Accept: 'application/vnd.github+json',
                      'Content-Type': 'application/json',
                      'X-GitHub-Api-Version': '2022-11-28'
                  },
                  body: JSON.stringify({
                      message: `Upload ${fileName} from admin portal`,
                      content: buffer.toString('base64'),
                      sha,
                      branch: CONTENT_REPO_BRANCH
                  })
              }
          );

          if (!response.ok) {
              const text = await response.text();
              console.error('GitHub upload failed:', response.status, text);
              return json({ error: 'Upload failed' }, 500);
          }
      } else {
          const uploadDir = path.join(process.cwd(), 'public', 'uploads');

          if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
          }

          fs.writeFileSync(path.join(uploadDir, fileName), buffer);
      }
      
      return json({ 
          success: true, 
          url: `/uploads/${fileName}` 
      }, 200);

  } catch (e) {
      console.error(e);
      return json({ error: 'Upload failed' }, 500);
  }
}
