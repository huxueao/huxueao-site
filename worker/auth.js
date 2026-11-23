import { createRemoteJWKSet, jwtVerify } from 'jose';

const keysets = new Map();
export async function verifyAccess(request, env, testKeyset) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.OWNER_EMAIL) {
    return { error: 'Owner login is not configured yet.', status: 503 };
  }
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return { error: 'Please sign in to the owner workspace.', status: 401 };
  try {
    const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/$/, '');
    const team = new URL(issuer);
    if (team.protocol !== 'https:' || !team.hostname.endsWith('.cloudflareaccess.com')) throw new Error('Invalid issuer');
    if (!keysets.has(issuer)) keysets.set(issuer, createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer)));
    const { payload } = await jwtVerify(token, testKeyset || keysets.get(issuer), {
      issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'email'],
    });
    const owner = env.OWNER_EMAIL.trim().toLowerCase();
    if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== owner) {
      return { error: 'This workspace belongs to the site owner.', status: 403 };
    }
    return { email: payload.email, id: payload.sub };
  } catch {
    return { error: 'Your session could not be verified. Please sign in again.', status: 401 };
  }
}
