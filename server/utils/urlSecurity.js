const dns = require('dns').promises;
const net = require('net');

// List of prohibited IPv4 CIDR ranges (private, loopback, link‑local, metadata, etc.)
const prohibitedIPv4Ranges = [
  { start: '0.0.0.0', end: '0.255.255.255' }, // Current network
  { start: '10.0.0.0', end: '10.255.255.255' }, // RFC 1918 Private
  { start: '100.64.0.0', end: '100.127.255.255' }, // Carrier grade NAT
  { start: '127.0.0.0', end: '127.255.255.255' }, // Loopback
  { start: '169.254.0.0', end: '169.254.255.255' }, // Link‑local / Cloud Metadata
  { start: '172.16.0.0', end: '172.31.255.255' }, // RFC 1918 Private
  { start: '192.0.0.0', end: '192.0.0.255' }, // IETF Protocol
  { start: '192.168.0.0', end: '192.168.255.255' }, // RFC 1918 Private
  { start: '198.18.0.0', end: '198.19.255.255' }, // Benchmark
  { start: '224.0.0.0', end: '239.255.255.255' }, // Multicast
  { start: '240.0.0.0', end: '255.255.255.255' } // Future/Broadcast
];

// List of prohibited IPv6 prefixes (loopback, link‑local, unique‑local, IPv4-mapped, etc.)
const prohibitedIPv6Prefixes = [
  '::', // Unspecified
  '::1', // Loopback
  'fe80::', // Link‑local
  'fc00::', // Unique local (private)
  'fd00::', // Unique local (private)
  '::ffff:0:0', // IPv4 mapped
  '64:ff9b::' // NAT64
];

const prohibitedHostnames = [
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '127.0.0.1',
  'metadata.google.internal',
  'metadata.internal',
  'metadata.azure.com',
  '169.254.169.254',
  'instance-data',
  'internal',
  'intranet'
];

function ipToLong(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function isIpInRange(ip, range) {
  const ipNum = ipToLong(ip);
  const start = ipToLong(range.start);
  const end = ipToLong(range.end);
  return ipNum >= start && ipNum <= end;
}

function isPrivateIpv4(ip) {
  return prohibitedIPv4Ranges.some(r => isIpInRange(ip, r));
}

function isProhibitedIpv6(address) {
  const lower = address.toLowerCase();
  // Check IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (lower.startsWith('::ffff:')) {
    const v4Part = lower.replace('::ffff:', '');
    if (net.isIPv4(v4Part)) {
      return isPrivateIpv4(v4Part);
    }
  }

  // Check NAT64 prefix 64:ff9b::/96
  if (lower.startsWith('64:ff9b::')) {
    const suffix = lower.replace('64:ff9b::', '');
    if (net.isIPv4(suffix)) {
      return isPrivateIpv4(suffix);
    }
    const parts = suffix.split(':');
    if (parts.length === 2) {
      const p1 = parseInt(parts[0], 16);
      const p2 = parseInt(parts[1], 16);
      if (!isNaN(p1) && !isNaN(p2)) {
        const ipv4 = [ (p1 >> 8) & 0xff, p1 & 0xff, (p2 >> 8) & 0xff, p2 & 0xff ].join('.');
        return isPrivateIpv4(ipv4);
      }
    }
  }

  const standardPrefixes = [
    '::', // Unspecified
    '::1', // Loopback
    'fe80::', // Link‑local
    'fc00::', // Unique local (private)
    'fd00::' // Unique local (private)
  ];
  return standardPrefixes.some(prefix => lower.startsWith(prefix));
}

/**
 * Validate that a URL is safe for outbound requests.
 * Only http/https protocols are allowed. Hostnames that resolve to private, loopback, or metadata
 * addresses are rejected.
 * @param {string} urlString - The URL to validate.
 * @param {object} [options] - Optional validation flags.
 * @param {boolean} [options.allowLocal] - Explicitly allow loopback addresses for local mock testing.
 * @throws {Error} when the URL is disallowed or malformed.
 */
async function validateUrl(urlString, options = {}) {
  let url;
  try {
    url = new URL(urlString);
  } catch (_) {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Unsupported protocol: only http and https are allowed.');
  }

  const hostname = url.hostname.toLowerCase();

  // 1. ALWAYS block cloud metadata endpoints under all conditions (even in test/mock mode)
  if (
    hostname === '169.254.169.254' ||
    hostname.startsWith('169.254.') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata.azure.com' ||
    hostname === 'instance-data'
  ) {
    throw new Error('Disallowed destination: access to cloud metadata services is forbidden.');
  }

  const isLocalAllowed = options.allowLocal !== undefined ? options.allowLocal : process.env.ALLOW_LOCAL_CONNECTORS === 'true';

  // 2. Block prohibited hostnames
  if (prohibitedHostnames.some(prohibited => hostname === prohibited || hostname.endsWith(`.${prohibited}`))) {
    if (isLocalAllowed && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return url;
    }
    throw new Error(`Disallowed destination hostname: ${hostname}`);
  }

  // 3. Direct IP checks
  const ipFamily = net.isIP(hostname);
  if (ipFamily === 4) {
    if (isLocalAllowed && hostname.startsWith('127.')) {
      return url;
    }
    if (isPrivateIpv4(hostname)) {
      throw new Error(`Disallowed destination IPv4 address: access to local/private network addresses is forbidden (${hostname})`);
    }
    return url;
  }
  if (ipFamily === 6) {
    if (isLocalAllowed && (hostname === '::1' || hostname === '0:0:0:0:0:0:0:1')) {
      return url;
    }
    if (isProhibitedIpv6(hostname)) {
      throw new Error(`Disallowed destination IPv6 address: access to local/private network addresses is forbidden (${hostname})`);
    }
    return url;
  }

  // 4. Resolve DNS and ensure none resolve to private, loopback, or metadata addresses
  let addresses = [];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (dnsErr) {
    throw new Error(`DNS resolution failed for hostname ${hostname}: ${dnsErr.message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`No IP addresses resolved for hostname: ${hostname}`);
  }

  for (const { address, family } of addresses) {
    if (address === '169.254.169.254' || address.startsWith('169.254.')) {
      throw new Error('Resolved destination is a forbidden cloud metadata service.');
    }
    if (family === 4) {
      if (isLocalAllowed && address.startsWith('127.')) {
        continue;
      }
      if (isPrivateIpv4(address)) {
        throw new Error(`Resolved destination IPv4 address is private/internal: ${address}`);
      }
    }
    if (family === 6) {
      if (isLocalAllowed && (address === '::1' || address === '0:0:0:0:0:0:0:1')) {
        continue;
      }
      if (isProhibitedIpv6(address)) {
        throw new Error(`Resolved destination IPv6 address is prohibited: ${address}`);
      }
    }
  }

  return url;
}

/**
 * Validate redirect destination relative to original URL
 * Revalidates against SSRF checks before following redirects
 * @param {string} locationHeader
 * @param {string} currentUrl
 * @returns {Promise<string>} Validated resolved URL string
 */
async function validateRedirectUrl(locationHeader, currentUrl) {
  if (!locationHeader) {
    throw new Error('Empty redirect Location header received.');
  }

  let resolvedUrl;
  try {
    resolvedUrl = new URL(locationHeader, currentUrl).toString();
  } catch (_) {
    throw new Error(`Invalid redirect Location format: ${locationHeader}`);
  }

  await validateUrl(resolvedUrl);
  return resolvedUrl;
}

module.exports = {
  validateUrl,
  validateRedirectUrl,
  isPrivateIpv4,
  isProhibitedIpv6
};
