const { MongoClient, ObjectId } = require('mongodb');
const { validateUrl } = require('../utils/urlSecurity');
const { maskUri } = require('./encryptionService');

/**
 * MongoDB Data Source Connector Service
 * Provides secure connection validation, collection discovery, schema inference,
 * and read-only streaming ingestion for MongoDB databases.
 */

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_PREVIEW_LIMIT = 50;

/**
 * Build a valid MongoDB connection string from configuration
 * @param {object} config
 * @returns {{ uri: string, databaseName: string }}
 */
function buildMongoUri(config = {}) {
  let uri = (config.uri || config.connectionString || '').trim();
  let databaseName = (config.database || config.db || config.databaseName || '').trim();

  if (uri) {
    try {
      const parsed = new URL(uri);
      const pathname = parsed.pathname.replace(/^\//, '');
      if (pathname && !databaseName) {
        databaseName = pathname;
      }
    } catch (_) {}
    return { uri, databaseName: databaseName || 'test' };
  }

  // Construct from discrete fields
  const rawHost = (config.host || '').trim();
  if (!rawHost) {
    throw new Error('MongoDB connection requires a valid host or connection URI.');
  }

  const host = rawHost;
  const port = Number(config.port) || 27017;
  const user = config.user ? encodeURIComponent(config.user.trim()) : '';
  const password = config.password ? encodeURIComponent(config.password) : '';
  const authSource = config.authSource ? `?authSource=${encodeURIComponent(config.authSource.trim())}` : '';
  const isSrv = Boolean(config.srv);
  const sslParam = config.ssl ? `${authSource ? '&' : '?'}tls=true` : '';

  const authPart = user && password ? `${user}:${password}@` : (user ? `${user}@` : '');
  const protocol = isSrv ? 'mongodb+srv' : 'mongodb';
  const portPart = isSrv ? '' : `:${port}`;

  databaseName = databaseName || 'admin';
  uri = `${protocol}://${authPart}${host}${portPart}/${databaseName}${authSource}${sslParam}`;

  return { uri, databaseName };
}

/**
 * Validate MongoDB host against SSRF protection
 * @param {string} uri
 */
async function validateMongoHost(uri) {
  try {
    const parsed = new URL(uri);
    const hostnames = (parsed.host || parsed.hostname || '').split(','); // Handles replica set hosts
    for (const hostWithPort of hostnames) {
      const hostOnly = hostWithPort.split(':')[0];
      if (hostOnly) {
        await validateUrl(`http://${hostOnly}`, { allowLocal: false });
      }
    }
  } catch (err) {
    if (
      err.message &&
      (err.message.includes('Disallowed') ||
        err.message.includes('private') ||
        err.message.includes('forbidden') ||
        err.message.includes('prohibited') ||
        err.message.includes('metadata'))
    ) {
      throw new Error(`MongoDB connection rejected: ${err.message}`);
    }
    // Re-throw if error was from validateUrl
    if (err.message && err.message.startsWith('Invalid URL')) {
      throw err;
    }
  }
}

/**
 * Convert MongoDB BSON document to standard JSON-serializable object
 * Converts ObjectId -> string, Date -> ISO string, Decimal128 -> number/string
 * @param {any} val
 * @returns {any}
 */
function sanitizeBsonValue(val) {
  if (val === null || val === undefined) return val;

  // Handle ObjectId
  if (val instanceof ObjectId || (val && val._bsontype === 'ObjectID') || (val && typeof val.toHexString === 'function')) {
    return val.toString();
  }

  // Handle Date
  if (val instanceof Date) {
    return val.toISOString();
  }

  // Handle Decimal128 / Long / Int32 / Double
  if (val && typeof val === 'object') {
    if (val._bsontype === 'Decimal128') {
      return parseFloat(val.toString());
    }
    if (val._bsontype === 'Long') {
      return val.toNumber ? val.toNumber() : val.toString();
    }
    if (val._bsontype === 'Binary') {
      return val.toString('base64');
    }
    if (Array.isArray(val)) {
      return val.map(sanitizeBsonValue);
    }
    const cleanObj = {};
    for (const [k, v] of Object.entries(val)) {
      cleanObj[k] = sanitizeBsonValue(v);
    }
    return cleanObj;
  }

  return val;
}

/**
 * Infer schema (columns and types) from a sample array of documents
 * @param {Array<object>} documents
 * @returns {Array<{ name: string, type: string, nullable: boolean }>}
 */
function inferMongoSchema(documents = []) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  const fieldTypes = new Map();
  const fieldNullCount = new Map();

  for (const doc of documents) {
    if (!doc || typeof doc !== 'object') continue;
    for (const [key, val] of Object.entries(doc)) {
      if (!fieldTypes.has(key)) {
        fieldTypes.set(key, new Set());
        fieldNullCount.set(key, 0);
      }
      if (val === null || val === undefined) {
        fieldNullCount.set(key, fieldNullCount.get(key) + 1);
      } else if (typeof val === 'number') {
        fieldTypes.get(key).add(Number.isInteger(val) ? 'integer' : 'float');
      } else if (typeof val === 'boolean') {
        fieldTypes.get(key).add('boolean');
      } else if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
        fieldTypes.get(key).add('date');
      } else if (Array.isArray(val)) {
        fieldTypes.get(key).add('array');
      } else if (typeof val === 'object') {
        fieldTypes.get(key).add('object');
      } else {
        fieldTypes.get(key).add('string');
      }
    }
  }

  return Array.from(fieldTypes.entries()).map(([name, typeSet]) => {
    let type = 'string';
    if (typeSet.has('float')) type = 'float';
    else if (typeSet.has('integer')) type = 'integer';
    else if (typeSet.has('boolean') && typeSet.size === 1) type = 'boolean';
    else if (typeSet.has('date') && typeSet.size === 1) type = 'date';
    else if (typeSet.has('array') && typeSet.size === 1) type = 'array';
    else if (typeSet.has('object') && typeSet.size === 1) type = 'object';

    return {
      name,
      type,
      nullable: (fieldNullCount.get(name) || 0) > 0 || fieldTypes.size > documents.length
    };
  });
}

