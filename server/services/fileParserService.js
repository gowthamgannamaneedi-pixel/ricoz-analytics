const fs = require('fs');
const readline = require('readline');
const { Readable } = require('stream');

/**
 * File Parser & Metadata Extractor Service
 * High-performance streaming parser for CSV and JSON datasets with automatic schema inference
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
 * Parse CSV line accounting for quotes, escaped quotes, and delimiters
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
 * Detect delimiter from raw header line
 * @param {string} line
 * @returns {string}
 */
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
 * Stream-based CSV parser that processes multi-million row datasets with constant memory footprint
 * @param {import('stream').Readable|string|Buffer} source File path, Readable stream, or Buffer
 * @param {number} maxPreviewRows Number of preview rows to retain (default 50)
 * @param {number} maxSchemaRows Number of rows to sample for schema inference (default 100)
 * @returns {Promise<{ rowCount: number, columnCount: number, schema: Array<{ name: string, type: string, sample: any }>, preview: any[] }>}
 */
async function parseCsvStream(source, maxPreviewRows = 50, maxSchemaRows = 100) {
  let inputStream;

  if (typeof source === 'string') {
    if (fs.existsSync(source)) {
      inputStream = fs.createReadStream(source, { encoding: 'utf8' });
    } else {
      // Raw string content
      inputStream = Readable.from([source]);
    }
  } else if (Buffer.isBuffer(source)) {
    inputStream = Readable.from([source.toString('utf8')]);
  } else if (source && typeof source.pipe === 'function') {
    inputStream = source;
  } else {
    throw new Error('Invalid input source for CSV parsing');
  }

  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity
  });

  let isHeader = true;
  let delimiter = ',';
  let headers = [];
  let totalRows = 0;
  const preview = [];
  let typeCounter = [];

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isHeader) {
      delimiter = detectDelimiter(line);
      headers = parseCsvLine(line, delimiter).map((h, idx) => {
        const cleaned = h.replace(/^["']|["']$/g, '').trim();
        return cleaned || `column_${idx + 1}`;
      });
      typeCounter = headers.map(() => ({ number: 0, boolean: 0, date: 0, string: 0, total: 0 }));
      isHeader = false;
      continue;
    }

    totalRows++;
    const isSample = totalRows <= maxSchemaRows;
    const isPreview = preview.length < maxPreviewRows;

    if (isSample || isPreview) {
      const values = parseCsvLine(line, delimiter);
      const rowObj = {};

      headers.forEach((header, colIdx) => {
        let rawVal = values[colIdx] !== undefined ? values[colIdx].replace(/^["']|["']$/g, '').trim() : '';

        if (isSample && rawVal !== '') {
          const inferred = inferValueType(rawVal);
          typeCounter[colIdx][inferred]++;
          typeCounter[colIdx].total++;
        }

        if (isPreview) {
          const type = inferValueType(rawVal);
          if (type === 'number' && rawVal !== '') {
            rowObj[header] = Number(rawVal);
          } else if (type === 'boolean' && rawVal !== '') {
            rowObj[header] = rawVal.toLowerCase() === 'true' || rawVal === '1';
          } else {
            rowObj[header] = rawVal;
          }
        }
      });

      if (isPreview) {
        preview.push(rowObj);
      }
    }
  }

  if (isHeader && headers.length === 0) {
    throw new Error('CSV file is empty.');
  }

  // Finalize schema inference
  const schema = headers.map((header, colIdx) => {
    const counts = typeCounter[colIdx] || { number: 0, boolean: 0, date: 0, string: 0, total: 0 };
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
 * Fast stream preview extractor: reads only up to maxPreviewRows without scanning full dataset
 * @param {import('stream').Readable|string|Buffer} source
 * @param {string} ext
 * @param {number} maxPreviewRows
 */
async function parseDatasetPreviewStream(source, ext = 'csv', maxPreviewRows = 50) {
  const normalizedExt = (ext || 'csv').toLowerCase().replace('.', '');
  if (normalizedExt === 'csv') {
    let inputStream;
    if (typeof source === 'string' && fs.existsSync(source)) {
      inputStream = fs.createReadStream(source, { encoding: 'utf8' });
    } else if (Buffer.isBuffer(source)) {
      inputStream = Readable.from([source.toString('utf8')]);
    } else if (source && typeof source.pipe === 'function') {
      inputStream = source;
    } else {
      inputStream = Readable.from([String(source)]);
    }

    const rl = readline.createInterface({
      input: inputStream,
      crlfDelay: Infinity
    });

    let isHeader = true;
    let delimiter = ',';
    let headers = [];
    const preview = [];

    for await (const rawLine of rl) {
      const line = rawLine.trim();
      if (!line) continue;

      if (isHeader) {
        delimiter = detectDelimiter(line);
        headers = parseCsvLine(line, delimiter).map((h, idx) => {
          const cleaned = h.replace(/^["']|["']$/g, '').trim();
          return cleaned || `column_${idx + 1}`;
        });
        isHeader = false;
        continue;
      }

      const values = parseCsvLine(line, delimiter);
      const rowObj = {};
      headers.forEach((header, colIdx) => {
        let rawVal = values[colIdx] !== undefined ? values[colIdx].replace(/^["']|["']$/g, '').trim() : '';
        const type = inferValueType(rawVal);
        if (type === 'number' && rawVal !== '') {
          rowObj[header] = Number(rawVal);
        } else if (type === 'boolean' && rawVal !== '') {
          rowObj[header] = rawVal.toLowerCase() === 'true' || rawVal === '1';
        } else {
          rowObj[header] = rawVal;
        }
      });

      preview.push(rowObj);
      if (preview.length >= maxPreviewRows) {
        rl.close();
        if (inputStream.destroy) inputStream.destroy();
        break;
      }
    }

    return { preview };
  } else if (normalizedExt === 'xlsx' || normalizedExt === 'xls') {
    const result = await parseExcel(source, maxPreviewRows);
    return { preview: result.preview.slice(0, maxPreviewRows) };
  } else {
    // JSON fallback
    const result = await parseDatasetFile(source, 'json', maxPreviewRows);
    return { preview: result.preview.slice(0, maxPreviewRows) };
  }
}

/**
 * Synchronous/In-memory fallback parse CSV buffer or string
 * @param {Buffer|string} content 
 * @param {number} maxPreviewRows 
 * @returns {{ rowCount: number, columnCount: number, schema: Array<{ name: string, type: string, sample: any }>, preview: any[] }}
 */
function parseCsv(content, maxPreviewRows = 50) {
  const text = Buffer.isBuffer(content) ? content.toString('utf-8') : String(content);
  const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const firstLine = lines[0];
  const delimiter = detectDelimiter(firstLine);

  const headers = parseCsvLine(firstLine, delimiter).map((h, idx) => {
    const cleaned = h.replace(/^["']|["']$/g, '').trim();
    return cleaned || `column_${idx + 1}`;
  });

  const totalRows = lines.length - 1;
  const preview = [];
  const typeCounter = headers.map(() => ({ number: 0, boolean: 0, date: 0, string: 0, total: 0 }));
  const limit = Math.min(lines.length, 100);

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    const rowObj = {};

    headers.forEach((header, colIdx) => {
      let rawVal = values[colIdx] !== undefined ? values[colIdx].replace(/^["']|["']$/g, '') : '';
      
      if (i <= limit && rawVal !== '') {
        const inferred = inferValueType(rawVal);
        typeCounter[colIdx][inferred]++;
        typeCounter[colIdx].total++;
      }

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
 * Parse JSON buffer or string or file path
 * @param {Buffer|string} content 
 * @param {number} maxPreviewRows 
 * @returns {{ rowCount: number, columnCount: number, schema: Array<{ name: string, type: string, sample: any }>, preview: any[] }}
 */
async function parseJson(content, maxPreviewRows = 50) {
  let text;
  if (content && (typeof content.pipe === 'function' || typeof content.on === 'function')) {
    const chunks = [];
    for await (const chunk of content) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    text = Buffer.concat(chunks).toString('utf-8');
  } else if (typeof content === 'string' && fs.existsSync(content)) {
    text = fs.readFileSync(content, 'utf8');
  } else {
    text = Buffer.isBuffer(content) ? content.toString('utf-8') : String(content);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err.message}`);
  }

  let records = [];
  if (Array.isArray(parsed)) {
    records = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
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
 * High-performance Excel (.xlsx, .xls) parser powered by ExcelJS
 * Extracts sheets, auto-detects headers, infers data types, and normalizes duplicates
 * @param {Buffer|string|import('stream').Readable} source
 * @param {number} maxPreviewRows
 */
async function parseExcel(source, maxPreviewRows = 50) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();

  if (typeof source === 'string' && fs.existsSync(source)) {
    await workbook.xlsx.readFile(source);
  } else if (Buffer.isBuffer(source)) {
    await workbook.xlsx.load(source);
  } else if (source && typeof source.pipe === 'function') {
    await workbook.xlsx.read(source);
  } else {
    throw new Error('Invalid Excel source: expected valid file path, buffer, or readable stream.');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) {
    throw new Error('Excel workbook contains no sheets or data rows.');
  }

  // Row 1 is headers
  const headerRow = worksheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    let val = cell.value !== null && cell.value !== undefined ? String(cell.value).trim() : '';
    if (typeof cell.value === 'object' && cell.value !== null) {
      if (cell.value.text) val = cell.value.text;
      else if (cell.value.result !== undefined) val = String(cell.value.result);
    }
    headers.push({ name: val || `column_${colNumber}`, colNumber });
  });

  if (headers.length === 0) {
    throw new Error('Excel worksheet contains no valid column headers in row 1.');
  }

  // Deduplicate column names
  const colCounts = {};
  headers.forEach(h => {
    colCounts[h.name] = (colCounts[h.name] || 0) + 1;
    if (colCounts[h.name] > 1) {
      h.name = `${h.name}_${colCounts[h.name]}`;
    }
  });

  const records = [];
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    let hasVal = false;
    const rowObj = {};
    headers.forEach(h => {
      let cellVal = row.getCell(h.colNumber).value;
      if (cellVal && typeof cellVal === 'object') {
        if (cellVal.result !== undefined) cellVal = cellVal.result;
        else if (cellVal.text !== undefined) cellVal = cellVal.text;
      }
      if (cellVal instanceof Date) {
        cellVal = cellVal.toISOString().split('T')[0];
      }
      if (cellVal !== undefined && cellVal !== null && cellVal !== '') {
        hasVal = true;
      }
      rowObj[h.name] = cellVal !== undefined && cellVal !== null ? cellVal : '';
    });
    if (hasVal) {
      records.push(rowObj);
    }
  }

  if (records.length === 0) {
    throw new Error('Excel sheet contains headers but no data records.');
  }

  const sampleLimit = Math.min(records.length, 100);
  const schema = headers.map(h => {
    let dominantType = 'string';
    const samples = records.slice(0, sampleLimit).map(r => r[h.name]).filter(v => v !== undefined && v !== null && v !== '');
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
      name: h.name,
      type: dominantType,
      sample: records.length > 0 ? records[0][h.name] : null
    };
  });

  return {
    rowCount: records.length,
    columnCount: headers.length,
    schema,
    preview: records.slice(0, maxPreviewRows)
  };
}

/**
 * Universal parse function based on file extension / type
 * @param {Buffer|string|import('stream').Readable} content File content buffer, file path, or stream
 * @param {string} fileExtension
 * @param {number} maxPreviewRows
 */
async function parseDatasetFile(content, fileExtension, maxPreviewRows = 50) {
  const ext = (fileExtension || '').toLowerCase().replace('.', '');
  if (ext === 'csv') {
    if (typeof content === 'string' && fs.existsSync(content)) {
      const buf = fs.readFileSync(content);
      return parseCsv(buf, maxPreviewRows);
    } else if (content && typeof content.pipe === 'function') {
      return parseCsvStream(content, maxPreviewRows);
    } else {
      return parseCsv(content, maxPreviewRows);
    }
  } else if (ext === 'json') {
    return parseJson(content, maxPreviewRows);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(content, maxPreviewRows);
  } else {
    throw new Error(`Unsupported file extension: .${ext}. Only CSV, JSON, and Excel (.xlsx, .xls) are supported.`);
  }
}

/**
 * Universal async streaming parse function
 * @param {Buffer|string|import('stream').Readable} source File path, stream, or buffer
 * @param {string} fileExtension
 * @param {number} maxPreviewRows
 */
async function parseDatasetFileStream(source, fileExtension, maxPreviewRows = 50) {
  const ext = (fileExtension || '').toLowerCase().replace('.', '');
  if (ext === 'csv') {
    return await parseCsvStream(source, maxPreviewRows);
  } else if (ext === 'json') {
    return parseJson(source, maxPreviewRows);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(source, maxPreviewRows);
  } else {
    throw new Error(`Unsupported file extension: .${ext}. Only CSV, JSON, and Excel (.xlsx, .xls) are supported.`);
  }
}

module.exports = {
  parseCsv,
  parseCsvStream,
  parseDatasetPreviewStream,
  parseDatasetFileStream,
  parseJson,
  parseExcel,
  parseDatasetFile,
  inferValueType,
  parseCsvLine,
  detectDelimiter
};
