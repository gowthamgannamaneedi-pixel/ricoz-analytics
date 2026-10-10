const fs = require('fs');
const readline = require('readline');
const { Readable } = require('stream');
const db = require('../config/database');
const storage = require('../storage');
const { parseCsvLine, detectDelimiter, inferValueType } = require('./fileParserService');

// Try loading pg-copy-streams if available
let copyFrom = null;
try {
  copyFrom = require('pg-copy-streams').from;
} catch (_) {
  copyFrom = null;
}

/**
 * Dataset Ingestion Engine Service
 * High-performance streaming ingestion for datasets up to 250 MB / 1M+ rows.
 * Supports:
 * - PostgreSQL COPY (via pg-copy-streams) with backpressure
 * - Parameterized chunked transactional inserts fallback
 * - Streaming line-by-line CSV / JSON parser with constant memory
 * - Cancellation via AbortSignal
 * - Progress tracking & error recovery
 */

/**
 * Ingest dataset file stream into PostgreSQL database / storage
 * @param {object} params
 * @param {number|string} params.datasetId
 * @param {string} [params.organizationId]
 * @param {string} params.filePath Physical or storage file path
 * @param {string} [params.fileExtension='csv']
 * @param {number} [params.batchSize=10000]
 * @param {Function} [params.onProgress] ({ processedRows, percent, heapUsedMb })
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ success: boolean, rowsIngested: number, durationMs: number, malformedRows: number }>}
 */
async function ingestDatasetFileStream({
  datasetId,
  organizationId = null,
  filePath,
  fileExtension = 'csv',
  batchSize = 10000,
  onProgress = null,
  signal = null
}) {
  const startTime = Date.now();
  const ext = (fileExtension || '').toLowerCase().replace('.', '');

  if (!filePath) {
    throw new Error('Dataset file path is required for ingestion.');
  }

  // Verify file existence
  let inputStream = null;
  if (pathIsAbsolute(filePath) && fs.existsSync(filePath)) {
    inputStream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
  } else {
    const exists = await storage.exists(filePath);
    if (!exists) {
      throw new Error(`Dataset file not found at storage path: ${filePath}`);
    }
    inputStream = storage.getFileStream(filePath);
    inputStream.setEncoding('utf8');
  }

  const pool = db.getPool();
  const usePostgres = !db.isUsingFallback() && pool !== null;

  if (usePostgres) {
    return await ingestToPostgres({
      pool,
      inputStream,
      datasetId,
      organizationId,
      ext,
      batchSize,
      onProgress,
      signal,
      startTime
    });
  } else {
    return await ingestStreamLocal({
      inputStream,
      datasetId,
      organizationId,
      ext,
      batchSize,
      onProgress,
      signal,
      startTime
    });
  }
}

/**
 * Helper to check absolute path across platforms
 */
function pathIsAbsolute(p) {
  if (typeof p !== 'string') return false;
  return p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p);
}

/**
 * Stream into PostgreSQL using COPY or batched transactions
 */
