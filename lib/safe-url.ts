/**
 * Guard for server-side fetches of user-supplied URLs (job pages, OAuth client metadata).
 * Only public http(s) hosts may be fetched; loopback, private, link-local (cloud metadata),
 * carrier-grade NAT, multicast and other special-purpose addresses are refused.
 *
 * The WHATWG URL parser canonicalises IPv4 tricks (hex/octal/decimal/short forms such as
 * `0x7f.1` or `2130706433`) to dotted-quad and IPv6 to compressed lowercase form before we
 * look at the host, so the checks below only need to handle canonical spellings.
 *
 * Known gap: DNS rebinding (a public hostname that resolves to a private address) would
 * need a custom dispatcher and is out of scope.
 */

export const INTERNAL_ADDRESS_ERROR =
  'This URL points to an internal address and cannot be accessed.';
export const UNSUPPORTED_PROTOCOL_ERROR = 'Only http and https links are supported.';
export const INVALID_URL_ERROR = 'Invalid URL format.';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const LOCAL_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
]);

function isPrivateIpv4(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // 10/8
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12
    (a === 192 && b === 168) || // 192.168/16
    a >= 224 // multicast, reserved, broadcast
  );
}

/** `host` is the canonical, bracket-less, lowercase IPv6 text from the URL parser. */
function isPrivateIpv6(host: string): boolean {
  if (host === '::' || host === '::1') return true;

  // IPv4-mapped (::ffff:a.b.c.d, serialised by the parser as ::ffff:xxxx:xxxx)
  const mapped = host.match(/^::ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1];
    if (tail.includes('.')) return isPrivateIpv4(tail);
    const hex = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (!hex) return true;
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isPrivateIpv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }

  if (/^::([0-9a-f]{1,4}:)?[0-9a-f]{1,4}$/.test(host)) return true; // ::/96 IPv4-compatible (deprecated)
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true; // fc00::/7 unique local
  if (/^ff[0-9a-f]{2}:/.test(host)) return true; // multicast
  return false;
}

/** True when the URL's host is loopback, private, link-local, etc. Unparseable URLs count as private. */
export function isPrivateUrl(urlString: string): boolean {
  try {
    return isPrivateHost(new URL(urlString).hostname);
  } catch {
    return true;
  }
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
  if (!host) return true;
  if (LOCAL_HOSTNAMES.has(host) || host.endsWith('.localhost')) return true;
  if (host.includes(':')) return isPrivateIpv6(host);
  return isPrivateIpv4(host);
}

/**
 * Why a URL must not be fetched server-side, as a user-facing message — or null when it
 * looks like a public http(s) address.
 */
export function unsafeUrlReason(urlString: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return INVALID_URL_ERROR;
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return UNSUPPORTED_PROTOCOL_ERROR;
  if (isPrivateHost(parsed.hostname)) return INTERNAL_ADDRESS_ERROR;
  return null;
}
