import crypto from 'node:crypto';

export function getEnv(key: string): string {
    return (process.env[key] || (import.meta.env as any)[key] || '').trim();
}

export function getEditorUser(): string {
    return getEnv('EDITOR_USER');
}

export function getEditorPass(): string {
    return getEnv('EDITOR_PASS');
}

export function isAuthConfigured(): boolean {
    if (import.meta.env.DEV) return true;
    return Boolean(getEditorUser() && getEditorPass());
}

export const AUTH_CONFIGURED = isAuthConfigured();
export const EDITOR_USER = getEditorUser();
export const EDITOR_PASS = getEditorPass();

function getSessionSecret(): string {
    const configured = getEnv('SESSION_SECRET');
    if (configured && configured !== 'change-this-to-a-long-random-secret') {
        return configured;
    }
    // Stable deterministic fallback so serverless cold starts across instances don't invalidate active sessions
    return crypto.createHash('sha256')
        .update('prathu-dev-portfolio-stable-session-secret-' + (getEditorUser() || 'pratham-portfolio'))
        .digest('hex');
}

export function getSessionTtl(): number {
    const rawTtl = Number.parseInt(getEnv('SESSION_TTL_SECONDS'), 10);
    return Number.isInteger(rawTtl) && rawTtl > 0 ? rawTtl : 60 * 60 * 8; // 8 hours default
}

export const COOKIE_NAME = 'site_admin_session';

function b64urlEncode(value: string): string {
    return Buffer.from(value, 'utf-8').toString('base64url');
}

function b64urlDecode(value: string): string {
    return Buffer.from(value, 'base64url').toString('utf-8');
}

function sign(value: string): string {
    return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function safeCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
}

export function credentialsMatch(username: string, password: string): boolean {
    const expectedUser = getEditorUser();
    const expectedPass = getEditorPass();
    if (!expectedUser || !expectedPass) {
        return false;
    }
    return safeCompare(username, expectedUser) && safeCompare(password, expectedPass);
}

export function isTrustedOrigin(request: Request): boolean {
    if (import.meta.env.DEV) {
        return true;
    }

    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const source = origin || referer;
    if (!source) {
        return false;
    }

    try {
        const sourceUrl = new URL(source);
        const requestUrl = new URL(request.url);

        // 1. Exact match with requestUrl origin
        if (sourceUrl.origin === requestUrl.origin) {
            return true;
        }

        // 2. Match with forwarded host header or Host header (Vercel / reverse proxy)
        const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
        if (hostHeader) {
            const cleanHost = hostHeader.split(',')[0].trim().split(':')[0].toLowerCase();
            const sourceHost = sourceUrl.hostname.toLowerCase();
            if (sourceHost === cleanHost) {
                return true;
            }
        }

        // 3. Explicitly allow production custom domain & deployment domains
        const sourceHostname = sourceUrl.hostname.toLowerCase();
        if (
            sourceHostname === 'prathudev.in' ||
            sourceHostname.endsWith('.prathudev.in') ||
            sourceHostname.endsWith('.vercel.app') ||
            sourceHostname === 'localhost' ||
            sourceHostname === '127.0.0.1'
        ) {
            return true;
        }

        // 4. Match with any custom domain configured in env
        const customDomain = getEnv('CUSTOM_DOMAIN').toLowerCase();
        if (customDomain && (sourceHostname === customDomain || sourceHostname.endsWith('.' + customDomain))) {
            return true;
        }

        const siteUrl = getEnv('SITE_URL');
        if (siteUrl) {
            try {
                if (sourceHostname === new URL(siteUrl).hostname.toLowerCase()) {
                    return true;
                }
            } catch {}
        }

        return false;
    } catch {
        return false;
    }
}

export function isAuthenticated(cookies: any): boolean {
    const raw = cookies.get(COOKIE_NAME)?.value;
    if (!raw) {
        return false;
    }

    const parts = raw.split('.');
    if (parts.length !== 2) {
        return false;
    }

    const [payloadB64, signature] = parts;
    const expectedSig = sign(payloadB64);
    if (!safeCompare(signature, expectedSig)) {
        return false;
    }

    try {
        const payload = JSON.parse(b64urlDecode(payloadB64)) as { u?: string; exp?: number; iat?: number; v?: number };
        const now = Math.floor(Date.now() / 1000);
        const expectedUser = getEditorUser();
        return Boolean(
            payload &&
            typeof payload.u === 'string' &&
            (!expectedUser || payload.u === expectedUser) &&
            Number.isInteger(payload.exp) &&
            payload.exp > now
        );
    } catch {
        return false;
    }
}

export function createSession(cookies: any): void {
    const now = Math.floor(Date.now() / 1000);
    const ttl = getSessionTtl();
    const payload = {
        v: 1,
        u: getEditorUser(),
        iat: now,
        exp: now + ttl,
        n: crypto.randomBytes(12).toString('hex')
    };

    const payloadB64 = b64urlEncode(JSON.stringify(payload));
    const token = `${payloadB64}.${sign(payloadB64)}`;

    cookies.set(COOKIE_NAME, token, {
        path: '/',
        httpOnly: true,
        secure: !import.meta.env.DEV,
        sameSite: 'lax',
        maxAge: ttl
    });
}

export function destroySession(cookies: any): void {
    cookies.delete(COOKIE_NAME, { path: '/' });
}

