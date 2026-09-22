/**
 * File Parser & Metadata Extractor Service
 * High-performance parser for CSV and JSON datasets with automatic schema inference
 */

/**
 * Infer data type of a value
 * @param {any} val 
 * @returns {'number'|'boolean'|'date'|'string'}
 */
function inferValueType(val) {
  if (val === null || val === undefined || val === '') {
    return 'string';
  }
  const str = String(val).trim();

  // Boolean check
  if (str.toLowerCase() === 'true' || str.toLowerCase() === 'false') {
    return 'boolean';
  }

  // Number check (supports integers, decimals, negative numbers)
  if (!isNaN(str) && !isNaN(parseFloat(str)) && isFinite(str)) {
    return 'number';
  }

  // Date check (YYYY-MM-DD or standard parseable date string longer than 7 chars)
  if (str.length >= 8 && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    const parsedDate = Date.parse(str);
    if (!isNaN(parsedDate)) {
      return 'date';
    }
  }

  return 'string';
}

/**
 * Parse CSV line accounting for quotes, escaped quotes, and commas
 * @param {string} line 
 * @param {string} delimiter 
 * @returns {string[]}
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
        i++; // skip escaped quote
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

/**
 * Parse CSV buffer or string
 * @param {Buffer|string} content 
 * @param {number} maxPreviewRows 
 * @returns {{ rowCount: number, columnCount: number, schema: Array<{ name: string, type: string, sample: any }>, preview: any[] }}
 */
function parseCsv(content, maxPreviewRows = 50) {
  const text = Buffer.isBuffer(content) ? content.toString('utf-8') : String(content);
  // Normalize line endings
  const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('CSV file is empty.');
  }

  // Determine delimiter (comma or semicolon)
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  let delimiter = ',';
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  const headers = parseCsvLine(firstLine, delimiter).map((h, idx) => {
    const cleaned = h.replace(/^["']|["']$/g, '').trim();
    return cleaned || `column_${idx + 1}`;
  });

  const totalRows = lines.length - 1;
  const preview = [];
  const typeCounter = headers.map(() => ({ number: 0, boolean: 0, date: 0, string: 0, total: 0 }));

  const limit = Math.min(lines.length, 100); // inspect up to 100 rows for schema inference

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    const rowObj = {};

    headers.forEach((header, colIdx) => {
      let rawVal = values[colIdx] !== undefined ? values[colIdx].replace(/^["']|["']$/g, '') : '';
      
      // Type inference tally on first 100 rows
      if (i <= limit && rawVal !== '') {
        const inferred = inferValueType(rawVal);
        typeCounter[colIdx][inferred]++;
        typeCounter[colIdx].total++;
      }

      // Convert value for preview
      const type = inferValueType(rawVal);
      if (type === 'number' && rawVal !== '') {
        rowObj[header] = Number(rawVal);
      } else if (type === 'boolean' && rawVal !== '') {
        rowObj[header] = rawVal.toLowerCase() === 'true' || rawVal === '1';
      } else {
        rowObj[header] = rawVal;
      }
    });

    if (preview.length < maxPreviewRows) {
      preview.push(rowObj);
    }
  }

  // Finalize schema
  const schema = headers.map((header, colIdx) => {
    const counts = typeCounter[colIdx];
    let dominantType = 'string';

    if (counts.total > 0) {
      if (counts.number / counts.total >= 0.7) dominantType = 'number';
      else if (counts.date / counts.total >= 0.7) dominantType = 'date';
      else if (counts.boolean / counts.total >= 0.7) dominantType = 'boolean';
    }

    const firstSample = preview.length > 0 ? preview[0][header] : null;

    return {
      name: header,
      type: dominantType,
      sample: firstSample
    };
  });

  return {
    rowCount: totalRows,
    columnCount: headers.length,
    schema,
    preview
  };
}

/**
 * Parse JSON buffer or string
 * @param {Buffer|string} content 
 * @param {number} maxPreviewRows 
 * @returns {{ rowCount: number, columnCount: number, schema: Array<{ name: string, type: string, sample: any }>, preview: any[] }}
 */
function parseJson(content, maxPreviewRows = 50) {
  const text = Buffer.isBuffer(content) ? content.toString('utf-8') : String(content);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err.message}`);
  }

  // Normalize to array of objects
  let records = [];
  if (Array.isArray(parsed)) {
    records = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Check if any property contains array of records (e.g. { data: [...], items: [...] })
    const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
    if (arrayKey) {
      records = parsed[arrayKey];
    } else {
      records = [parsed];
    }
  } else {
    throw new Error('JSON structure must be an array of records or an object containing an array.');
  }

  if (records.length === 0) {
    throw new Error('JSON dataset contains no records.');
  }

  // Collect all unique keys across records
  const headersSet = new Set();
  const sampleLimit = Math.min(records.length, 100);
  for (let i = 0; i < sampleLimit; i++) {
    if (records[i] && typeof records[i] === 'object') {
      Object.keys(records[i]).forEach(k => headersSet.add(k));
    }
  }

  const headers = Array.from(headersSet);
  const totalRows = records.length;
  const preview = records.slice(0, maxPreviewRows);

  const schema = headers.map(header => {
    let dominantType = 'string';
    let samples = records.slice(0, sampleLimit).map(r => r ? r[header] : undefined).filter(v => v !== undefined && v !== null);

    if (samples.length > 0) {
      const typeCounts = { number: 0, boolean: 0, date: 0, string: 0 };
      samples.forEach(s => {
        const t = typeof s === 'number' ? 'number' : typeof s === 'boolean' ? 'boolean' : inferValueType(s);
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });

      if (typeCounts.number / samples.length >= 0.7) dominantType = 'number';
      else if (typeCounts.date / samples.length >= 0.7) dominantType = 'date';
      else if (typeCounts.boolean / samples.length >= 0.7) dominantType = 'boolean';
    }

    return {
      name: header,
      type: dominantType,
      sample: preview.length > 0 ? preview[0][header] : null
    };
  });

  return {
    rowCount: totalRows,
    columnCount: headers.length,
    schema,
    preview
  };
}

/**
 * Universal parse function based on file extension / type
 */
function parseDatasetFile(content, fileExtension, maxPreviewRows = 50) {
  const ext = fileExtension.toLowerCase().replace('.', '');
  if (ext === 'csv') {
    return parseCsv(content, maxPreviewRows);
  } else if (ext === 'json') {
    return parseJson(content, maxPreviewRows);
  } else {
    throw new Error(`Unsupported file extension: .${ext}. Only CSV and JSON are supported.`);
  }
}

module.exports = {
  parseCsv,
  parseJson,
  parseDatasetFile,
  inferValueType
};
