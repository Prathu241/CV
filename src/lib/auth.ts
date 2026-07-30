import crypto from 'node:crypto';

const DEV_EDITOR_USER = '';
const DEV_EDITOR_PASS = '';
const DEV_SESSION_SECRET = '';
const runtimeEnv = process.env;

export const EDITOR_USER = runtimeEnv.EDITOR_USER || (import.meta.env.DEV ? DEV_EDITOR_USER : '');
export const EDITOR_PASS = runtimeEnv.EDITOR_PASS || (import.meta.env.DEV ? DEV_EDITOR_PASS : '');
const HAS_PROD_EDITOR_USER = Boolean(runtimeEnv.EDITOR_USER);
const HAS_PROD_EDITOR_PASS = Boolean(runtimeEnv.EDITOR_PASS);
const HAS_PROD_SESSION_SECRET = Boolean(runtimeEnv.SESSION_SECRET);
export const AUTH_CONFIGURED = import.meta.env.DEV || (HAS_PROD_EDITOR_USER && HAS_PROD_EDITOR_PASS && HAS_PROD_SESSION_SECRET);

const SESSION_SECRET = runtimeEnv.SESSION_SECRET || (import.meta.env.DEV ? DEV_SESSION_SECRET : crypto.randomBytes(32).toString('hex'));
const SESSION_TTL_SECONDS = Number(runtimeEnv.SESSION_TTL_SECONDS || 60 * 60 * 8); // 8 hours

export const COOKIE_NAME = 'site_admin_session';

function b64urlEncode(value: string): string {
    return Buffer.from(value, 'utf-8').toString('base64url');
}

function b64urlDecode(value: string): string {
    return Buffer.from(value, 'base64url').toString('utf-8');
}

function sign(value: string): string {
    return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function safeCompare(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
}

export function credentialsMatch(username: string, password: string): boolean {
    return safeCompare(username, EDITOR_USER) && safeCompare(password, EDITOR_PASS);
}

export function isTrustedOrigin(request: Request): boolean {
    const origin = request.headers.get('origin');
    if (!origin) {
        return false;
    }

    try {
        const requestUrl = new URL(request.url);
        return origin === requestUrl.origin;
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
        const payload = JSON.parse(b64urlDecode(payloadB64)) as { u?: string; exp?: number };
        const now = Math.floor(Date.now() / 1000);
        return Boolean(payload?.u === EDITOR_USER && payload?.exp && payload.exp > now);
    } catch {
        return false;
    }
}

export function createSession(cookies: any): void {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        u: EDITOR_USER,
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
        n: crypto.randomBytes(12).toString('hex')
    };

    const payloadB64 = b64urlEncode(JSON.stringify(payload));
    const token = `${payloadB64}.${sign(payloadB64)}`;

    cookies.set(COOKIE_NAME, token, {
        path: '/',
        httpOnly: true,
        secure: !import.meta.env.DEV,
        sameSite: 'strict',
        maxAge: SESSION_TTL_SECONDS
    });
}

export function destroySession(cookies: any): void {
    cookies.delete(COOKIE_NAME, { path: '/' });
}
