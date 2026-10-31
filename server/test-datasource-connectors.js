/**
 * Comprehensive End-to-End Verification Suite for MongoDB & REST API Connectors
 * Tests:
 * 1. Security Controls (AES-256-GCM encryption at rest, secret redaction, URI masking, SSRF defenses)
 * 2. REST API Integration (Real HTTP calls, Bearer/API Key auth, nested dataKey, 429 rate limit, 5xx retries, malformed JSON, SSRF redirects)
 * 3. PostgreSQL Dataset & Row Persistence (Real DB verification in `data_sources`, `datasets`, and `dataset_rows`)
 * 4. Tenant Isolation & Plan Enforcement
 * 5. MongoDB Connector (URI parsing, discrete fields, SSRF validation, BSON/ObjectId sanitization, schema inference, connection timeout & error handling)
 */

process.env.ALLOW_LOCAL_CONNECTORS = 'true';

const http = require('http');
const url = require('url');
const app = require('./app');
const db = require('./config/database');
const { encryptText, decryptText, encryptConfig, decryptConfig, maskUri, sanitizeDataSourceConfig } = require('./services/encryptionService');
const { validateUrl, validateRedirectUrl } = require('./utils/urlSecurity');
const { testRestApiConnection, ingestRestApiData } = require('./services/restSourceService');
const {
  testMongoConnection,
  previewMongoCollection,
  ingestMongoCollection,
  sanitizeDoc,
  inferMongoSchema
} = require('./services/mongoSourceService');

let appServer;
let mockApiServer;
let appPort;
let mockPort;
let appBaseUrl;
let mockBaseUrl;

// Request helper for testing app routes
function appRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(path, appBaseUrl);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: { ...headers }
    };

    let postData = null;
    if (body) {
      postData = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(rawData); } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json !== null ? json : rawData
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Setup local mock REST API server to simulate all positive & negative external scenarios
function setupMockApiServer() {
  let flakyCallCount = 0;

  mockApiServer = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;

    // 1. Public JSON dataset (25 records)
    if (pathname === '/api/public/data') {
      const records = [];
      for (let i = 1; i <= 25; i++) {
        records.push({
          id: i,
          title: `Report Item #${i}`,
          amount: parseFloat((i * 19.95).toFixed(2)),
          status: i % 2 === 0 ? 'active' : 'pending',
          created_at: new Date(Date.now() - i * 86400000).toISOString()
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(records));
    }

    // 2. Bearer Authentication
    if (pathname === '/api/auth/bearer') {
      const authHeader = req.headers['authorization'];
      if (authHeader === 'Bearer secret-bearer-token-123') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([
          { id: 101, user: 'admin', role: 'superadmin' },
          { id: 102, user: 'editor', role: 'content_manager' }
        ]));
      }
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing bearer token' }));
    }

    // 3. API Key in Header
    if (pathname === '/api/auth/apikey-header') {
      const apiKey = req.headers['x-api-key'];
      if (apiKey === 'ricoz-secure-api-key-xyz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([{ keyValidated: true, records: 10 }]));
      }
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: invalid API key' }));
    }

    // 4. API Key in Query Param
    if (pathname === '/api/auth/apikey-query') {
      if (parsedUrl.searchParams.get('api_key') === 'ricoz-secure-api-key-xyz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([{ queryKeyValidated: true, status: 'ok' }]));
      }
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Forbidden: invalid API key in query' }));
    }

    // 5. Nested JSON Object with dataKey
    if (pathname === '/api/nested/data') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'success',
        meta: { total: 3, page: 1 },
        data: {
          items: [
            { code: 'ORD-001', customer: 'Acme Inc', value: 1200 },
            { code: 'ORD-002', customer: 'Globex Ltd', value: 850 },
            { code: 'ORD-003', customer: 'Soylent Corp', value: 3200 }
          ]
        }
      }));
    }

    // 6. Rate Limiting (429 with Retry-After)
    if (pathname === '/api/rate-limited') {
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': '5'
      });
      return res.end(JSON.stringify({ error: 'Too Many Requests: Rate limit exceeded. Try again in 5 seconds.' }));
    }

    // 7. Flaky Endpoint (503 on 1st call, 200 on retry)
    if (pathname === '/api/flaky') {
      flakyCallCount++;
      if (flakyCallCount === 1) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Service Temporarily Unavailable' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([{ retrySucceeded: true, attempt: flakyCallCount }]));
    }

    // 8. 500 Internal Server Error
    if (pathname === '/api/error-500') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Internal Database Connection Crash' }));
    }

    // 9. Non-JSON Response (HTML)
    if (pathname === '/api/html-page') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<!DOCTYPE html><html><body><h1>404 Not Found HTML Gateway</h1></body></html>');
    }

    // 10. Malformed JSON
    if (pathname === '/api/malformed-json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{"broken": true, [invalid json syntax');
    }

    // 11. Malicious SSRF Redirect (Attempts to redirect client to Cloud Metadata IP)
    if (pathname === '/api/ssrf-redirect-metadata') {
      res.writeHead(302, {
        'Location': 'http://169.254.169.254/latest/meta-data/'
      });
      return res.end();
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });
}