/**
 * Test connection to MongoDB and retrieve database collections
 * @param {object} config
 * @returns {Promise<{ success: boolean, message: string, database?: string, collections?: string[] }>}
 */
async function testMongoConnection(config = {}) {
  let client = null;
  try {
    const { uri, databaseName } = buildMongoUri(config);
    await validateMongoHost(uri);

    const timeoutMs = Number(config.connectTimeoutMS || config.timeoutMs) || DEFAULT_TIMEOUT_MS;
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: timeoutMs,
      connectTimeoutMS: timeoutMs,
      tls: Boolean(config.ssl || config.tls),
      tlsAllowInvalidCertificates: Boolean(config.allowInvalidCertificates)
    });

    await client.connect();
    const db = client.db(databaseName);

    // Verify ping and list collections
    await db.command({ ping: 1 });
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name).filter(n => !n.startsWith('system.'));

    return {
      success: true,
      message: `Successfully connected to MongoDB database '${databaseName}'. Found ${collectionNames.length} collections.`,
      database: databaseName,
      collections: collectionNames
    };
  } catch (err) {
    let code = 'ERROR';
    if (
      err.message &&
      (err.message.includes('SSRF') ||
        err.message.includes('Disallowed') ||
        err.message.includes('rejected') ||
        err.message.includes('metadata') ||
        err.message.includes('private') ||
        err.message.includes('forbidden') ||
        err.message.includes('prohibited'))
    ) {
      code = 'SSRF_BLOCKED';
    } else if (
      err.message &&
      (err.message.toLowerCase().includes('require') ||
        err.message.includes('Invalid') ||
        err.message.includes('format'))
    ) {
      code = 'INVALID_CONFIG';
    } else if (
      err.message &&
      (err.message.includes('timed out') ||
        err.message.includes('Server selection timed out') ||
        err.message.includes('ETIMEDOUT') ||
        err.message.includes('timeout'))
    ) {
      code = 'CONNECTION_TIMEOUT';
    } else if (
      err.message &&
      (err.message.includes('ENOTFOUND') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('unreachable') ||
        err.message.includes('EHOSTUNREACH'))
    ) {
      code = 'UNREACHABLE_HOST';
    } else if (
      err.message &&
      (err.message.includes('auth') ||
        err.message.includes('Authentication failed') ||
        err.message.includes('bad auth'))
    ) {
      code = 'AUTH_FAILED';
    }

    return {
      success: false,
      code,
      message: err.message || 'MongoDB connection failed.'
    };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (_) {}
    }
  }
}

