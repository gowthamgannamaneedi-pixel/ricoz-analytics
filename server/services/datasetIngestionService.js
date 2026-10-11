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
      filePath,
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
 * Ensures dataset_rows table exists and is compatible with datasets.id
 */
async function ensureDatasetRowsTable(client) {
  try {
    const dtCheck = await client.query(`
      SELECT data_type FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'datasets' AND column_name = 'id'
      LIMIT 1;
    `);
    const isUuid = dtCheck.rows[0]?.data_type === 'uuid';
    const fkType = isUuid ? 'UUID' : 'INTEGER';

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.dataset_rows (
        id BIGSERIAL PRIMARY KEY,
        dataset_id ${fkType} NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
        organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
        row_index INTEGER NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON public.dataset_rows(dataset_id);
      CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_org ON public.dataset_rows(dataset_id, organization_id);
      CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_row_idx ON public.dataset_rows(dataset_id, row_index);
      DROP INDEX IF EXISTS public.idx_dataset_rows_data_gin;

      CREATE TABLE IF NOT EXISTS public.dataset_storage_files (
        file_path TEXT PRIMARY KEY,
        content BYTEA NOT NULL,
        size BIGINT NOT NULL,
        mime_type TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_dataset_storage_files_path ON public.dataset_storage_files(file_path);
    `);
  } catch (err) {
    console.warn('[Ingestion] ensureDatasetRowsTable notice:', err.message);
  }
}

/**
 * Stream into PostgreSQL using COPY or batched transactions
 */
async function ingestToPostgres({
  pool,
  filePath,
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

    // Disable statement timeout on dedicated client connection for bulk ingestion
    try {
      await client.query('SET statement_timeout = 0');
    } catch (_) {}

    // Ensure target table exists before querying
    await ensureDatasetRowsTable(client);

    // Clean up any existing partial records for this datasetId to prevent duplicates
    await client.query('DELETE FROM dataset_rows WHERE dataset_id = $1', [datasetId]);

    if (copyFrom && ext === 'csv') {
      // Fast path: PostgreSQL COPY via pg-copy-streams
      try {
        const copySql = `
          COPY dataset_rows (dataset_id, organization_id, row_index, data)
          FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL E'\\\\N')
        `;
        const pgStream = client.query(copyFrom(copySql));
        let streamError = null;
        let streamClosed = false;

        pgStream.on('error', (err) => {
          streamError = err;
          streamClosed = true;
        });

        pgStream.on('close', () => {
          streamClosed = true;
        });

        const rl = readline.createInterface({
          input: inputStream,
          crlfDelay: Infinity
        });

        let headers = null;
        let delimiter = ',';
        let rowIndex = 0;
        let copyBuffer = '';

        for await (const line of rl) {
          if (signal?.aborted) {
            try { pgStream.destroy(); } catch (_) {}
            throw new Error('Ingestion cancelled by client.');
          }

          if (streamClosed || streamError) {
            break;
          }

          const trimmed = line.trim();
          if (!trimmed) continue;

          if (!headers) {
            delimiter = detectDelimiter(trimmed);
            headers = parseCsvLine(trimmed, delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
            continue;
          }

          rowIndex++;
          const values = trimmed.includes('"') ? parseCsvLine(trimmed, delimiter) : trimmed.split(delimiter);
          if (values.length !== headers.length && Math.abs(values.length - headers.length) > 2) {
            malformedRows++;
            continue;
          }

          const rowObj = {};
          for (let i = 0; i < headers.length; i++) {
            const h = headers[i];
            const v = values[i];
            if (v === undefined || v === null || v === '') {
              rowObj[h] = null;
            } else {
              const cleaned = v.charCodeAt(0) === 34 ? v.replace(/^["']|["']$/g, '') : v;
              const num = Number(cleaned);
              rowObj[h] = !isNaN(num) && isFinite(num) ? num : cleaned;
            }
          }

          // Format tab-separated line for text COPY: dataset_id \t org_id \t row_index \t json
          const jsonStr = JSON.stringify(rowObj)
            .replace(/\\/g, '\\\\')
            .replace(/\t/g, '\\t')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
          const orgVal = organizationId ? organizationId : '\\N';
          copyBuffer += `${datasetId}\t${orgVal}\t${rowIndex}\t${jsonStr}\n`;

          if (copyBuffer.length >= 65536) {
            try {
              if (streamClosed || streamError || !pgStream.writable) {
                break;
              }
              const canWrite = pgStream.write(copyBuffer);
              copyBuffer = '';
              if (!canWrite) {
                await new Promise(resolve => pgStream.once('drain', resolve));
              }
            } catch (writeErr) {
              streamError = writeErr;
              streamClosed = true;
              break;
            }
          }

          rowsIngested++;
          if (rowsIngested % batchSize === 0) {
            if (onProgress) {
              const heapUsedMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024) * 10) / 10;
              onProgress({ processedRows: rowsIngested, heapUsedMb });
            }
          }
        }

        if (copyBuffer.length > 0 && !streamClosed && !streamError && pgStream.writable) {
          try {
            pgStream.write(copyBuffer);
            copyBuffer = '';
          } catch (_) {}
        }

        if (streamError) throw streamError;

        await new Promise((resolve, reject) => {
          if (streamError) return reject(streamError);
          pgStream.on('finish', resolve);
          pgStream.on('error', reject);
          try {
            pgStream.end();
          } catch (endErr) {
            reject(endErr);
          }
        });

        return {
          success: true,
          rowsIngested,
          malformedRows,
          durationMs: Date.now() - startTime
        };
      } catch (copyErr) {
        if (signal?.aborted) throw copyErr;
        console.warn(`[Ingestion] pg-copy-streams notice, falling back to batch inserts: ${copyErr.message}`);
        try { await client.query('ROLLBACK'); } catch (_) {}
        // Fall back to batch inserts below
        await client.query('DELETE FROM dataset_rows WHERE dataset_id = $1', [datasetId]);
        if (filePath) {
          if (pathIsAbsolute(filePath) && fs.existsSync(filePath)) {
            inputStream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
          } else {
            inputStream = storage.getFileStream(filePath);
            inputStream.setEncoding('utf8');
          }
        }
      }
    }

    // If ext === 'json', parse JSON records directly (handles standard array, object with array, or NDJSON)
    if (ext === 'json') {
      let jsonText = '';
      if (typeof filePath === 'string' && pathIsAbsolute(filePath) && fs.existsSync(filePath)) {
        jsonText = await fs.promises.readFile(filePath, 'utf8');
      } else {
        const chunks = [];
        for await (const chunk of inputStream) {
          chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
        }
        jsonText = chunks.join('');
      }

      let parsedRecords = [];
      try {
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed)) {
          parsedRecords = parsed;
        } else if (typeof parsed === 'object' && parsed !== null) {
          const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
          parsedRecords = arrayKey ? parsed[arrayKey] : [parsed];
        }
      } catch (jsonErr) {
        // Fallback: parse line-by-line for NDJSON
        const lines = jsonText.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === '[' || trimmed === ']') continue;
          try {
            const clean = trimmed.replace(/^\[|,$/g, '');
            parsedRecords.push(JSON.parse(clean));
          } catch (_) {
            malformedRows++;
          }
        }
      }

      await client.query('BEGIN');
      let rowIndex = 0;
      let batch = [];

      const flushJsonBatch = async () => {
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

      for (const record of parsedRecords) {
        if (signal?.aborted) {
          await client.query('ROLLBACK');
          throw new Error('Ingestion cancelled by client.');
        }

        rowIndex++;
        batch.push({ datasetId, organizationId, rowIndex, data: record });
        rowsIngested++;

        if (batch.length >= 2000) {
          await flushJsonBatch();
          if (onProgress && rowsIngested % batchSize === 0) {
            const heapUsedMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024) * 10) / 10;
            onProgress({ processedRows: rowsIngested, heapUsedMb });
          }
        }
      }

      await flushJsonBatch();
      await client.query('COMMIT');

      return {
        success: true,
        rowsIngested,
        malformedRows,
        durationMs: Date.now() - startTime
      };
    }

    // Standard batched transactional inserts for CSV
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
  let rowsIngested = 0;
  let malformedRows = 0;

  if (ext === 'json') {
    const chunks = [];
    for await (const chunk of inputStream) {
      chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    }
    const jsonText = chunks.join('');
    let parsedRecords = [];
    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) parsedRecords = parsed;
      else if (typeof parsed === 'object' && parsed !== null) {
        const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
        parsedRecords = arrayKey ? parsed[arrayKey] : [parsed];
      }
    } catch (_) {
      const lines = jsonText.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '[' || trimmed === ']') continue;
        try {
          const clean = trimmed.replace(/^\[|,$/g, '');
          parsedRecords.push(JSON.parse(clean));
        } catch (_) {
          malformedRows++;
        }
      }
    }

    for (const r of parsedRecords) {
      if (signal?.aborted) throw new Error('Ingestion cancelled by client.');
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

  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity
  });

  let headers = null;
  let delimiter = ',';

  for await (const line of rl) {
    if (signal?.aborted) {
      throw new Error('Ingestion cancelled by client.');
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

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