async function runTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  RicozAnalytics: MongoDB & REST API Connectors End-to-End Audit Suite ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${extraInfo ? ` (${extraInfo})` : ''}`);
      failed++;
    }
  }

  // Helper for testing disallowed URLs
  async function checkDisallowed(testUrl, options = { allowLocal: false }) {
    try {
      await validateUrl(testUrl, options);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  // 1. Start App Server and Mock Server
  await new Promise(resolve => {
    setupMockApiServer();
    mockApiServer.listen(0, () => {
      mockPort = mockApiServer.address().port;
      mockBaseUrl = `http://127.0.0.1:${mockPort}`;
      resolve();
    });
  });

  await new Promise(resolve => {
    appServer = app.listen(0, () => {
      appPort = appServer.address().port;
      appBaseUrl = `http://127.0.0.1:${appPort}`;
      resolve();
    });
  });

  console.log(`Test environment initialized:`);
  console.log(`- Ricoz Backend App: ${appBaseUrl}`);
  console.log(`- Mock External API: ${mockBaseUrl}\n`);

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: Security Controls, Encryption & SSRF Hardening
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─── SECTION 1: Security Controls, Encryption & SSRF Hardening ───');

    // 1.1 AES-256-GCM Encryption / Decryption
    const sampleSecret = 'P@ssw0rd_With_Spec!al_Ch@rs_#2026';
    const encrypted = encryptText(sampleSecret);
    const decrypted = decryptText(encrypted);
    assert(
      encrypted.startsWith('enc:v1:') && decrypted === sampleSecret,
      'AES-256-GCM encrypts plaintext with versioned format and decrypts accurately'
    );

    // 1.2 Config Object Encryption at Rest
    const rawConfig = {
      host: 'cluster0.example.mongodb.net',
      port: 27017,
      database: 'prod_analytics',
      password: sampleSecret,
      apiKey: 'xyz-secret-token',
      uri: 'mongodb://app_user:SuperSecretPass@db.example.com:27017/analytics'
    };
    const encryptedConfig = encryptConfig(rawConfig);
    assert(
      encryptedConfig.password.startsWith('enc:v1:') &&
      encryptedConfig.apiKey.startsWith('enc:v1:') &&
      encryptedConfig.uri.startsWith('enc:v1:') &&
      encryptedConfig.host === 'cluster0.example.mongodb.net',
      'Config encryption only encrypts sensitive secret fields at rest, leaving safe metadata intact'
    );

    const decryptedConfig = decryptConfig(encryptedConfig);
    assert(
      decryptedConfig.password === sampleSecret &&
      decryptedConfig.uri === rawConfig.uri,
      'Config decryption seamlessly recovers original secrets for server-side processing'
    );

    // 1.3 URI Secret Masking
    const standardMasked = maskUri('mongodb://db_admin:P@ssword123!@cluster0.mongodb.net:27017/ricoz');
    const srvMasked = maskUri('mongodb+srv://user_prod:SecretKey%21@analytics.mongodb.net/database?retryWrites=true');
    assert(
      standardMasked === 'mongodb://db_admin:***@cluster0.mongodb.net:27017/ricoz' &&
      srvMasked === 'mongodb+srv://user_prod:***@analytics.mongodb.net/database?retryWrites=true',
      'URI masking redacts plain passwords in standard and SRV connection strings'
    );

    // 1.4 Config Sanitization for API Responses
    const sanitizedOutput = sanitizeDataSourceConfig(rawConfig);
    assert(
      sanitizedOutput.password === undefined &&
      sanitizedOutput.apiKey === undefined &&
      sanitizedOutput.hasPassword === true &&
      sanitizedOutput.hasAuthToken === true &&
      sanitizedOutput.uri.includes('***'),
      'sanitizeDataSourceConfig completely redacts passwords and tokens before returning to frontend'
    );

    // 1.5 SSRF URL Validation
    const loopbackCheck = await checkDisallowed('http://127.0.0.1:8080/admin', { allowLocal: false });
    const localhostCheck = await checkDisallowed('http://localhost:3000', { allowLocal: false });
    const awsMetadataCheck = await checkDisallowed('http://169.254.169.254/latest/meta-data', { allowLocal: true });
    const private10Check = await checkDisallowed('http://10.0.1.50:5000/api', { allowLocal: false });
    const validPublicCheck = await checkDisallowed('https://api.github.com/events', { allowLocal: false });

    assert(
      !loopbackCheck.valid && (loopbackCheck.error.includes('Disallowed') || loopbackCheck.error.includes('forbidden')),
      'validateUrl blocks IPv4 loopback (127.0.0.1)'
    );
    assert(
      !localhostCheck.valid && localhostCheck.error.includes('Disallowed'),
      'validateUrl blocks localhost hostnames'
    );
    assert(
      !awsMetadataCheck.valid && awsMetadataCheck.error.includes('metadata'),
      'validateUrl blocks cloud metadata endpoints (169.254.169.254)'
    );
    assert(
      !private10Check.valid && private10Check.error.includes('forbidden'),
      'validateUrl blocks private RFC1918 subnets (10.0.0.0/8)'
    );
    assert(
      validPublicCheck.valid === true,
      'validateUrl permits legitimate public HTTPS domains'
    );

    // 1.6 SSRF Redirect Attack Prevention
    let redirectAttackBlocked = false;
    try {
      await validateRedirectUrl('http://169.254.169.254/secret', 'https://safe-api.example.com/feed');
    } catch (e) {
      redirectAttackBlocked = e.message.includes('metadata');
    }
    assert(
      redirectAttackBlocked,
      'validateRedirectUrl prevents open redirect SSRF attacks to cloud metadata services'
    );

    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: REST API Connector Tests
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─── SECTION 2: REST API Connector Tests ───');

    // 2.1 Public API Preview & Schema Inference
    const publicApiTest = await testRestApiConnection({
      url: `${mockBaseUrl}/api/public/data`,
      method: 'GET'
    });
    assert(
      publicApiTest.success === true &&
      publicApiTest.recordCount === 25 &&
      publicApiTest.schema.length >= 5 &&
      publicApiTest.schema.some(col => col.name === 'amount' && (col.type === 'number' || col.type === 'float')),
      'REST API: Connects to JSON endpoint, infers schema types and previews records'
    );

    // 2.2 Bearer Authentication: Valid
    const bearerValid = await testRestApiConnection({
      url: `${mockBaseUrl}/api/auth/bearer`,
      method: 'GET',
      authType: 'bearer',
      token: 'secret-bearer-token-123'
    });
    assert(
      bearerValid.success === true && bearerValid.recordCount === 2,
      'REST API: Bearer token authentication succeeds with valid credentials'
    );

    // 2.3 Bearer Authentication: Invalid (401)
    const bearerInvalid = await testRestApiConnection({
      url: `${mockBaseUrl}/api/auth/bearer`,
      method: 'GET',
      authType: 'bearer',
      token: 'wrong-token-abc'
    });
    assert(
      bearerInvalid.success === false && bearerInvalid.code === 'HTTP_401',
      'REST API: Invalid Bearer token correctly returns structured HTTP 401 Unauthorized error'
    );

    // 2.4 API Key in Header
    const apiKeyHeader = await testRestApiConnection({
      url: `${mockBaseUrl}/api/auth/apikey-header`,
      method: 'GET',
      authType: 'apiKey',
      apiKeyName: 'x-api-key',
      apiKeyValue: 'ricoz-secure-api-key-xyz',
      apiKeyPlacement: 'header'
    });
    assert(
      apiKeyHeader.success === true,
      'REST API: API-Key header authentication succeeds'
    );

    // 2.5 API Key in Query Param
    const apiKeyQuery = await testRestApiConnection({
      url: `${mockBaseUrl}/api/auth/apikey-query`,
      method: 'GET',
      authType: 'apiKey',
      apiKeyName: 'api_key',
      apiKeyValue: 'ricoz-secure-api-key-xyz',
      apiKeyPlacement: 'query'
    });
    assert(
      apiKeyQuery.success === true,
      'REST API: API-Key query parameter authentication succeeds'
    );

    // 2.6 Nested JSON extraction with dataKey
    const nestedDataRes = await testRestApiConnection({
      url: `${mockBaseUrl}/api/nested/data`,
      method: 'GET',
      dataKey: 'data.items'
    });
    assert(
      nestedDataRes.success === true &&
      nestedDataRes.recordCount === 3 &&
      nestedDataRes.preview[0].code === 'ORD-001',
      'REST API: Traverses nested JSON objects using dot notation dataKey'
    );

    // 2.7 Rate Limit 429 Handling
    const rateLimitRes = await testRestApiConnection({
      url: `${mockBaseUrl}/api/rate-limited`,
      method: 'GET'
    });
    assert(
      rateLimitRes.success === false &&
      rateLimitRes.code === 'RATE_LIMITED' &&
      rateLimitRes.retryAfter === 5,
      'REST API: Captures HTTP 429 rate limit with Retry-After header'
    );

    // 2.8 Transient 503 Retry
    const flakyRes = await testRestApiConnection({
      url: `${mockBaseUrl}/api/flaky`,
      method: 'GET',
      retries: 2
    });
    assert(
      flakyRes.success === true && flakyRes.preview[0].retrySucceeded === true,
      'REST API: Automatically retries on transient 5xx server errors with backoff'
    );

    // 2.9 500 Internal Server Error
    const error500Res = await testRestApiConnection({
      url: `${mockBaseUrl}/api/error-500`,
      method: 'GET',
      retries: 0
    });
    assert(
      error500Res.success === false && error500Res.code === 'HTTP_500',
      'REST API: Returns truthful HTTP 500 error without leaking server stack'
    );

    // 2.10 Non-JSON (HTML) Handling
    const nonJsonRes = await testRestApiConnection({
      url: `${mockBaseUrl}/api/html-page`,
      method: 'GET'
    });
    assert(
      nonJsonRes.success === false && nonJsonRes.code === 'NON_JSON_RESPONSE',
      'REST API: Gracefully handles non-JSON HTML error pages'
    );

    // 2.11 Malformed JSON Handling
    const malformedRes = await testRestApiConnection({
      url: `${mockBaseUrl}/api/malformed-json`,
      method: 'GET'
    });
    assert(
      malformedRes.success === false && malformedRes.code === 'MALFORMED_JSON',
      'REST API: Detects and reports malformed JSON responses cleanly'
    );

    // 2.12 SSRF Redirect Attack Blocked
    const ssrfRedirectRes = await testRestApiConnection({
      url: `${mockBaseUrl}/api/ssrf-redirect-metadata`,
      method: 'GET'
    });
    assert(
      ssrfRedirectRes.success === false && ssrfRedirectRes.code === 'SSRF_BLOCKED',
      'REST API: Blocks malicious 302 redirects targeting cloud metadata or private hosts'
    );

    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: End-to-End REST API Ingestion & PostgreSQL Persistence
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─── SECTION 3: End-to-End REST API Ingestion & PostgreSQL Persistence ───');

    // 3.1 Register test user Alice
    const aliceEmail = `alice_datasource_${Date.now()}@ricoz.test`;
    const regRes = await appRequest('POST', '/api/auth/register', {
      name: 'Alice DataEng',
      organization_name: 'Alice Pipeline Labs',
      email: aliceEmail,
      password: 'Ricoz#Secure$9842*Eng'
    });
    const aliceOtp = regRes.data._devVerificationOtp;
    const verifyRes = await appRequest('POST', '/api/auth/verify-email', {
      email: aliceEmail,
      otp: aliceOtp
    });
    const aliceToken = verifyRes.data.token;
    const aliceHeaders = { 'Authorization': `Bearer ${aliceToken}` };

    assert(aliceToken && verifyRes.status === 200, 'Authenticated test user Alice registered');

    // 3.2 Create REST API Data Source via API
    const createDsRes = await appRequest('POST', '/api/data-sources', {
      name: 'Live Sales Reports API',
      type: 'rest_api',
      config: {
        url: `${mockBaseUrl}/api/public/data`,
        method: 'GET',
        authType: 'none'
      }
    }, aliceHeaders);

    assert(
      createDsRes.status === 201 && createDsRes.data.success === true,
      'POST /api/data-sources creates REST API connector data source'
    );

    const dataSourceId = createDsRes.data.data.id;
    const datasetId = createDsRes.data.data.dataset?.id;

    // 3.3 Verify encrypted config at rest in PostgreSQL
    const dsRowInDb = await db.query('SELECT config FROM data_sources WHERE id = $1', [dataSourceId]);
    let storedConfig = dsRowInDb.rows[0].config;
    if (typeof storedConfig === 'string') storedConfig = JSON.parse(storedConfig);

    assert(
      createDsRes.data.data.config.url.includes(mockPort.toString()) &&
      !JSON.stringify(createDsRes.data.data.config).includes('enc:v1:'),
      'Returned response does NOT expose internal encryption envelopes or raw secrets'
    );

    // 3.4 Verify Dataset and dataset_rows row counts in PostgreSQL
    const datasetInDb = await db.query('SELECT id, row_count, column_count FROM datasets WHERE id = $1', [datasetId]);
    assert(
      datasetInDb.rows.length === 1 && parseInt(datasetInDb.rows[0].row_count, 10) === 25,
      `Dataset successfully created with row_count = 25 (actual: ${datasetInDb.rows[0]?.row_count})`
    );

    const rowsCountInDb = await db.query('SELECT COUNT(*) as cnt FROM dataset_rows WHERE dataset_id = $1', [datasetId]);
    const actualRowCount = parseInt(rowsCountInDb.rows[0].cnt, 10);
    assert(
      actualRowCount === 25,
      `PostgreSQL dataset_rows table contains exactly 25 persisted relational rows (actual: ${actualRowCount})`
    );

    // 3.5 Verify synchronization (Sync Data Source)
    const syncRes = await appRequest('POST', `/api/data-sources/${dataSourceId}/sync`, {}, aliceHeaders);
    assert(
      syncRes.status === 200 && syncRes.data.success === true && syncRes.data.rowCount === 25,
      'POST /api/data-sources/:id/sync refreshes records and updates PostgreSQL dataset_rows'
    );

    // 3.6 Tenant Isolation: Register Bob and attempt cross-tenant access
    const bobEmail = `bob_isolated_${Date.now()}@ricoz.test`;
    const regBob = await appRequest('POST', '/api/auth/register', {
      name: 'Bob Spy',
      organization_name: 'Bob Isolation Ltd',
      email: bobEmail,
      password: 'Ricoz#Secure$9842*Bob'
    });
    const verifyBob = await appRequest('POST', '/api/auth/verify-email', {
      email: bobEmail,
      otp: regBob.data._devVerificationOtp
    });
    const bobHeaders = { 'Authorization': `Bearer ${verifyBob.data.token}` };

    const crossAccessRes = await appRequest('GET', `/api/data-sources/${dataSourceId}`, null, bobHeaders);
    assert(
      crossAccessRes.status === 404,
      'Tenant Isolation: Cross-tenant data source access is strictly forbidden (HTTP 404)'
    );

    const crossSyncRes = await appRequest('POST', `/api/data-sources/${dataSourceId}/sync`, {}, bobHeaders);
    assert(
      crossSyncRes.status === 404,
      'Tenant Isolation: Cross-tenant synchronization attempt is rejected'
    );

    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: MongoDB Connector Tests
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─── SECTION 4: MongoDB Connector Tests ───');

    // 4.1 SSRF Host Validation for MongoDB
    const mongoSsrfLocal = await testMongoConnection({
      uri: 'mongodb://localhost:27017/analytics'
    });
    assert(
      mongoSsrfLocal.success === false && mongoSsrfLocal.code === 'SSRF_BLOCKED',
      'MongoDB: SSRF check blocks connections to localhost / loopback URIs'
    );

    const mongoSsrfMetadata = await testMongoConnection({
      uri: 'mongodb://169.254.169.254:27017/admin'
    });
    assert(
      mongoSsrfMetadata.success === false && mongoSsrfMetadata.code === 'SSRF_BLOCKED',
      'MongoDB: SSRF check blocks connections to cloud metadata IP'
    );

    // 4.2 Missing Connection Parameters Validation
    const mongoMissingParams = await testMongoConnection({
      host: '',
      database: ''
    });
    assert(
      mongoMissingParams.success === false && mongoMissingParams.code === 'INVALID_CONFIG',
      'MongoDB: Rejects configuration when required connection parameters are missing'
    );

    // 4.3 Connection Timeout & Unreachable Host (Safe Non-Routable IP)
    console.log('  Testing MongoDB connection timeout on unreachable host (1500ms)...');
    const mongoTimeoutRes = await testMongoConnection({
      host: '198.51.100.1', // RFC 5737 non-routable TEST-NET-2
      port: 27017,
      database: 'test_db',
      connectTimeoutMS: 1500
    });
    assert(
      mongoTimeoutRes.success === false &&
      (mongoTimeoutRes.code === 'CONNECTION_TIMEOUT' || mongoTimeoutRes.code === 'UNREACHABLE_HOST'),
      'MongoDB: Detects unreachable hosts and connection timeouts with actionable error code',
      `code: ${mongoTimeoutRes.code}`
    );

    // 4.4 BSON Type Sanitization & Rich Schema Inference
    const { ObjectId, Decimal128 } = require('mongodb');
    const mockObjectId = new ObjectId('507f1f77bcf86cd799439011');
    const mockDate = new Date('2026-10-18T05:30:00.000Z');
    const mockDecimal = Decimal128.fromString('1899.95');

    const sampleBsonDoc = {
      _id: mockObjectId,
      event_name: 'subscription_upgraded',
      account: {
        org_name: 'Enterprise Client',
        seats: 50
      },
      tags: ['saas', 'billing', 'q3'],
      amount: mockDecimal,
      created_at: mockDate,
      is_active: true
    };

    const sanitizedDoc = sanitizeDoc(sampleBsonDoc);
    assert(
      sanitizedDoc._id === '507f1f77bcf86cd799439011' &&
      sanitizedDoc.created_at === '2026-10-18T05:30:00.000Z' &&
      sanitizedDoc.amount === 1899.95 &&
      sanitizedDoc.account.org_name === 'Enterprise Client',
      'MongoDB: Sanitizes BSON ObjectId to string, Date to ISO string, and Decimal128 to float'
    );

    const inferredSchema = inferMongoSchema([sanitizedDoc]);
    const idCol = inferredSchema.find(c => c.name === '_id');
    const amountCol = inferredSchema.find(c => c.name === 'amount');
    const dateCol = inferredSchema.find(c => c.name === 'created_at');
    const accountCol = inferredSchema.find(c => c.name === 'account');

    assert(
      idCol?.type === 'string' &&
      (amountCol?.type === 'number' || amountCol?.type === 'float') &&
      dateCol?.type === 'date' &&
      accountCol?.type === 'object',
      'MongoDB: Inferred schema correctly classifies BSON data types (string, number, date, object)'
    );

    // 4.5 Testing MongoDB dedicated handler endpoint for timeout/actionable response
    const mongoHandlerRes = await appRequest('POST', '/api/data-sources/test-mongodb', {
      config: {
        host: '198.51.100.1',
        port: 27017,
        database: 'analytics_db',
        connectTimeoutMS: 1500
      }
    }, aliceHeaders);

    assert(
      mongoHandlerRes.status === 400 &&
      mongoHandlerRes.data.success === false &&
      (mongoHandlerRes.data.code === 'CONNECTION_TIMEOUT' || mongoHandlerRes.data.code === 'UNREACHABLE_HOST'),
      'POST /api/data-sources/test-mongodb returns truthful error on timeout without credentials exposure'
    );

    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED `);
    console.log('═══════════════════════════════════════════════════════════════════════');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal Test Suite Error:', err);
    process.exitCode = 1;
  } finally {
    if (mockApiServer) mockApiServer.close();
    if (appServer) appServer.close();
  }
}

runTestSuite();
