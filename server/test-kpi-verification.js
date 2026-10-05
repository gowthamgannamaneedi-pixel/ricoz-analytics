const Dataset = require('./models/datasetModel');
const { getVerifiedDataset, loadDatasetRecords, detectDatasetDimensions, computeDatasetKpis } = require('./services/analyticsService');

async function run() {
  const orgId = '00000000-0000-0000-0000-000000000001';
  const datasets = await Dataset.findByOrganizationId(orgId);
  console.log('Datasets found via Dataset.findByOrganizationId:', datasets.length);

  for (const ds of datasets) {
    console.log(`\n======================================================`);
    console.log(`DATASET ID: ${ds.id} | NAME: ${ds.name} | FILE: ${ds.file_path}`);
    console.log(`======================================================`);

    const records = await loadDatasetRecords(ds.file_path);
    const schema = typeof ds.schema === 'string' ? JSON.parse(ds.schema) : (ds.schema || []);
    console.log('Schema columns:', schema.map(s => `${s.name} (${s.type})`).join(', '));
    console.log('Total records loaded:', records.length);
    if (records.length > 0) {
      console.log('Sample row (first 2):', records.slice(0, 2));
    }

    const dimensions = detectDatasetDimensions(schema, records.slice(0, 100));
    console.log('Detected Dimensions:', dimensions);

    const kpis = computeDatasetKpis(records, records, dimensions);
    console.log('Computed KPIs:', kpis);

    const idCol = dimensions.orderIdColumn;
    const qtyCol = dimensions.quantityMetric;
    const primaryCol = dimensions.primaryMetric;

    if (idCol) {
      const distinctOrders = new Set(records.map(r => r[idCol]).filter(v => v !== undefined && v !== null && String(v).trim() !== ''));
      console.log(`Manual COUNT(DISTINCT ${idCol}):`, distinctOrders.size);
      console.log(`Total rows:`, records.length);
    } else {
      console.log('NO orderIdColumn detected! Checking possible columns in row:');
      if (records.length > 0) {
        console.log(Object.keys(records[0]));
      }
    }

    if (qtyCol) {
      const sumQty = records.reduce((acc, r) => acc + (Number(r[qtyCol]) || 0), 0);
      console.log(`Manual SUM(${qtyCol}):`, sumQty);
    } else {
      console.log('NO quantityMetric detected!');
    }

    if (primaryCol) {
      const sumPrimary = records.reduce((acc, r) => acc + (Number(r[primaryCol]) || 0), 0);
      console.log(`Manual SUM(${primaryCol}):`, sumPrimary);
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Error running test:', err);
  process.exit(1);
});