async function ingestToPostgres({
  pool,
  inputStream,
  datasetId,
  organizationId,
  ext,
  batchSize,
  onProgress,
  signal,
  startTime
}) {
  let client = null;
  let rowsIngested = 0;
  let malformedRows = 0;

  try {
    client = await pool.connect();

    // Clean up any existing partial records for this datasetId to prevent duplicates
    await client.query('DELETE FROM dataset_rows WHERE dataset_id = $1', [datasetId]);

    if (copyFrom && ext === 'csv') {
      // Fast path: PostgreSQL COPY via pg-copy-streams
      try {
        const copySql = `
          COPY dataset_rows (dataset_id, organization_id, row_index, data)
          FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', QUOTE E'\\b', ESCAPE '\\')
        `;
        const pgStream = client.query(copyFrom(copySql));

        const rl = readline.createInterface({
          input: inputStream,
          crlfDelay: Infinity
        });

        let headers = null;
        let delimiter = ',';
        let rowIndex = 0;

        for await (const line of rl) {
          if (signal?.aborted) {
            pgStream.destroy(new Error('Ingestion cancelled by client.'));
            throw new Error('Ingestion cancelled by client.');
          }

          const trimmed = line.trim();
          if (!trimmed) continue;

          if (!headers) {
            delimiter = detectDelimiter(trimmed);
            headers = parseCsvLine(trimmed, delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
            continue;
          }

          rowIndex++;
          const values = parseCsvLine(trimmed, delimiter);
          if (values.length !== headers.length && Math.abs(values.length - headers.length) > 2) {
            malformedRows++;
            continue;
          }

          const rowObj = {};
          for (let i = 0; i < headers.length; i++) {
            const h = headers[i];
            const v = values[i] !== undefined ? values[i] : null;
            rowObj[h] = v === null || v === '' ? null : normalizeParsedValue(v);
          }

          // Format tab-separated line for COPY: dataset_id \t org_id \t row_index \t json
          const jsonStr = JSON.stringify(rowObj).replace(/\\/g, '\\\\').replace(/\t/g, ' ').replace(/\n/g, ' ');
          const orgVal = organizationId ? organizationId : '';
          const copyLine = `${datasetId}\t${orgVal}\t${rowIndex}\t${jsonStr}\n`;

          const canWrite = pgStream.write(copyLine);
          if (!canWrite) {
            await new Promise(resolve => pgStream.once('drain', resolve));
          }

          rowsIngested++;
          if (rowsIngested % batchSize === 0) {
            if (onProgress) {
              const heapUsedMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024) * 10) / 10;
              onProgress({ processedRows: rowsIngested, heapUsedMb });
            }
          }
        }

        pgStream.end();
        await new Promise((resolve, reject) => {
          pgStream.on('finish', resolve);
          pgStream.on('error', reject);
        });

        return {
          success: true,
          rowsIngested,
          malformedRows,
          durationMs: Date.now() - startTime
        };
      } catch (copyErr) {
        if (signal?.aborted) throw copyErr;
        console.warn(`[Ingestion] pg-copy-streams error, falling back to batch inserts: ${copyErr.message}`);
        // Fall back to batch inserts below
        await client.query('DELETE FROM dataset_rows WHERE dataset_id = $1', [datasetId]);
      }
    }

    // Standard batched transactional inserts
    await client.query('BEGIN');
    const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

    let headers = null;
    let delimiter = ',';
    let rowIndex = 0;
    let batch = [];

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const valuesSql = [];
      const params = [];
      let paramIdx = 1;

      for (const item of batch) {
        valuesSql.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
        params.push(item.datasetId, item.organizationId, item.rowIndex, JSON.stringify(item.data));
      }

      const insertSql = `
        INSERT INTO dataset_rows (dataset_id, organization_id, row_index, data)
        VALUES ${valuesSql.join(', ')}
      `;
      await client.query(insertSql, params);
      batch = [];
    };

    for await (const line of rl) {
      if (signal?.aborted) {
        await client.query('ROLLBACK');
        throw new Error('Ingestion cancelled by client.');
      }

      const trimmed = line.trim();
      if (!trimmed) continue;

      if (ext === 'csv') {
        if (!headers) {
          delimiter = detectDelimiter(trimmed);
          headers = parseCsvLine(trimmed, delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
          continue;
        }

        rowIndex++;
        const values = parseCsvLine(trimmed, delimiter);
        if (values.length !== headers.length && Math.abs(values.length - headers.length) > 2) {
          malformedRows++;
          continue;
        }

        const rowObj = {};
        for (let i = 0; i < headers.length; i++) {
          rowObj[headers[i]] = normalizeParsedValue(values[i]);
        }

        batch.push({ datasetId, organizationId, rowIndex, data: rowObj });
      } else {
        // JSON or NDJSON line
        try {
          const cleanLine = trimmed.replace(/^\[|,$/g, '');
          if (!cleanLine || cleanLine === ']') continue;
          const parsed = JSON.parse(cleanLine);
          rowIndex++;
          batch.push({ datasetId, organizationId, rowIndex, data: parsed });
        } catch (_) {
          malformedRows++;
          continue;
        }
      }

      rowsIngested++;
      if (batch.length >= 2000) {
        await flushBatch();
        if (onProgress && rowsIngested % batchSize === 0) {
          const heapUsedMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024) * 10) / 10;
          onProgress({ processedRows: rowsIngested, heapUsedMb });
        }
      }
    }

    await flushBatch();
    await client.query('COMMIT');

    return {
      success: true,
      rowsIngested,
      malformedRows,
      durationMs: Date.now() - startTime
    };
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
        await client.query('DELETE FROM dataset_rows WHERE dataset_id = $1', [datasetId]);
      } catch (_) {}
    }
    throw err;
  } finally {
    if (client) client.release();
  }
}

/**
 * Local streaming validation & ingestion (fallback / disk-first mode)
 */
async function ingestStreamLocal({
  inputStream,
  datasetId,
  organizationId,
  ext,
  batchSize,
  onProgress,
  signal,
  startTime
}) {
  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity
  });

  let headers = null;
  let delimiter = ',';
  let rowsIngested = 0;
  let malformedRows = 0;

  for await (const line of rl) {
    if (signal?.aborted) {
      throw new Error('Ingestion cancelled by client.');
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (ext === 'csv') {
      if (!headers) {
        delimiter = detectDelimiter(trimmed);
        headers = parseCsvLine(trimmed, delimiter);
        continue;
      }
      const values = parseCsvLine(trimmed, delimiter);
      if (values.length !== headers.length && Math.abs(values.length - headers.length) > 2) {
        malformedRows++;
        continue;
      }
    } else {
      try {
        const cleanLine = trimmed.replace(/^\[|,$/g, '');
        if (!cleanLine || cleanLine === ']') continue;
        JSON.parse(cleanLine);
      } catch (_) {
        malformedRows++;
        continue;
      }
    }

    rowsIngested++;
    if (onProgress && rowsIngested % batchSize === 0) {
      const heapUsedMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024) * 10) / 10;
      onProgress({ processedRows: rowsIngested, heapUsedMb });
    }
  }

  return {
    success: true,
    rowsIngested,
    malformedRows,
    durationMs: Date.now() - startTime
  };
}

/**
 * Cast parsed strings to numbers or booleans when appropriate
 */
function normalizeParsedValue(val) {
  if (val === undefined || val === null || val === '') return null;
  const str = String(val).trim();
  if (str.toLowerCase() === 'true') return true;
  if (str.toLowerCase() === 'false') return false;
  if (!isNaN(str) && !isNaN(parseFloat(str)) && isFinite(str)) {
    return Number(str);
  }
  return str;
}

module.exports = {
  ingestDatasetFileStream,
  normalizeParsedValue
};
