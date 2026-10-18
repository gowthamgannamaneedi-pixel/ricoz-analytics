const crypto = require('crypto');

/**
 * Enterprise Credential Encryption Service
 * Encrypts and decrypts external data source credentials at rest using AES-256-GCM
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const SALT = 'ricoz_credential_encryption_v1';

// Derive 256-bit encryption key
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'ricoz_default_enterprise_secure_key_2026';
  return crypto.scryptSync(secret, SALT, 32);
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param {string} text
 * @returns {string} Encrypted string format: "enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
function encryptText(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  if (text.startsWith('enc:v1:')) return text; // Already encrypted

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[EncryptionService] Encryption error:', err.message);
    throw new Error('Failed to encrypt credentials at rest.');
  }
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 * @param {string} cipherText
 * @returns {string} Decrypted plaintext string
 */
function decryptText(cipherText) {
  if (typeof cipherText !== 'string' || !cipherText.startsWith('enc:v1:')) {
    return cipherText; // Plaintext or unencrypted
  }

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 5) {
      throw new Error('Malformed encrypted credential payload');
    }

    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encryptedData = parts[4];

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[EncryptionService] Decryption error:', err.message);
    throw new Error('Failed to decrypt credentials.');
  }
}

/**
 * Recursively encrypt sensitive fields in a configuration object before database insertion/update
 * @param {object} config
 * @returns {object}
 */
function encryptConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const result = { ...config };

  const sensitiveKeys = [
    'password',
    'password_hash',
    'secret',
    'apiKey',
    'api_key',
    'token',
    'authToken',
    'auth_token',
    'bearerToken',
    'bearer_token',
    'privateKey',
    'client_secret'
  ];

  for (const key of sensitiveKeys) {
    if (typeof result[key] === 'string' && result[key].length > 0) {
      result[key] = encryptText(result[key]);
    }
  }

  // Encrypt URI if it contains embedded credentials
  if (typeof result.uri === 'string' && result.uri.includes('@')) {
    result.uri = encryptText(result.uri);
  }

  // Encrypt Authorization header if provided
  if (result.headers && typeof result.headers === 'object') {
    result.headers = { ...result.headers };
    for (const [headerName, headerVal] of Object.entries(result.headers)) {
      if (/authorization|api-key|x-api-key|token/i.test(headerName) && typeof headerVal === 'string') {
        result.headers[headerName] = encryptText(headerVal);
      }
    }
  }

  return result;
}

/**
 * Recursively decrypt sensitive fields in a configuration object for internal connector execution
 * @param {object} config
 * @returns {object}
 */
function decryptConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const result = { ...config };

  const sensitiveKeys = [
    'password',
    'secret',
    'apiKey',
    'api_key',
    'token',
    'authToken',
    'auth_token',
    'bearerToken',
    'bearer_token',
    'privateKey',
    'client_secret',
    'uri'
  ];

  for (const key of sensitiveKeys) {
    if (typeof result[key] === 'string' && result[key].startsWith('enc:v1:')) {
      result[key] = decryptText(result[key]);
    }
  }

  if (result.headers && typeof result.headers === 'object') {
    result.headers = { ...result.headers };
    for (const [headerName, headerVal] of Object.entries(result.headers)) {
      if (typeof headerVal === 'string' && headerVal.startsWith('enc:v1:')) {
        result.headers[headerName] = decryptText(headerVal);
      }
    }
  }

  return result;
}

/**
 * Mask a URI for safe presentation (hides credentials)
 * e.g., mongodb://user:pass@host:27017/db -> mongodb://user:***@host:27017/db
 * @param {string} uriString
 * @returns {string}
 */
function maskUri(uriString) {
  if (typeof uriString !== 'string' || !uriString) return '';
  const plain = uriString.startsWith('enc:v1:') ? decryptText(uriString) : uriString;
  try {
    const url = new URL(plain);
    if (url.password) url.password = '***';
    return url.toString();
  } catch (_) {
    return plain.replace(/:\/\/(.*?):(.*?)@/, '://$1:***@');
  }
}

/**
 * Sanitize any data source config for frontend transmission or logs
 * Removes all plaintext passwords, tokens, and raw credentials
 * @param {object} config
 * @returns {object}
 */
function sanitizeDataSourceConfig(config = {}) {
  if (!config || typeof config !== 'object') return {};

  const {
    password,
    password_hash,
    secret,
    apiKey,
    api_key,
    token,
    authToken,
    auth_token,
    bearerToken,
    bearer_token,
    privateKey,
    client_secret,
    uri,
    headers,
    ...safeConfig
  } = config;

  const hasPassword = Boolean(password);
  const hasAuthToken = Boolean(
    secret || apiKey || api_key || token || authToken || auth_token || bearerToken || bearer_token
  );

  let sanitizedHeaders = null;
  if (headers && typeof headers === 'object') {
    sanitizedHeaders = {};
    for (const [hKey, hVal] of Object.entries(headers)) {
      if (/authorization|api-key|x-api-key|token/i.test(hKey)) {
        sanitizedHeaders[hKey] = '******';
      } else {
        sanitizedHeaders[hKey] = hVal;
      }
    }
  }

  return {
    ...safeConfig,
    ...(uri ? { uri: maskUri(uri) } : {}),
    ...(sanitizedHeaders ? { headers: sanitizedHeaders } : {}),
    hasPassword,
    hasAuthToken
  };
}

module.exports = {
  encryptText,
  decryptText,
  encryptConfig,
  decryptConfig,
  maskUri,
  sanitizeDataSourceConfig
};
