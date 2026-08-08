import type { Request } from 'express';
import env from '../config/env';
import { logger } from '../utils/logger';

type CacheEntry = { countryCode: string; at: number };

const cache = new Map<string, CacheEntry>();

const PRIVATE_IP_RE =
  /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.|::1|fc|fd|fe80)/i;

export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim().slice(0, 64);
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0]!.trim().slice(0, 64);
  }
  return (req.ip || 'unknown').slice(0, 64);
}

function normalizeCountryCode(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (code === 'XX' || code === 'T1') return null;
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function isPrivateOrUnknownIp(ip: string): boolean {
  if (!ip || ip === 'unknown') return true;
  return PRIVATE_IP_RE.test(ip);
}

async function lookupIpCountryViaProvider(ip: string): Promise<string | null> {
  if (env.ipGeoProvider !== 'ipinfo') {
    logger.warn('Unsupported IP_GEO_PROVIDER', { provider: env.ipGeoProvider });
    return null;
  }
  const tokenQs = env.ipGeoApiKey
    ? `?token=${encodeURIComponent(env.ipGeoApiKey)}`
    : '';
  const url = `https://ipinfo.io/${encodeURIComponent(ip)}/country${tokenQs}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'text/plain' },
    });
    if (!res.ok) {
      logger.warn('ipinfo country lookup failed', { status: res.status, ip });
      return null;
    }
    const text = (await res.text()).trim();
    return normalizeCountryCode(text);
  } catch (err) {
    logger.warn('ipinfo country lookup error', err);
    return null;
  }
}

/**
 * Resolve ISO country for the request client IP.
 * Prefers Cloudflare CF-IPCountry, then configured IP geo provider.
 * Returns `XX` when the country cannot be resolved (caller should treat as skip).
 */
export async function resolveClientIpCountryCode(req: Request): Promise<string> {
  const cf = normalizeCountryCode(
    typeof req.headers['cf-ipcountry'] === 'string'
      ? req.headers['cf-ipcountry']
      : undefined,
  );
  if (cf) {
    return cf;
  }

  const ip = clientIpFromRequest(req);
  if (isPrivateOrUnknownIp(ip)) {
    // Local/dev and private networks: cannot resolve a public geo country.
    return 'XX';
  }

  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < env.ipGeoCacheTtlMs) {
    return hit.countryCode;
  }

  const lookedUp = await lookupIpCountryViaProvider(ip);
  if (!lookedUp) {
    logger.warn('IP country unresolved; treating as XX', { ip });
    return 'XX';
  }
  cache.set(ip, { countryCode: lookedUp, at: Date.now() });
  return lookedUp;
}
