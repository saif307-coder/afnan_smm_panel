/**
 * Admin Authentication Utilities (Phase 5)
 * Lightweight, zero-dependency session token helper.
 */

export const ADMIN_COOKIE_NAME = 'admin_token';

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

export function generateAdminToken(): string {
  const secret = getAdminPassword();
  return btoa(`afnan_admin_session_${secret}`);
}

export function isValidAdminToken(token?: string | null): boolean {
  if (!token) return false;
  return token === generateAdminToken();
}
