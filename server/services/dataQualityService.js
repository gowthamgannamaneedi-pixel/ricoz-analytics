const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Readable } = require('stream');
const DataQualityModel = require('../models/dataQualityModel');
const DataQualityJobModel = require('../models/dataQualityJobModel');
const Dataset = require('../models/datasetModel');
const DatasetRelationshipModel = require('../models/datasetRelationshipModel');
const storage = require('../storage');
const auditService = require('./auditService');
const AlertModel = require('../models/alertModel');
const alertEvaluator = require('./alertEvaluatorService');
const config = require('../config');

// In-memory set of active job abort controllers for cancellation
const activeJobAbortControllers = new Map();

/**
 * Helper to parse a delimited CSV line into columns
 */
function parseCsvLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(line) {
  const commaCount = (line.match(/,/g) || []).length;
  const semiCount = (line.match(/;/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  let delimiter = ',';
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  return delimiter;
}

/**
 * Create a readable stream for a dataset file path
 */
async function getFileReadStream(filePath) {
  if (!filePath) {
    return Readable.from(['']);
  }
  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    return fs.createReadStream(filePath, { encoding: 'utf8' });
  }
  if (await storage.exists(filePath)) {
    const fileBuffer = await storage.readFile(filePath);
    return Readable.from([fileBuffer.toString('utf8')]);
  }
  if (fs.existsSync(filePath)) {
    return fs.createReadStream(filePath, { encoding: 'utf8' });
  }
  return Readable.from(['']);
}

/**
 * Data Quality & Observability Engine Service (Enterprise Edition)
 * Resilient, chunked, streaming evaluation across 7 dimensions with asynchronous job management.
 */
class DataQualityService {
  /**
   * Helper to compute a deterministic SHA-256 hash of dataset schema
   */
  computeSchemaHash(schema = []) {
    if (!Array.isArray(schema) || schema.length === 0) {
      return 'empty_schema';
    }
    const normalized = schema.map(col => ({
      name: String(col.name || '').trim().toLowerCase(),
      type: String(col.type || 'string').trim().toLowerCase()
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex').substring(0, 16);
  }

  /**
   * Start an asynchronous quality audit job
   */
  async startQualityAuditJob(datasetId, organizationId, options = {}) {
    const dataset = await Dataset.findByIdAndOrgId(datasetId, organizationId);
    if (!dataset) {
      const notFoundErr = new Error(`Dataset #${datasetId} not found or access denied.`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    const totalRows = Number(dataset.row_count || 0);
    const isSampled = Boolean(options.sampleSize) || options.scanMode === 'SAMPLED' || options.fullScan === false;
    const scanMode = isSampled ? 'SAMPLED' : 'FULL_SCAN';
    const sampleSize = isSampled
      ? (options.sampleSize ? Number(options.sampleSize) : config.qualitySampleSize || 10000)
      : null;

    // Concurrency limit check
    const maxConcurrent = config.qualityMaxConcurrentJobs || 2;
    const activeCount = await DataQualityJobModel.countActiveJobs();
    const initialStatus = activeCount >= maxConcurrent ? 'QUEUED' : 'RUNNING';

    const job = await DataQualityJobModel.createJob({
      organizationId,
      datasetId,
      jobType: scanMode,
      scanMode,
      sampleSize,
      totalRows,
      createdBy: options.userId || null
    });

    // Abort controller for cancellation
    const abortController = new AbortController();
    activeJobAbortControllers.set(String(job.id), abortController);

    // Launch background worker without blocking HTTP response
    setImmediate(() => {
      this.runQualityJobWorker(job.id, datasetId, organizationId, {
        ...options,
        scanMode,
        sampleSize,
        abortSignal: abortController.signal
      }).catch(err => {
        console.error(`[DataQualityService] Unhandled worker failure for job #${job.id}:`, err);
      }).finally(() => {
        activeJobAbortControllers.delete(String(job.id));
      });
    });

    return {
      job_id: job.id,
      dataset_id: Number(datasetId),
      status: initialStatus,
      scan_mode: scanMode,
      sample_size: sampleSize,
      total_rows: totalRows,
      message: 'Data quality audit initiated in background.'
    };
  }

  /**
   * Background worker executing chunked streaming quality evaluation
   */
  async runQualityJobWorker(jobId, datasetId, organizationId, options = {}) {
    const startTime = Date.now();
    try {
      await DataQualityJobModel.updateJobProgress(jobId, {
        status: 'RUNNING',
        stage: 'INITIALIZING',
        started_at: new Date(),
        progress_percent: 5
      });

      const profile = await this.evaluateDatasetQualityStream(datasetId, organizationId, {
        ...options,
        jobId,
        onProgress: async (progress) => {
          if (options.abortSignal?.aborted) return;
          await DataQualityJobModel.updateJobProgress(jobId, {
            progress_percent: progress.progressPercent,
            rows_processed: progress.rowsProcessed,
            total_rows: progress.totalRows,
            stage: progress.stage
          });
        }
      });

      if (options.abortSignal?.aborted) {
        await DataQualityJobModel.cancelJob(jobId, organizationId);
        return;
      }

      await DataQualityJobModel.completeJob(jobId, profile.id);

      const durationMs = Date.now() - startTime;
      const memUsageMb = (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(1);
      console.log(`[DataQualityService] Quality Job #${jobId} completed successfully in ${durationMs}ms (dataset #${datasetId}, ${profile.evaluated_rows} rows, mem: ${memUsageMb} MB)`);
    } catch (err) {
      if (options.abortSignal?.aborted || err.message?.includes('cancelled')) {
        await DataQualityJobModel.cancelJob(jobId, organizationId);
        console.log(`[DataQualityService] Quality Job #${jobId} cancelled gracefully.`);
      } else {
        console.error(`[DataQualityService] Quality Job #${jobId} failed:`, err.message);
        await DataQualityJobModel.failJob(jobId, err.message || 'Dataset quality evaluation failed.');
      }
    }
  }

  /**
   * Core streaming evaluator - processes millions of rows in constant O(1) memory
   */
  async evaluateDatasetQualityStream(datasetId, organizationId, options = {}) {
    const dataset = await Dataset.findByIdAndOrgId(datasetId, organizationId);
    if (!dataset) {
      const notFoundErr = new Error(`Dataset #${datasetId} not found or access denied.`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    const schema = Array.isArray(dataset.schema) ? dataset.schema : [];
    const customRules = await DataQualityModel.findRulesByDatasetId(datasetId, organizationId);
    const activeRules = customRules.filter(r => r.enabled !== false);
    const currentSchemaHash = this.computeSchemaHash(schema);
    const previousSnapshot = await DataQualityModel.getLatestSnapshot(datasetId, organizationId);

    const batchSize = config.qualityBatchSize || 25000;
    const isSampled = Boolean(options.sampleSize) || options.scanMode === 'SAMPLED' || options.fullScan === false;
    const scanMode = isSampled ? 'SAMPLED' : 'FULL_SCAN';
    const sampleLimit = isSampled && options.sampleSize ? Number(options.sampleSize) : (isSampled ? 10000 : null);

    const inputStream = await getFileReadStream(dataset.file_path);

    const rl = readline.createInterface({
      input: inputStream,
      crlfDelay: Infinity
    });

    let isHeader = true;
    let delimiter = ',';
    let headers = [];
    let totalRows = Number(dataset.row_count || 0);
    let processedRows = 0;

    // Accumulators for metrics
    let columnStats = {};
    const sampleRowHashes = new Set();
    let sampleDuplicates = 0;
    const MAX_HASH_SAMPLES = 50000;
    let hashSampleCount = 0;

    // Column values for relationship integrity checking
    const sourceColumnValues = {};

    const issues = [];

    if (options.onProgress) {
      await options.onProgress({
        rowsProcessed: 0,
        totalRows: totalRows || 1,
        progressPercent: 10,
        stage: 'STREAMING_METRICS'
      });
    }

    let lastYieldTime = Date.now();

    for await (const rawLine of rl) {
      if (options.abortSignal?.aborted) {
        rl.close();
        throw new Error('Quality audit cancelled by user.');
      }

      const line = rawLine.trim();
      if (!line) continue;

      if (isHeader) {
        delimiter = detectDelimiter(line);
        headers = parseCsvLine(line, delimiter).map((h, idx) => {
          const cleaned = h.replace(/^["']|["']$/g, '').trim();
          return cleaned || `column_${idx + 1}`;
        });

        // Initialize column stats
        headers.forEach(h => {
          const colSchema = schema.find(s => s.name?.toLowerCase() === h.toLowerCase());
          const colType = (colSchema?.type || 'string').toLowerCase();
          const colRules = activeRules.filter(r => r.column_name?.toLowerCase() === h.toLowerCase());

          columnStats[h] = {
            name: h,
            type: colType,
            rules: colRules,
            nullCount: 0,
            emptyCount: 0,
            presentCount: 0,
            validCount: 0,
            invalidCount: 0,
            distinctSamples: new Set(),
            observedTypes: {},
            ruleBreaches: {}
          };
          sourceColumnValues[h] = [];
        });

        isHeader = false;
        continue;
      }

      processedRows++;
      if (sampleLimit && processedRows > sampleLimit) {
        break;
      }

      const values = parseCsvLine(line, delimiter);

      // Duplicate row check
      if (hashSampleCount < MAX_HASH_SAMPLES) {
        const rowHash = crypto.createHash('md5').update(line).digest('hex');
        if (sampleRowHashes.has(rowHash)) {
          sampleDuplicates++;
        } else {
          sampleRowHashes.add(rowHash);
          hashSampleCount++;
        }
      }

      // Column statistics evaluation
      headers.forEach((header, colIdx) => {
        const stats = columnStats[header];
        if (!stats) return;

        const rawVal = values[colIdx] !== undefined ? values[colIdx].replace(/^["']|["']$/g, '').trim() : '';
        const isNullOrEmpty = rawVal === '' || rawVal.toLowerCase() === 'null' || rawVal.toLowerCase() === 'undefined';

        if (sourceColumnValues[header].length < 10000 && !isNullOrEmpty) {
          sourceColumnValues[header].push(rawVal);
        }

        if (isNullOrEmpty) {
          if (rawVal === '') stats.emptyCount++;
          else stats.nullCount++;

          const notNullRule = stats.rules.find(r => r.rule_type === 'not_null');
          if (notNullRule) {
            stats.invalidCount++;
            stats.ruleBreaches['not_null'] = (stats.ruleBreaches['not_null'] || 0) + 1;
          }
          return;
        }

        stats.presentCount++;

        if (stats.distinctSamples.size < 50000) {
          stats.distinctSamples.add(rawVal);
        }

        // Validity check
        let isValid = true;
        const colType = stats.type;

        if (colType.includes('num') || colType.includes('int') || colType.includes('float') || colType.includes('decimal')) {
          const num = Number(rawVal);
          if (isNaN(num)) {
            isValid = false;
          }
        } else if (colType.includes('date') || colType.includes('time')) {
          if (isNaN(Date.parse(rawVal))) {
            isValid = false;
          }
        } else if (colType.includes('bool')) {
          const lower = rawVal.toLowerCase();
          if (!['true', 'false', '1', '0', 'yes', 'no', 't', 'f'].includes(lower)) {
            isValid = false;
          }
        }

        if (isValid && (header.toLowerCase().includes('email') || rawVal.includes('@'))) {
          if (header.toLowerCase().includes('email')) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(rawVal)) {
              isValid = false;
            }
          }
        }

        // Custom Quality Rules
        if (isValid && stats.rules.length > 0) {
          for (const rule of stats.rules) {
            const configObj = rule.configuration || {};
            switch (rule.rule_type) {
              case 'min_value': {
                const num = Number(rawVal);
                if (configObj.min !== undefined && num < Number(configObj.min)) {
                  isValid = false;
                  stats.ruleBreaches['min_value'] = (stats.ruleBreaches['min_value'] || 0) + 1;
                }
                break;
              }
              case 'max_value': {
                const num = Number(rawVal);
                if (configObj.max !== undefined && num > Number(configObj.max)) {
                  isValid = false;
                  stats.ruleBreaches['max_value'] = (stats.ruleBreaches['max_value'] || 0) + 1;
                }
                break;
              }
              case 'range': {
                const num = Number(rawVal);
                if ((configObj.min !== undefined && num < Number(configObj.min)) || (configObj.max !== undefined && num > Number(configObj.max))) {
                  isValid = false;
                  stats.ruleBreaches['range'] = (stats.ruleBreaches['range'] || 0) + 1;
                }
                break;
              }
              case 'regex': {
                if (configObj.pattern) {
                  const reg = new RegExp(configObj.pattern);
                  if (!reg.test(rawVal)) {
                    isValid = false;
                    stats.ruleBreaches['regex'] = (stats.ruleBreaches['regex'] || 0) + 1;
                  }
                }
                break;
              }
              case 'allowed_values': {
                if (Array.isArray(configObj.values) && configObj.values.length > 0) {
                  const allowed = configObj.values.map(v => String(v).trim().toLowerCase());
                  if (!allowed.includes(rawVal.toLowerCase())) {
                    isValid = false;
                    stats.ruleBreaches['allowed_values'] = (stats.ruleBreaches['allowed_values'] || 0) + 1;
                  }
                }
                break;
              }
            }
            if (!isValid) break;
          }
        }

        if (isValid) stats.validCount++;
        else stats.invalidCount++;

        // Type consistency observation
        let valType = typeof rawVal;
        if (!isNaN(Number(rawVal)) && rawVal.trim() !== '') valType = 'number_string';
        else if (!isNaN(Date.parse(rawVal)) && isNaN(Number(rawVal)) && rawVal.length > 5) valType = 'date_string';
        stats.observedTypes[valType] = (stats.observedTypes[valType] || 0) + 1;
      });

      // Periodically yield to event loop and report progress
      if (processedRows % batchSize === 0 || Date.now() - lastYieldTime > 300) {
        lastYieldTime = Date.now();
        const effectiveTotal = sampleLimit || (totalRows > 0 ? totalRows : processedRows);
        const percent = Math.min(85, Math.max(10, Math.round((processedRows / effectiveTotal) * 75) + 10));

        if (options.onProgress) {
          await options.onProgress({
            rowsProcessed: processedRows,
            totalRows: effectiveTotal,
            progressPercent: percent,
            stage: `STREAMING_ROWS (${processedRows.toLocaleString()} rows)`
          });
        }
        await new Promise(r => setImmediate(r));
      }
    }

    if (totalRows === 0 && processedRows > 0) {
      totalRows = processedRows;
    }

    const evaluatedRowCount = processedRows;
    const columns = headers.length > 0 
      ? headers.map(h => ({ name: h, type: columnStats[h]?.type || 'string' }))
      : (schema.length > 0 ? schema : []);

    // If 0 rows evaluated
    if (evaluatedRowCount === 0) {
      const emptySnapshot = await DataQualityModel.createSnapshot({
        datasetId,
        organizationId,
        qualityScore: 0,
        status: 'unknown',
        completeness: 0,
        validity: 0,
        uniqueness: 0,
        consistency: 0,
        freshness: 0,
        rowCount: 0,
        columnCount: columns.length,
        scanMode,
        sampleSize: sampleLimit,
        schemaHash: currentSchemaHash,
        dimensions: {
          completeness: { score: 0, total_rows: 0, null_count: 0, empty_count: 0 },
          validity: { score: 0, total_checks: 0, invalid_count: 0 },
          uniqueness: { score: 0, total_rows: 0, duplicate_rows: 0, duplicate_percentage: 0 },
          consistency: { score: 0, type_consistency: 0, relationship_match_rate: 100 },
          freshness: { score: 0, status: 'unknown', age_hours: null, last_updated: dataset.updated_at || dataset.created_at }
        },
        columnMetrics: [],
        issues: [{
          id: crypto.randomUUID(),
          dimension: 'completeness',
          severity: 'warning',
          message: 'Dataset contains 0 rows of data.',
          column: null
        }]
      });

      return {
        id: emptySnapshot.id,
        dataset_id: Number(datasetId),
        dataset_name: dataset.name,
        quality_score: 0,
        status: 'unknown',
        scan_mode: scanMode,
        sample_size: sampleLimit,
        total_rows: 0,
        evaluated_rows: 0,
        column_count: columns.length,
        schema_hash: currentSchemaHash,
        dimensions: emptySnapshot.dimensions,
        column_metrics: [],
        issues: emptySnapshot.issues,
        evaluated_at: emptySnapshot.evaluated_at
      };
    }

    // Stage 2: Aggregate Dimension Scores
    if (options.onProgress) {
      await options.onProgress({
        rowsProcessed: evaluatedRowCount,
        totalRows: evaluatedRowCount,
        progressPercent: 90,
        stage: 'FINALIZING_DIMENSIONS'
      });
    }

    // Dimension 1: Completeness
    let totalCells = evaluatedRowCount * (columns.length || 1);
    let totalMissingCells = 0;
    const columnMetrics = [];

    for (const col of columns) {
      const stats = columnStats[col.name] || {
        nullCount: 0,
        emptyCount: 0,
        presentCount: evaluatedRowCount,
        validCount: evaluatedRowCount,
        invalidCount: 0,
        distinctSamples: new Set(),
        observedTypes: {},
        ruleBreaches: {}
      };

      const missingCount = stats.nullCount + stats.emptyCount;
      totalMissingCells += missingCount;
      const completenessPct = evaluatedRowCount > 0 ? ((stats.presentCount / evaluatedRowCount) * 100) : 100;

      if (completenessPct < 90) {
        issues.push({
          id: crypto.randomUUID(),
          dimension: 'completeness',
          severity: completenessPct < 70 ? 'critical' : 'warning',
          message: `Column "${col.name}" has ${missingCount.toLocaleString()} missing values (${(100 - completenessPct).toFixed(1)}% missing).`,
          column: col.name,
          metadata: { nullCount: stats.nullCount, emptyCount: stats.emptyCount, totalRows: evaluatedRowCount, completenessPct: Math.round(completenessPct) }
        });
      }

      const totalChecked = stats.validCount + stats.invalidCount;
      const validityPct = totalChecked > 0 ? ((stats.validCount / totalChecked) * 100) : 100;

      if (stats.invalidCount > 0) {
        issues.push({
          id: crypto.randomUUID(),
          dimension: 'validity',
          severity: validityPct < 85 ? 'critical' : 'warning',
          message: `Column "${col.name}" has ${stats.invalidCount.toLocaleString()} invalid values (${(100 - validityPct).toFixed(1)}% invalid).`,
          column: col.name,
          metadata: { invalidCount: stats.invalidCount, totalChecked, validityPct: Math.round(validityPct) }
        });
      }

      for (const [rType, breachCount] of Object.entries(stats.ruleBreaches)) {
        issues.push({
          id: crypto.randomUUID(),
          dimension: 'validity',
          severity: 'warning',
          message: `Quality rule violation on column "${col.name}": ${breachCount.toLocaleString()} records breached ${rType} rule.`,
          column: col.name,
          metadata: { ruleType: rType, breachCount, column: col.name }
        });
      }

      const distinctCount = stats.distinctSamples.size;
      const uniquenessPct = stats.presentCount > 0 ? Math.round((distinctCount / stats.presentCount) * 1000) / 10 : 0;
      const isCandidatePk = stats.presentCount === evaluatedRowCount && distinctCount === evaluatedRowCount && evaluatedRowCount > 0;

      columnMetrics.push({
        column_name: col.name,
        data_type: stats.type || 'string',
        total_rows: evaluatedRowCount,
        null_count: stats.nullCount,
        empty_count: stats.emptyCount,
        missing_count: missingCount,
        completeness_pct: Math.round(completenessPct * 10) / 10,
        valid_count: stats.validCount,
        invalid_count: stats.invalidCount,
        validity_pct: Math.round(validityPct * 10) / 10,
        distinct_count: distinctCount,
        uniqueness_pct: uniquenessPct,
        is_candidate_pk: isCandidatePk
      });
    }

    const overallCompleteness = Math.max(0, Math.min(100, Math.round(((totalCells - totalMissingCells) / totalCells) * 1000) / 10));

    // Dimension 2: Validity
    let totalValidityChecks = 0;
    let totalValidCount = 0;
    columnMetrics.forEach(m => {
      totalValidityChecks += (m.valid_count + m.invalid_count);
      totalValidCount += m.valid_count;
    });
    const overallValidity = totalValidityChecks > 0 
      ? Math.max(0, Math.min(100, Math.round((totalValidCount / totalValidityChecks) * 1000) / 10))
      : 100;

    // Dimension 3: Uniqueness
    const sampleSizeChecked = Math.min(evaluatedRowCount, hashSampleCount || evaluatedRowCount);
    const duplicatePct = sampleSizeChecked > 0 ? (sampleDuplicates / sampleSizeChecked) * 100 : 0;
    const overallUniqueness = Math.max(0, Math.min(100, Math.round((100 - duplicatePct) * 10) / 10));

    if (sampleDuplicates > 0) {
      issues.push({
        id: crypto.randomUUID(),
        dimension: 'uniqueness',
        severity: duplicatePct > 10 ? 'critical' : 'warning',
        message: `Dataset contains duplicate rows (${duplicatePct.toFixed(1)}% estimated duplication).`,
        column: null,
        metadata: { duplicateRowCount: sampleDuplicates, duplicatePct: Math.round(duplicatePct) }
      });
    }

    // Dimension 4: Consistency & Phase 14 Relationships
    let consistencyChecks = 0;
    let consistentCount = 0;
    for (const col of columns) {
      const stats = columnStats[col.name];
      if (!stats) continue;
      const typeKeys = Object.keys(stats.observedTypes);
      if (typeKeys.length > 1) {
        const total = Object.values(stats.observedTypes).reduce((a, b) => a + b, 0);
        const dominant = Math.max(...Object.values(stats.observedTypes));
        consistencyChecks += total;
        consistentCount += dominant;
        if ((dominant / total) < 0.9) {
          issues.push({
            id: crypto.randomUUID(),
            dimension: 'consistency',
            severity: 'warning',
            message: `Column "${col.name}" has inconsistent value types.`,
            column: col.name,
            metadata: { observedTypes: stats.observedTypes }
          });
        }
      } else {
        consistencyChecks += 10;
        consistentCount += 10;
      }
    }
    const typeConsistencyScore = consistencyChecks > 0 ? (consistentCount / consistencyChecks) * 100 : 100;
    let relationshipMatchRate = 100;

    // Check Phase 14 Relationships for foreign-key consistency
    try {
      const allRels = await DatasetRelationshipModel.findByOrganizationId(organizationId);
      const datasetRels = allRels.filter(r => Number(r.source_dataset_id) === Number(datasetId));

      for (const rel of datasetRels) {
        if (!rel.target_dataset_id || !rel.source_column || !rel.target_column) continue;
        const targetDataset = await Dataset.findByIdAndOrgId(rel.target_dataset_id, organizationId);
        if (!targetDataset || !targetDataset.file_path) continue;

        // Read target keys from target file stream
        const targetKeys = new Set();
        const targetStream = await getFileReadStream(targetDataset.file_path);
        const targetRl = readline.createInterface({ input: targetStream, crlfDelay: Infinity });
        let targetIsHeader = true;
        let targetDelimiter = ',';
        let targetColIdx = -1;

        for await (const tLine of targetRl) {
          const trimmed = tLine.trim();
          if (!trimmed) continue;
          if (targetIsHeader) {
            targetDelimiter = detectDelimiter(trimmed);
            const tHeaders = parseCsvLine(trimmed, targetDelimiter).map(h => h.replace(/^["']|["']$/g, '').trim());
            targetColIdx = tHeaders.findIndex(h => h.toLowerCase() === rel.target_column.toLowerCase());
            targetIsHeader = false;
            continue;
          }
          if (targetColIdx !== -1) {
            const vals = parseCsvLine(trimmed, targetDelimiter);
            const val = vals[targetColIdx]?.replace(/^["']|["']$/g, '').trim();
            if (val) targetKeys.add(val.toLowerCase());
          }
        }

        const srcVals = sourceColumnValues[rel.source_column] || [];
        let orphanCount = 0;
        let sourceKeysEvaluated = 0;

        for (const sVal of srcVals) {
          if (!sVal) continue;
          sourceKeysEvaluated++;
          if (!targetKeys.has(String(sVal).toLowerCase())) {
            orphanCount++;
          }
        }

        if (sourceKeysEvaluated > 0) {
          const matchRate = ((sourceKeysEvaluated - orphanCount) / sourceKeysEvaluated) * 100;
          relationshipMatchRate = Math.min(relationshipMatchRate, matchRate);

          if (orphanCount > 0) {
            issues.push({
              id: crypto.randomUUID(),
              dimension: 'consistency',
              severity: matchRate < 80 ? 'critical' : 'warning',
              message: `${orphanCount.toLocaleString()} ${dataset.name} records reference ${rel.target_column} not present in ${targetDataset.name} dataset.`,
              column: rel.source_column,
              metadata: {
                relationshipId: rel.id,
                sourceDataset: dataset.name,
                sourceColumn: rel.source_column,
                targetDataset: targetDataset.name,
                targetColumn: rel.target_column,
                orphanCount,
                sourceKeysEvaluated,
                matchRate: Math.round(matchRate * 10) / 10
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn('[DataQualityService] Relationship check warning:', err.message);
    }

    const overallConsistency = Math.max(0, Math.min(100, Math.round(((typeConsistencyScore * 0.5) + (relationshipMatchRate * 0.5)) * 10) / 10));

    // Dimension 5: Freshness
    const lastUpdatedDate = dataset.updated_at ? new Date(dataset.updated_at) : (dataset.created_at ? new Date(dataset.created_at) : null);
    let freshnessStatus = 'unknown';
    let freshnessScore = 100;
    let ageHours = null;

    if (lastUpdatedDate && !isNaN(lastUpdatedDate.getTime())) {
      const now = new Date();
      ageHours = Math.max(0, (now.getTime() - lastUpdatedDate.getTime()) / (1000 * 60 * 60));
      const expectedRefreshHours = options.expectedRefreshHours || null;

      if (expectedRefreshHours && expectedRefreshHours > 0) {
        if (ageHours <= expectedRefreshHours) {
          freshnessStatus = 'healthy';
          freshnessScore = 100;
        } else if (ageHours <= expectedRefreshHours * 1.5) {
          freshnessStatus = 'warning';
          freshnessScore = 75;
          issues.push({
            id: crypto.randomUUID(),
            dimension: 'freshness',
            severity: 'warning',
            message: `Dataset refresh is delayed. Age is ${Math.round(ageHours)} hours (expected: ${expectedRefreshHours}h).`,
            column: null
          });
        } else {
          freshnessStatus = 'stale';
          freshnessScore = ageHours > expectedRefreshHours * 3 ? 20 : 40;
          issues.push({
            id: crypto.randomUUID(),
            dimension: 'freshness',
            severity: 'critical',
            message: `Dataset is stale. Last updated ${Math.round(ageHours)} hours ago (expected: ${expectedRefreshHours}h).`,
            column: null
          });
        }
      } else {
        freshnessStatus = 'healthy';
        freshnessScore = 100;
      }
    }

    // Dimension 6: Schema Observability
    if (previousSnapshot && previousSnapshot.schema_hash && previousSnapshot.schema_hash !== currentSchemaHash) {
      issues.push({
        id: crypto.randomUUID(),
        dimension: 'schema',
        severity: 'info',
        message: `Schema change detected. Current hash (${currentSchemaHash}) differs from previous snapshot (${previousSnapshot.schema_hash}).`,
        column: null
      });

      auditService.log({
        organizationId,
        userId: options.userId || null,
        action: 'SCHEMA_CHANGE_DETECTED',
        resourceType: 'dataset',
        resourceId: String(datasetId),
        description: `Schema drift detected for dataset "${dataset.name}".`,
        metadata: { previousHash: previousSnapshot.schema_hash, currentHash: currentSchemaHash },
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null
      }).catch(() => {});
    }

    // Dimension 7: Volume Observability
    if (previousSnapshot && previousSnapshot.row_count !== undefined && previousSnapshot.row_count !== null) {
      const prevRows = Number(previousSnapshot.row_count);
      if (prevRows > 0) {
        const changePct = ((evaluatedRowCount - prevRows) / prevRows) * 100;
        if (changePct <= -20) {
          issues.push({
            id: crypto.randomUUID(),
            dimension: 'volume',
            severity: changePct <= -50 ? 'critical' : 'warning',
            message: `Significant volume decrease detected: dropped from ${prevRows.toLocaleString()} to ${evaluatedRowCount.toLocaleString()} (${Math.round(changePct)}%).`,
            column: null
          });
        } else if (changePct >= 100) {
          issues.push({
            id: crypto.randomUUID(),
            dimension: 'volume',
            severity: 'info',
            message: `Significant volume increase detected: increased from ${prevRows.toLocaleString()} to ${evaluatedRowCount.toLocaleString()} (+${Math.round(changePct)}%).`,
            column: null
          });
        }
      }
    }

    // Final Weighted Quality Score
    const weights = { completeness: 0.25, validity: 0.25, uniqueness: 0.20, consistency: 0.20, freshness: 0.10 };
    const weightedScore = (
      (overallCompleteness * weights.completeness) +
      (overallValidity * weights.validity) +
      (overallUniqueness * weights.uniqueness) +
      (overallConsistency * weights.consistency) +
      (freshnessScore * weights.freshness)
    );
    const qualityScore = Math.max(0, Math.min(100, Math.round(weightedScore * 10) / 10));

    let status = 'healthy';
    if (qualityScore < 70) status = 'critical';
    else if (qualityScore < 85) status = 'warning';

    const dimensions = {
      completeness: { score: overallCompleteness, weight_pct: 25, total_rows: evaluatedRowCount, total_cells: totalCells, missing_cells: totalMissingCells },
      validity: { score: overallValidity, weight_pct: 25, total_checks: totalValidityChecks, valid_count: totalValidCount, invalid_count: totalValidityChecks - totalValidCount },
      uniqueness: { score: overallUniqueness, weight_pct: 20, total_rows: evaluatedRowCount, duplicate_rows: sampleDuplicates, duplicate_percentage: Math.round(duplicatePct * 10) / 10 },
      consistency: { score: overallConsistency, weight_pct: 20, type_consistency_score: Math.round(typeConsistencyScore * 10) / 10, relationship_match_rate: Math.round(relationshipMatchRate * 10) / 10 },
      freshness: { score: freshnessScore, weight_pct: 10, status: freshnessStatus, age_hours: ageHours !== null ? Math.round(ageHours * 10) / 10 : null, last_updated: lastUpdatedDate ? lastUpdatedDate.toISOString() : null }
    };

    // Persist Snapshot
    const savedSnapshot = await DataQualityModel.createSnapshot({
      datasetId,
      organizationId,
      qualityScore,
      status,
      completeness: overallCompleteness,
      validity: overallValidity,
      uniqueness: overallUniqueness,
      consistency: overallConsistency,
      freshness: freshnessScore,
      rowCount: evaluatedRowCount,
      columnCount: columns.length,
      scanMode,
      sampleSize: sampleLimit,
      schemaHash: currentSchemaHash,
      dimensions,
      columnMetrics,
      issues
    });

    // Audit logs
    auditService.log({
      organizationId,
      userId: options.userId || null,
      action: 'DATA_QUALITY_CHECKED',
      resourceType: 'dataset',
      resourceId: String(datasetId),
      description: `Quality evaluated for dataset "${dataset.name}": score ${qualityScore}/100 (${status}).`,
      metadata: { qualityScore, status, scanMode, issuesCount: issues.length },
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null
    }).catch(() => {});

    // Alert engine evaluation
    try {
      const orgAlerts = await AlertModel.findByOrganizationId(organizationId);
      const datasetAlerts = orgAlerts.filter(a => Number(a.dataset_id) === Number(datasetId) && a.status === 'active');
      for (const alert of datasetAlerts) {
        await alertEvaluator.evaluateAlertRule(alert, { overrideMetricValue: qualityScore }).catch(() => {});
      }
    } catch (err) {
      console.warn('[DataQualityService] Alert evaluation warning:', err.message);
    }

    return {
      id: savedSnapshot.id,
      dataset_id: Number(datasetId),
      dataset_name: dataset.name,
      quality_score: qualityScore,
      status,
      scan_mode: scanMode,
      sample_size: sampleLimit,
      total_rows: Number(dataset.row_count || evaluatedRowCount),
      evaluated_rows: evaluatedRowCount,
      column_count: columns.length,
      schema_hash: currentSchemaHash,
      dimensions,
      column_metrics: columnMetrics,
      issues,
      evaluated_at: savedSnapshot.evaluated_at || new Date()
    };
  }

  /**
   * Synchronous / backward compatible evaluate method (runs streaming evaluation)
   */
  async evaluateDatasetQuality(datasetId, organizationId, options = {}) {
    return this.evaluateDatasetQualityStream(datasetId, organizationId, options);
  }

  /**
   * Get latest quality profile for a dataset
   */
  async getQualityProfile(datasetId, organizationId, options = {}) {
    if (!datasetId || !organizationId) {
      throw new Error('Dataset ID and Organization ID are required.');
    }

    const dataset = await Dataset.findByIdAndOrgId(datasetId, organizationId);
    if (!dataset) {
      const notFoundErr = new Error(`Dataset #${datasetId} not found or access denied.`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    const latest = await DataQualityModel.getLatestSnapshot(datasetId, organizationId);
    if (latest && !options.forceReevaluate) {
      return {
        ...latest,
        dataset_name: dataset.name,
        total_rows: Number(latest.row_count || 0),
        column_count: Number(latest.column_count || 0),
        dimensions: typeof latest.dimensions === 'string' ? JSON.parse(latest.dimensions) : (latest.dimensions || {}),
        column_metrics: typeof latest.column_metrics === 'string' ? JSON.parse(latest.column_metrics) : (latest.column_metrics || []),
        issues: typeof latest.issues === 'string' ? JSON.parse(latest.issues) : (latest.issues || [])
      };
    }

    return this.evaluateDatasetQualityStream(datasetId, organizationId, options);
  }

  /**
   * Get column-level quality breakdown for a dataset
   */
  async getColumnMetrics(datasetId, organizationId) {
    const profile = await this.getQualityProfile(datasetId, organizationId);
    return profile?.column_metrics || [];
  }

  /**
   * Get historical quality evaluation snapshots for a dataset
   */
  async getQualityHistory(datasetId, organizationId, limit = 20) {
    return DataQualityModel.getSnapshotHistory(datasetId, organizationId, limit);
  }

  /**
   * Get status of an asynchronous quality job
   */
  async getJobStatus(jobId, organizationId) {
    const job = await DataQualityJobModel.findByIdAndOrgId(jobId, organizationId);
    if (!job) {
      const notFoundErr = new Error(`Job #${jobId} not found or access denied.`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }
    return job;
  }

  /**
   * Get latest job for a dataset
   */
  async getDatasetLatestJob(datasetId, organizationId) {
    return DataQualityJobModel.findLatestByDatasetId(datasetId, organizationId);
  }

  /**
   * Cancel an active quality job
   */
  async cancelJob(jobId, organizationId) {
    const controller = activeJobAbortControllers.get(String(jobId));
    if (controller) {
      controller.abort();
    }
    const cancelled = await DataQualityJobModel.cancelJob(jobId, organizationId);
    return cancelled;
  }

  /**
   * Retry a failed or cancelled quality job
   */
  async retryJob(jobId, organizationId, options = {}) {
    const previousJob = await DataQualityJobModel.findByIdAndOrgId(jobId, organizationId);
    if (!previousJob) {
      const notFoundErr = new Error(`Job #${jobId} not found.`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    return this.startQualityAuditJob(previousJob.dataset_id, organizationId, {
      ...options,
      scanMode: previousJob.scan_mode || 'FULL_SCAN',
      sampleSize: previousJob.sample_size
    });
  }

  /**
   * Create custom quality rule
   */
  async createRule(ruleData) {
    const { organizationId, datasetId, columnName, ruleType, configuration, severity, enabled, createdBy } = ruleData;

    const dataset = await Dataset.findByIdAndOrgId(datasetId, organizationId);
    if (!dataset) {
      const notFoundErr = new Error(`Dataset #${datasetId} not found or access denied.`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    const createdRule = await DataQualityModel.createRule({
      organizationId,
      datasetId,
      columnName,
      ruleType,
      configuration,
      severity,
      enabled,
      createdBy
    });

    auditService.log({
      organizationId,
      userId: createdBy || null,
      action: 'DATA_QUALITY_RULE_CREATED',
      resourceType: 'quality_rule',
      resourceId: String(createdRule.id),
      description: `Created custom ${ruleType} rule for column "${columnName}" on dataset "${dataset.name}".`,
      metadata: { datasetId, columnName, ruleType, severity }
    }).catch(() => {});

    return createdRule;
  }

  async getRules(datasetId, organizationId) {
    if (datasetId) {
      return DataQualityModel.findRulesByDatasetId(datasetId, organizationId);
    }
    return DataQualityModel.findRulesByOrgId(organizationId);
  }

  async getRuleById(id, organizationId) {
    return DataQualityModel.findRuleByIdAndOrgId(id, organizationId);
  }

  async updateRule(id, organizationId, updates, context = {}) {
    const existing = await DataQualityModel.findRuleByIdAndOrgId(id, organizationId);
    if (!existing) {
      const notFoundErr = new Error(`Quality rule #${id} not found.`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    const updated = await DataQualityModel.updateRule(id, organizationId, updates);
    return updated;
  }

  async deleteRule(id, organizationId, context = {}) {
    const existing = await DataQualityModel.findRuleByIdAndOrgId(id, organizationId);
    if (!existing) {
      const notFoundErr = new Error(`Quality rule #${id} not found.`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    const deleted = await DataQualityModel.deleteRule(id, organizationId);
    return deleted;
  }
}

module.exports = new DataQualityService();
