const crypto = require('crypto');
const DataQualityModel = require('../models/dataQualityModel');
const Dataset = require('../models/datasetModel');
const DatasetRelationshipModel = require('../models/datasetRelationshipModel');
const { loadDatasetRecords } = require('./analyticsService');
const auditService = require('./auditService');
const AlertModel = require('../models/alertModel');
const alertEvaluator = require('./alertEvaluatorService');

/**
 * Data Quality & Observability Engine Service
 * Implements 7 core dimensions of data quality:
 * 1. Completeness (missing/null/empty detection)
 * 2. Accuracy & Validity (schema type matching, formats, email validation, boundary rules)
 * 3. Uniqueness (duplicate rows, duplicate values, candidate PK detection)
 * 4. Consistency (data type consistency, format consistency, Phase 14 relationship key integrity)
 * 5. Freshness (dataset age, update intervals, freshness status)
 * 6. Schema Observability (snapshot hash, column drift detection, type changes)
 * 7. Volume Observability (row counts, anomalies, sudden drops/spikes)
 */
class DataQualityService {
  /**
   * Helper to compute a deterministic SHA-256 hash of dataset schema
   * @param {Array<any>} schema 
   * @returns {string}
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
   * Evaluate dataset quality profile across all dimensions
   * @param {number|string} datasetId 
   * @param {string} organizationId 
   * @param {{
   *   sampleSize?: number|null,
   *   fullScan?: boolean,
   *   expectedRefreshHours?: number|null,
   *   userId?: number|string|null,
   *   ipAddress?: string,
   *   userAgent?: string
   * }} [options={}]
   * @returns {Promise<any>}
   */
  async evaluateDatasetQuality(datasetId, organizationId, options = {}) {
    if (!datasetId) {
      throw new Error('Dataset ID is required for quality evaluation.');
    }
    if (!organizationId) {
      throw new Error('Organization ID is required for quality evaluation.');
    }

    // 1. Fetch dataset ensuring organization isolation
    const dataset = await Dataset.findByIdAndOrgId(datasetId, organizationId);
    if (!dataset) {
      const notFoundErr = new Error(`Dataset #${datasetId} not found or access denied.`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    // 2. Fetch schema & custom quality rules
    const schema = Array.isArray(dataset.schema) ? dataset.schema : [];
    const customRules = await DataQualityModel.findRulesByDatasetId(datasetId, organizationId);
    const activeRules = customRules.filter(r => r.enabled !== false);

    // 3. Load records from storage
    let rawRecords = [];
    try {
      rawRecords = await loadDatasetRecords(dataset.file_path);
    } catch (err) {
      console.warn(`[DataQualityService] Could not read dataset file for dataset #${datasetId}:`, err.message);
      rawRecords = [];
    }

    const totalRawRows = rawRecords.length;

    // 4. Handle scan mode (full vs sampled)
    let evaluatedRecords = rawRecords;
    let scanMode = 'FULL_SCAN';
    let sampleSize = null;

    if (options.sampleSize && Number(options.sampleSize) > 0 && Number(options.sampleSize) < totalRawRows) {
      sampleSize = Number(options.sampleSize);
      scanMode = 'SAMPLED';
      evaluatedRecords = rawRecords.slice(0, sampleSize);
    }

    const evaluatedRowCount = evaluatedRecords.length;
    const currentSchemaHash = this.computeSchemaHash(schema);

    // 5. Fetch previous snapshot for schema drift & volume observability
    const previousSnapshot = await DataQualityModel.getLatestSnapshot(datasetId, organizationId);

    // 6. Initialize tracking structures
    const issues = [];
    const columnMetrics = [];
    const columns = schema.length > 0 
      ? schema.map(c => typeof c === 'string' ? { name: c, type: 'string' } : c)
      : (evaluatedRowCount > 0 ? Object.keys(evaluatedRecords[0]).map(k => ({ name: k, type: 'string' })) : []);

    // If empty dataset (0 rows)
    if (totalRawRows === 0) {
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
        scanMode: 'FULL_SCAN',
        sampleSize: null,
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
        dataset_id: datasetId,
        dataset_name: dataset.name,
        quality_score: 0,
        status: 'unknown',
        scan_mode: 'FULL_SCAN',
        sample_size: null,
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

    // --- DIMENSION 1: COMPLETENESS ---
    let totalCellCount = evaluatedRowCount * (columns.length || 1);
    let totalMissingCells = 0;

    for (const col of columns) {
      const colName = col.name;
      let nullCount = 0;
      let emptyCount = 0;
      let presentCount = 0;

      for (const row of evaluatedRecords) {
        const val = row[colName];
        if (val === null || val === undefined) {
          nullCount++;
        } else if (typeof val === 'string' && val.trim() === '') {
          emptyCount++;
        } else if (Number.isNaN(val)) {
          nullCount++;
        } else {
          presentCount++;
        }
      }

      const missingCount = nullCount + emptyCount;
      totalMissingCells += missingCount;
      const completenessPct = evaluatedRowCount > 0 ? ((presentCount / evaluatedRowCount) * 100) : 100;

      // Issue generation for low completeness
      if (completenessPct < 90) {
        issues.push({
          id: crypto.randomUUID(),
          dimension: 'completeness',
          severity: completenessPct < 70 ? 'critical' : 'warning',
          message: `Column "${colName}" has ${missingCount} missing values (${(100 - completenessPct).toFixed(1)}% missing).`,
          column: colName,
          metadata: { nullCount, emptyCount, totalRows: evaluatedRowCount, completenessPct: Math.round(completenessPct) }
        });
      }

      columnMetrics.push({
        column_name: colName,
        data_type: col.type || 'string',
        total_rows: evaluatedRowCount,
        null_count: nullCount,
        empty_count: emptyCount,
        missing_count: missingCount,
        completeness_pct: Math.round(completenessPct * 10) / 10,
        valid_count: 0, // populated in validity step
        invalid_count: 0,
        validity_pct: 100,
        distinct_count: 0, // populated in uniqueness step
        uniqueness_pct: 0,
        is_candidate_pk: false
      });
    }

    const overallCompleteness = Math.max(0, Math.min(100, Math.round(((totalCellCount - totalMissingCells) / totalCellCount) * 1000) / 10));

    // --- DIMENSION 2: VALIDITY ---
    let totalValidityChecks = 0;
    let totalValidCount = 0;

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const colName = col.name;
      const colType = (col.type || 'string').toLowerCase();
      const metric = columnMetrics[i];

      // Relevant custom rules for this column
      const colRules = activeRules.filter(r => r.column_name.toLowerCase() === colName.toLowerCase());

      const ruleViolationReasons = [];
      let validCount = 0;
      let invalidCount = 0;

      for (const row of evaluatedRecords) {
        const val = row[colName];
        if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
          // Check if not_null rule exists
          const notNullRule = colRules.find(r => r.rule_type === 'not_null');
          if (notNullRule) {
            invalidCount++;
            totalValidityChecks++;
            ruleViolationReasons.push({ rule: notNullRule, failureReason: `Value is null or empty, violating not_null rule.` });
          }
          continue;
        }

        totalValidityChecks++;
        let isValid = true;
        let failureReason = null;

        // 1. Schema type validation
        if (colType.includes('num') || colType.includes('int') || colType.includes('float') || colType.includes('decimal')) {
          const num = Number(val);
          if (isNaN(num) || typeof val === 'boolean') {
            isValid = false;
            failureReason = `Value "${val}" is not a valid number.`;
          }
        } else if (colType.includes('date') || colType.includes('time')) {
          const timestamp = Date.parse(val);
          if (isNaN(timestamp)) {
            isValid = false;
            failureReason = `Value "${val}" is not a parseable date.`;
          }
        } else if (colType.includes('bool')) {
          const str = String(val).toLowerCase();
          if (!['true', 'false', '1', '0', 't', 'f', 'yes', 'no'].includes(str)) {
            isValid = false;
            failureReason = `Value "${val}" is not a recognized boolean.`;
          }
        }

        // Auto email format check if column is named email
        if (isValid && (colName.toLowerCase().includes('email') || (typeof val === 'string' && val.includes('@')))) {
          if (colName.toLowerCase().includes('email')) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (typeof val !== 'string' || !emailRegex.test(val.trim())) {
              isValid = false;
              failureReason = `Value "${val}" is not a valid email address.`;
            }
          }
        }

        // 2. Custom quality rules evaluation
        if (isValid && colRules.length > 0) {
          for (const rule of colRules) {
            const config = rule.configuration || {};
            switch (rule.rule_type) {
              case 'min_value': {
                const num = Number(val);
                if (config.min !== undefined && num < Number(config.min)) {
                  isValid = false;
                  failureReason = `Value ${num} violates min_value rule (min: ${config.min}).`;
                }
                break;
              }
              case 'max_value': {
                const num = Number(val);
                if (config.max !== undefined && num > Number(config.max)) {
                  isValid = false;
                  failureReason = `Value ${num} violates max_value rule (max: ${config.max}).`;
                }
                break;
              }
              case 'range': {
                const num = Number(val);
                if ((config.min !== undefined && num < Number(config.min)) || (config.max !== undefined && num > Number(config.max))) {
                  isValid = false;
                  failureReason = `Value ${num} violates range rule [${config.min}, ${config.max}].`;
                }
                break;
              }
              case 'regex': {
                if (config.pattern) {
                  const reg = new RegExp(config.pattern);
                  if (!reg.test(String(val))) {
                    isValid = false;
                    failureReason = `Value "${val}" does not match configured regex pattern "${config.pattern}".`;
                  }
                }
                break;
              }
              case 'allowed_values': {
                if (Array.isArray(config.values) && config.values.length > 0) {
                  const strVal = String(val).trim().toLowerCase();
                  const allowed = config.values.map(v => String(v).trim().toLowerCase());
                  if (!allowed.includes(strVal)) {
                    isValid = false;
                    failureReason = `Value "${val}" is not in allowed values: [${config.values.join(', ')}].`;
                  }
                }
                break;
              }
              case 'type_check': {
                if (config.expected_type === 'number' && isNaN(Number(val))) {
                  isValid = false;
                  failureReason = `Value "${val}" does not match expected type "number".`;
                } else if (config.expected_type === 'date' && isNaN(Date.parse(val))) {
                  isValid = false;
                  failureReason = `Value "${val}" does not match expected type "date".`;
                }
                break;
              }
            }

            if (!isValid) {
              ruleViolationReasons.push({ rule, failureReason });
              break;
            }
          }
        }

        if (isValid) {
          validCount++;
          totalValidCount++;
        } else {
          invalidCount++;
        }
      }

      const totalChecked = validCount + invalidCount;
      const validityPct = totalChecked > 0 ? ((validCount / totalChecked) * 100) : 100;

      metric.valid_count = validCount;
      metric.invalid_count = invalidCount;
      metric.validity_pct = Math.round(validityPct * 10) / 10;

      if (invalidCount > 0) {
        issues.push({
          id: crypto.randomUUID(),
          dimension: 'validity',
          severity: validityPct < 85 ? 'critical' : 'warning',
          message: `Column "${colName}" has ${invalidCount} invalid values (${(100 - validityPct).toFixed(1)}% invalid).`,
          column: colName,
          metadata: { invalidCount, totalChecked, validityPct: Math.round(validityPct) }
        });

        // Add specific custom rule breach issues
        const uniqueRuleTypes = [...new Set(ruleViolationReasons.map(r => r.rule.rule_type))];
        for (const rType of uniqueRuleTypes) {
          const matching = ruleViolationReasons.filter(r => r.rule.rule_type === rType);
          const firstReason = matching[0]?.failureReason || `Violates custom ${rType} rule.`;
          issues.push({
            id: crypto.randomUUID(),
            dimension: 'validity',
            severity: matching[0]?.rule.severity || 'warning',
            message: `Quality rule violation on column "${colName}": ${matching.length} records breached ${rType} rule (${firstReason}).`,
            column: colName,
            metadata: { ruleType: rType, breachCount: matching.length, column: colName }
          });
        }
      }
    }

    const overallValidity = totalValidityChecks > 0 
      ? Math.max(0, Math.min(100, Math.round((totalValidCount / totalValidityChecks) * 1000) / 10))
      : 100;

    // --- DIMENSION 3: UNIQUENESS ---
    const rowHashes = new Set();
    let duplicateRowCount = 0;

    for (const row of evaluatedRecords) {
      const rowStr = JSON.stringify(row);
      if (rowHashes.has(rowStr)) {
        duplicateRowCount++;
      } else {
        rowHashes.add(rowStr);
      }
    }

    const duplicatePct = evaluatedRowCount > 0 ? (duplicateRowCount / evaluatedRowCount) * 100 : 0;
    const overallUniqueness = Math.max(0, Math.min(100, Math.round((100 - duplicatePct) * 10) / 10));

    if (duplicateRowCount > 0) {
      issues.push({
        id: crypto.randomUUID(),
        dimension: 'uniqueness',
        severity: duplicatePct > 10 ? 'critical' : 'warning',
        message: `Dataset contains ${duplicateRowCount} duplicate rows (${duplicatePct.toFixed(1)}% of evaluated rows).`,
        column: null,
        metadata: { duplicateRowCount, totalRows: evaluatedRowCount, duplicatePct: Math.round(duplicatePct) }
      });
    }

    // Column-level distinct values & candidate primary key detection
    for (let i = 0; i < columns.length; i++) {
      const colName = columns[i].name;
      const metric = columnMetrics[i];
      const valSet = new Set();
      let nonNullCount = 0;

      for (const row of evaluatedRecords) {
        const val = row[colName];
        if (val !== null && val !== undefined && val !== '') {
          nonNullCount++;
          valSet.add(String(val));
        }
      }

      metric.distinct_count = valSet.size;
      metric.uniqueness_pct = nonNullCount > 0 ? Math.round((valSet.size / nonNullCount) * 1000) / 10 : 0;
      metric.is_candidate_pk = nonNullCount === evaluatedRowCount && valSet.size === evaluatedRowCount && evaluatedRowCount > 0;
    }

    // --- DIMENSION 4: CONSISTENCY & PHASE 14 RELATIONSHIPS ---
    let consistencyChecks = 0;
    let consistentCount = 0;

    // Type consistency across rows
    for (const col of columns) {
      const colName = col.name;
      const observedTypes = {};

      for (const row of evaluatedRecords) {
        const val = row[colName];
        if (val === null || val === undefined || val === '') continue;
        
        let type = typeof val;
        if (type === 'string') {
          if (!isNaN(Number(val)) && val.trim() !== '') type = 'number_string';
          else if (!isNaN(Date.parse(val)) && isNaN(Number(val)) && val.length > 5) type = 'date_string';
        }

        observedTypes[type] = (observedTypes[type] || 0) + 1;
      }

      const typeKeys = Object.keys(observedTypes);
      if (typeKeys.length > 1) {
        const total = Object.values(observedTypes).reduce((a, b) => a + b, 0);
        const dominantTypeCount = Math.max(...Object.values(observedTypes));
        consistencyChecks += total;
        consistentCount += dominantTypeCount;

        if ((dominantTypeCount / total) < 0.9) {
          issues.push({
            id: crypto.randomUUID(),
            dimension: 'consistency',
            severity: 'warning',
            message: `Column "${colName}" has inconsistent value types: ${JSON.stringify(observedTypes)}.`,
            column: colName,
            metadata: { observedTypes }
          });
        }
      } else {
        consistencyChecks += 10;
        consistentCount += 10;
      }
    }

    // Inspect Phase 14 Relationships for orphan foreign-key records
    let relationshipMatchRate = 100;
    try {
      const allRels = await DatasetRelationshipModel.findByOrganizationId(organizationId);
      const datasetRels = allRels.filter(r => Number(r.source_dataset_id) === Number(datasetId));

      for (const rel of datasetRels) {
        if (!rel.target_dataset_id || !rel.source_column || !rel.target_column) continue;

        const targetDataset = await Dataset.findByIdAndOrgId(rel.target_dataset_id, organizationId);
        if (!targetDataset || !targetDataset.file_path) continue;

        let targetRecords = [];
        try {
          targetRecords = await loadDatasetRecords(targetDataset.file_path);
        } catch {
          targetRecords = [];
        }

        if (targetRecords.length === 0) continue;

        const targetKeys = new Set(
          targetRecords
            .map(r => r[rel.target_column])
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => String(v).trim().toLowerCase())
        );

        let orphanCount = 0;
        let sourceKeysEvaluated = 0;

        for (const row of evaluatedRecords) {
          const srcVal = row[rel.source_column];
          if (srcVal === null || srcVal === undefined || srcVal === '') continue;

          sourceKeysEvaluated++;
          const normSrc = String(srcVal).trim().toLowerCase();
          if (!targetKeys.has(normSrc)) {
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
      console.warn(`[DataQualityService] Error evaluating Phase 14 relationship consistency:`, err.message);
    }

    const typeConsistencyScore = consistencyChecks > 0 ? (consistentCount / consistencyChecks) * 100 : 100;
    const overallConsistency = Math.max(0, Math.min(100, Math.round(((typeConsistencyScore * 0.5) + (relationshipMatchRate * 0.5)) * 10) / 10));

    // --- DIMENSION 5: FRESHNESS ---
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
            message: `Dataset refresh is delayed. Age is ${Math.round(ageHours)} hours (expected refresh interval: ${expectedRefreshHours}h).`,
            column: null,
            metadata: { ageHours: Math.round(ageHours), expectedRefreshHours }
          });
        } else {
          freshnessStatus = 'stale';
          freshnessScore = ageHours > expectedRefreshHours * 3 ? 20 : 40;
          issues.push({
            id: crypto.randomUUID(),
            dimension: 'freshness',
            severity: 'critical',
            message: `Dataset is stale. Last updated ${Math.round(ageHours)} hours ago (expected refresh interval: ${expectedRefreshHours}h).`,
            column: null,
            metadata: { ageHours: Math.round(ageHours), expectedRefreshHours }
          });
        }
      } else {
        // Informational freshness when no expectation configured
        freshnessStatus = 'healthy';
        freshnessScore = 100;
      }
    }

    // --- DIMENSION 6: SCHEMA OBSERVABILITY ---
    if (previousSnapshot && previousSnapshot.schema_hash) {
      if (previousSnapshot.schema_hash !== currentSchemaHash) {
        issues.push({
          id: crypto.randomUUID(),
          dimension: 'schema',
          severity: 'info',
          message: `Schema change detected. Current schema hash (${currentSchemaHash}) differs from previous evaluation (${previousSnapshot.schema_hash}).`,
          column: null,
          metadata: {
            previousHash: previousSnapshot.schema_hash,
            currentHash: currentSchemaHash,
            columnCount: columns.length
          }
        });

        // Emit audit log for schema change
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
    }

    // --- DIMENSION 7: VOLUME OBSERVABILITY ---
    if (previousSnapshot && previousSnapshot.row_count !== undefined && previousSnapshot.row_count !== null) {
      const prevRows = Number(previousSnapshot.row_count);
      if (prevRows > 0) {
        const changePct = ((totalRawRows - prevRows) / prevRows) * 100;

        if (changePct <= -20) {
          issues.push({
            id: crypto.randomUUID(),
            dimension: 'volume',
            severity: changePct <= -50 ? 'critical' : 'warning',
            message: `Significant volume decrease detected: row count dropped from ${prevRows.toLocaleString()} to ${totalRawRows.toLocaleString()} (${Math.round(changePct)}%).`,
            column: null,
            metadata: { previousRowCount: prevRows, currentRowCount: totalRawRows, changePct: Math.round(changePct) }
          });
        } else if (changePct >= 100) {
          issues.push({
            id: crypto.randomUUID(),
            dimension: 'volume',
            severity: 'info',
            message: `Significant volume increase detected: row count increased from ${prevRows.toLocaleString()} to ${totalRawRows.toLocaleString()} (+${Math.round(changePct)}%).`,
            column: null,
            metadata: { previousRowCount: prevRows, currentRowCount: totalRawRows, changePct: Math.round(changePct) }
          });
        }
      }
    }

    // --- QUALITY SCORE CALCULATION ---
    // Weighted formula:
    // Completeness (25%), Validity (25%), Uniqueness (20%), Consistency (20%), Freshness (10%)
    const weights = {
      completeness: 0.25,
      validity: 0.25,
      uniqueness: 0.20,
      consistency: 0.20,
      freshness: 0.10
    };

    const weightedScore = (
      (overallCompleteness * weights.completeness) +
      (overallValidity * weights.validity) +
      (overallUniqueness * weights.uniqueness) +
      (overallConsistency * weights.consistency) +
      (freshnessScore * weights.freshness)
    );

    const qualityScore = Math.max(0, Math.min(100, Math.round(weightedScore * 10) / 10));

    let status = 'healthy';
    if (qualityScore < 70) {
      status = 'critical';
    } else if (qualityScore < 85) {
      status = 'warning';
    }

    const dimensions = {
      completeness: {
        score: overallCompleteness,
        weight_pct: 25,
        total_rows: evaluatedRowCount,
        total_cells: totalCellCount,
        missing_cells: totalMissingCells
      },
      validity: {
        score: overallValidity,
        weight_pct: 25,
        total_checks: totalValidityChecks,
        valid_count: totalValidCount,
        invalid_count: totalValidityChecks - totalValidCount
      },
      uniqueness: {
        score: overallUniqueness,
        weight_pct: 20,
        total_rows: evaluatedRowCount,
        duplicate_rows: duplicateRowCount,
        duplicate_percentage: Math.round(duplicatePct * 10) / 10
      },
      consistency: {
        score: overallConsistency,
        weight_pct: 20,
        type_consistency_score: Math.round(typeConsistencyScore * 10) / 10,
        relationship_match_rate: Math.round(relationshipMatchRate * 10) / 10
      },
      freshness: {
        score: freshnessScore,
        weight_pct: 10,
        status: freshnessStatus,
        age_hours: ageHours !== null ? Math.round(ageHours * 10) / 10 : null,
        last_updated: lastUpdatedDate ? lastUpdatedDate.toISOString() : null
      }
    };

    // 7. Persist quality snapshot
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
      rowCount: totalRawRows,
      columnCount: columns.length,
      scanMode,
      sampleSize,
      schemaHash: currentSchemaHash,
      dimensions,
      columnMetrics,
      issues
    });

    // 8. Audit event creation
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

    if (issues.some(i => i.severity === 'critical')) {
      auditService.log({
        organizationId,
        userId: options.userId || null,
        action: 'DATA_QUALITY_ISSUE_DETECTED',
        resourceType: 'dataset',
        resourceId: String(datasetId),
        description: `Critical data quality issues detected in dataset "${dataset.name}".`,
        metadata: { qualityScore, criticalIssues: issues.filter(i => i.severity === 'critical') },
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null
      }).catch(() => {});
    }

    // 9. Alert engine integration (check any alert configured for this dataset)
    try {
      const orgAlerts = await AlertModel.findByOrganizationId(organizationId);
      const datasetAlerts = orgAlerts.filter(a => Number(a.dataset_id) === Number(datasetId) && a.status === 'active');
      for (const alert of datasetAlerts) {
        await alertEvaluator.evaluateAlertRule(alert, { overrideMetricValue: qualityScore }).catch(() => {});
      }
    } catch (err) {
      console.warn(`[DataQualityService] Alert evaluation failed for dataset quality:`, err.message);
    }

    return {
      id: savedSnapshot.id,
      dataset_id: Number(datasetId),
      dataset_name: dataset.name,
      quality_score: qualityScore,
      status,
      scan_mode: scanMode,
      sample_size: sampleSize,
      total_rows: totalRawRows,
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
   * Get latest quality profile for a dataset (or trigger evaluation if not evaluated yet)
   * @param {number|string} datasetId 
   * @param {string} organizationId 
   * @param {object} [options={}]
   * @returns {Promise<any>}
   */
  async getQualityProfile(datasetId, organizationId, options = {}) {
    if (!datasetId || !organizationId) {
      throw new Error('Dataset ID and Organization ID are required.');
    }

    const latest = await DataQualityModel.getLatestSnapshot(datasetId, organizationId);
    if (latest && !options.forceReevaluate) {
      const dataset = await Dataset.findByIdAndOrgId(datasetId, organizationId);
      return {
        ...latest,
        dataset_name: dataset ? dataset.name : null,
        total_rows: Number(latest.row_count || 0),
        column_count: Number(latest.column_count || 0),
        dimensions: typeof latest.dimensions === 'string' ? JSON.parse(latest.dimensions) : (latest.dimensions || {}),
        column_metrics: typeof latest.column_metrics === 'string' ? JSON.parse(latest.column_metrics) : (latest.column_metrics || []),
        issues: typeof latest.issues === 'string' ? JSON.parse(latest.issues) : (latest.issues || [])
      };
    }

    return this.evaluateDatasetQuality(datasetId, organizationId, options);
  }

  /**
   * Get column-level quality breakdown for a dataset
   * @param {number|string} datasetId 
   * @param {string} organizationId 
   * @returns {Promise<Array<any>>}
   */
  async getColumnMetrics(datasetId, organizationId) {
    const profile = await this.getQualityProfile(datasetId, organizationId);
    return profile.column_metrics || [];
  }

  /**
   * Get historical quality evaluation snapshots for a dataset
   * @param {number|string} datasetId 
   * @param {string} organizationId 
   * @param {number} [limit=20] 
   * @returns {Promise<Array<any>>}
   */
  async getQualityHistory(datasetId, organizationId, limit = 20) {
    if (!datasetId || !organizationId) {
      throw new Error('Dataset ID and Organization ID are required.');
    }
    return DataQualityModel.getSnapshotHistory(datasetId, organizationId, limit);
  }

  /**
   * Custom Quality Rules Management
   */

  /**
   * Validate and create a custom quality rule
   */
  async createRule({
    organizationId,
    datasetId,
    columnName,
    ruleType,
    configuration = {},
    severity = 'warning',
    enabled = true,
    createdBy = null,
    ipAddress = null,
    userAgent = null
  }) {
    if (!organizationId) throw new Error('Organization ID is required.');
    if (!datasetId) throw new Error('Dataset ID is required.');
    if (!columnName || !String(columnName).trim()) throw new Error('Column name is required.');
    if (!ruleType || !String(ruleType).trim()) throw new Error('Rule type is required.');

    const dataset = await Dataset.findByIdAndOrgId(datasetId, organizationId);
    if (!dataset) {
      const err = new Error(`Dataset #${datasetId} not found.`);
      err.status = 404;
      throw err;
    }

    const validTypes = ['not_null', 'unique', 'min_value', 'max_value', 'range', 'regex', 'allowed_values', 'type_check'];
    const normType = String(ruleType).trim().toLowerCase();
    if (!validTypes.includes(normType)) {
      throw new Error(`Invalid rule_type "${ruleType}". Allowed types: ${validTypes.join(', ')}.`);
    }

    const validSeverities = ['info', 'warning', 'critical'];
    const normSeverity = String(severity || 'warning').trim().toLowerCase();
    if (!validSeverities.includes(normSeverity)) {
      throw new Error(`Invalid severity "${severity}". Allowed severities: ${validSeverities.join(', ')}.`);
    }

    const createdRule = await DataQualityModel.createRule({
      organizationId,
      datasetId,
      columnName: String(columnName).trim(),
      ruleType: normType,
      configuration: typeof configuration === 'object' ? configuration : {},
      severity: normSeverity,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      createdBy
    });

    auditService.log({
      organizationId,
      userId: createdBy || null,
      action: 'DATA_QUALITY_RULE_CREATED',
      resourceType: 'data_quality_rule',
      resourceId: String(createdRule.id),
      description: `Created data quality rule "${normType}" on column "${columnName}" for dataset #${datasetId}.`,
      metadata: { datasetId, columnName, ruleType: normType, severity: normSeverity },
      ipAddress,
      userAgent
    }).catch(() => {});

    return createdRule;
  }

  /**
   * List quality rules for a dataset or organization
   */
  async getRules(datasetId, organizationId) {
    if (datasetId) {
      return DataQualityModel.findRulesByDatasetId(datasetId, organizationId);
    }
    return DataQualityModel.findRulesByOrgId(organizationId);
  }

  /**
   * Get single rule by ID
   */
  async getRuleById(id, organizationId) {
    return DataQualityModel.findRuleByIdAndOrgId(id, organizationId);
  }

  /**
   * Update a custom quality rule
   */
  async updateRule(id, organizationId, updates, { userId = null, ipAddress = null, userAgent = null } = {}) {
    const existing = await DataQualityModel.findRuleByIdAndOrgId(id, organizationId);
    if (!existing) {
      const err = new Error(`Quality rule #${id} not found.`);
      err.status = 404;
      throw err;
    }

    if (updates.ruleType) {
      const validTypes = ['not_null', 'unique', 'min_value', 'max_value', 'range', 'regex', 'allowed_values', 'type_check'];
      if (!validTypes.includes(String(updates.ruleType).trim().toLowerCase())) {
        throw new Error(`Invalid rule_type "${updates.ruleType}". Allowed types: ${validTypes.join(', ')}.`);
      }
    }

    if (updates.severity) {
      const validSeverities = ['info', 'warning', 'critical'];
      if (!validSeverities.includes(String(updates.severity).trim().toLowerCase())) {
        throw new Error(`Invalid severity "${updates.severity}". Allowed severities: ${validSeverities.join(', ')}.`);
      }
    }

    const updated = await DataQualityModel.updateRule(id, organizationId, updates);

    auditService.log({
      organizationId,
      userId,
      action: 'DATA_QUALITY_RULE_UPDATED',
      resourceType: 'data_quality_rule',
      resourceId: String(id),
      description: `Updated data quality rule #${id}.`,
      metadata: { updates },
      ipAddress,
      userAgent
    }).catch(() => {});

    return updated;
  }

  /**
   * Delete a custom quality rule
   */
  async deleteRule(id, organizationId, { userId = null, ipAddress = null, userAgent = null } = {}) {
    const existing = await DataQualityModel.findRuleByIdAndOrgId(id, organizationId);
    if (!existing) {
      const err = new Error(`Quality rule #${id} not found.`);
      err.status = 404;
      throw err;
    }

    const deleted = await DataQualityModel.deleteRule(id, organizationId);

    auditService.log({
      organizationId,
      userId,
      action: 'DATA_QUALITY_RULE_DELETED',
      resourceType: 'data_quality_rule',
      resourceId: String(id),
      description: `Deleted data quality rule #${id}.`,
      metadata: { datasetId: existing.dataset_id, columnName: existing.column_name, ruleType: existing.rule_type },
      ipAddress,
      userAgent
    }).catch(() => {});

    return deleted;
  }
}

module.exports = new DataQualityService();
