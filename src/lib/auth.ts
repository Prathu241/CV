// CHANGE THESE CREDENTIALS FOR PRODUCTION
export const ADMIN_USER = "admin";
export const ADMIN_PASS = "Prathu@Adam"; 

export const EDITOR_USER = "editor";
export const EDITOR_PASS = "Prathu@Edit";

export const COOKIE_NAME = "site_admin_session";
export const COOKIE_VALUE = "valid_session_token_12345"; // In a real app, use JWT

export function isAuthenticated(cookies: any) {
    const session = cookies.get(COOKIE_NAME);
    return session && session.value === COOKIE_VALUE;
}

export function createSession(cookies: any) {
    cookies.set(COOKIE_NAME, COOKIE_VALUE, {
        path: '/',
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        maxAge: 60 * 60 * 24 * 7 // 1 week
    });
}

export function destroySession(cookies: any) {
    cookies.delete(COOKIE_NAME, { path: '/' });
}