/**
 * Sample documents from a MongoDB collection to preview data and infer schema
 * @param {object} config
 * @param {string} collectionName
 * @param {number} [sampleLimit=10]
 * @returns {Promise<{ success: boolean, count: number, schema: Array<any>, preview: Array<any> }>}
 */
async function previewMongoCollection(config = {}, collectionName, sampleLimit = 10) {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('Collection name is required for preview.');
  }

  const { uri, databaseName } = buildMongoUri(config);
  await validateMongoHost(uri);

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: DEFAULT_TIMEOUT_MS,
    connectTimeoutMS: DEFAULT_TIMEOUT_MS,
    tls: Boolean(config.ssl || config.tls)
  });

  try {
    await client.connect();
    const db = client.db(databaseName);
    const collection = db.collection(collectionName);

    const totalEstimate = await collection.estimatedDocumentCount().catch(() => 0);
    const docs = await collection.find({}).limit(Math.min(sampleLimit, MAX_PREVIEW_LIMIT)).toArray();
    const cleanDocs = docs.map(sanitizeBsonValue);
    const schema = inferMongoSchema(cleanDocs);

    return {
      success: true,
      collection: collectionName,
      estimatedTotal: totalEstimate,
      recordCount: cleanDocs.length,
      schema,
      preview: cleanDocs
    };
  } finally {
    try {
      await client.close();
    } catch (_) {}
  }
}

/**
 * Ingest documents from MongoDB collection with cursor streaming
 * @param {object} config
 * @param {string} collectionName
 * @param {{ limit?: number, batchSize?: number }} [options={}]
 * @returns {Promise<{ records: Array<object>, rowCount: number, schema: Array<object> }>}
 */
async function ingestMongoCollection(config = {}, collectionName, options = {}) {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('Collection name is required for ingestion.');
  }

  const { uri, databaseName } = buildMongoUri(config);
  await validateMongoHost(uri);

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: DEFAULT_TIMEOUT_MS,
    connectTimeoutMS: DEFAULT_TIMEOUT_MS,
    tls: Boolean(config.ssl || config.tls)
  });

  const maxLimit = options.limit || 50000;
  const batchSize = options.batchSize || 1000;

  try {
    await client.connect();
    const db = client.db(databaseName);
    const collection = db.collection(collectionName);

    const records = [];
    const cursor = collection.find({}).batchSize(batchSize).limit(maxLimit);

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (doc) {
        records.push(sanitizeBsonValue(doc));
      }
    }

    const schema = inferMongoSchema(records.slice(0, 50));

    return {
      records,
      rowCount: records.length,
      columnCount: schema.length,
      schema
    };
  } finally {
    try {
      await client.close();
    } catch (_) {}
  }
}

module.exports = {
  buildMongoUri,
  testMongoConnection,
  previewMongoCollection,
  ingestMongoCollection,
  inferMongoSchema,
  sanitizeBsonValue,
  sanitizeDoc: sanitizeBsonValue
};
