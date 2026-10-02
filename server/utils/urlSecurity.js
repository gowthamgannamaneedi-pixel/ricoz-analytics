const dns = require('dns').promises;
const net = require('net');

// List of prohibited IPv4 CIDR ranges (private, loopback, link‑local, metadata, etc.)
const prohibitedIPv4Ranges = [
  { start: '0.0.0.0', end: '0.0.0.0' }, // unspecified
  { start: '10.0.0.0', end: '10.255.255.255' }, // private
  { start: '127.0.0.0', end: '127.255.255.255' }, // loopback
  { start: '169.254.0.0', end: '169.254.255.255' }, // link‑local
  { start: '172.16.0.0', end: '172.31.255.255' }, // private
  { start: '192.168.0.0', end: '192.168.255.255' }, // private
  { start: '224.0.0.0', end: '239.255.255.255' }, // multicast (optional block)
  { start: '240.0.0.0', end: '255.255.255.254' } // reserved
];

// List of prohibited IPv6 prefixes (loopback, link‑local, unique‑local, etc.)
const prohibitedIPv6Prefixes = [
  '::1', // loopback
  'fe80::', // link‑local
  'fc00::', // unique local (private)
  'fd00::' // unique local (private)
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
  return prohibitedIPv6Prefixes.some(prefix => lower.startsWith(prefix));
}

/**
 * Validate that a URL is safe for outbound requests.
 * Only http/https protocols are allowed. Hostnames that resolve to private, loopback, or metadata
 * addresses are rejected. Redirects must be validated by callers before following them.
 * @param {string} urlString - The URL to validate.
 * @throws {Error} when the URL is disallowed or malformed.
 */
async function validateUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch (_) {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Unsupported protocol');
  }

  const hostname = url.hostname;

  // Block obvious internal hostnames
  const prohibitedHostnames = [
    'localhost',
    'localhost.localdomain',
    '0.0.0.0',
    '127.0.0.1',
    'metadata.google.internal',
    '169.254.169.254'
  ];
  if (prohibitedHostnames.includes(hostname.toLowerCase())) {
    throw new Error('Disallowed hostname');
  }

  // Direct IP checks
  const ipFamily = net.isIP(hostname);
  if (ipFamily === 4 && isPrivateIpv4(hostname)) {
    throw new Error('Disallowed IPv4 address');
  }
  if (ipFamily === 6 && isProhibitedIpv6(hostname)) {
    throw new Error('Disallowed IPv6 address');
  }
  if (ipFamily) {
    // Public IP – allowed
    return;
  }

  // Resolve DNS and ensure none resolve to private addresses
  const addresses = await dns.lookup(hostname, { all: true });
  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIpv4(address)) {
      throw new Error('Resolved IPv4 address is private');
    }
    if (family === 6 && isProhibitedIpv6(address)) {
      throw new Error('Resolved IPv6 address is prohibited');
    }
  }
}

module.exports = { validateUrl };
