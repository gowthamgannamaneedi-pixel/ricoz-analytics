const db = require('../server/config/database');

async function testMetadata(datasetId) {
  const dRes = await db.query("SELECT * FROM datasets WHERE id = $1", [datasetId]);
  const dataset = dRes.rows[0];
  if (!dataset) return console.log('Dataset not found');

  const rowsRes = await db.query("SELECT data FROM dataset_rows WHERE dataset_id = $1 LIMIT 500", [datasetId]);
  const rows = rowsRes.rows.map(r => r.data);

  let schemaCols = [];
  if (Array.isArray(dataset.schema)) {
    schemaCols = dataset.schema.map(c => typeof c === 'string' ? { name: c, type: 'string' } : { name: c.name || c.key, type: c.type || 'string' });
  } else if (rows[0]) {
    schemaCols = Object.keys(rows[0]).map(k => ({
      name: k,
      type: typeof rows[0][k] === 'number' ? 'numeric' : (String(rows[0][k]).match(/^\d{4}-\d{2}-\d{2}/) ? 'date' : 'string')
    }));
  }

  // Refine types using actual row values
  schemaCols.forEach(col => {
    const sampleVals = rows.map(r => r[col.name]).filter(v => v !== null && v !== undefined && v !== '');
    if (sampleVals.length > 0) {
      if (sampleVals.every(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== ''))) {
        col.type = sampleVals.every(v => Number.isInteger(Number(v))) ? 'integer' : 'numeric';
      } else if (sampleVals.every(v => !isNaN(Date.parse(v)) && String(v).includes('-'))) {
        col.type = 'date';
      } else {
        col.type = 'string';
      }
    }
  });

  const numericCols = schemaCols.filter(c => c.type === 'numeric' || c.type === 'integer');
  const dateCols = schemaCols.filter(c => c.type === 'date');
  
  let dateRange = null;
  if (dateCols.length > 0) {
    const dateCol = dateCols[0].name;
    const dates = rows.map(r => String(r[dateCol] || '')).filter(Boolean).sort();
    if (dates.length > 0) {
      dateRange = { min: dates[0], max: dates[dates.length - 1] };
    }
  }

  let totalCells = rows.length * schemaCols.length;
  let missingCount = 0;
  rows.forEach(r => {
    schemaCols.forEach(c => {
      const v = r[c.name];
      if (v === null || v === undefined || v === '') missingCount++;
    });
  });

  console.log('Dataset Name:', dataset.name);
  console.log('Columns (' + schemaCols.length + '):', schemaCols);
  console.log('Numeric columns (' + numericCols.length + '):', numericCols.map(c => c.name));
  console.log('Rows count:', rows.length);
  console.log('Date range:', dateRange);
  console.log('Missing values:', missingCount);
}

testMetadata(391).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
