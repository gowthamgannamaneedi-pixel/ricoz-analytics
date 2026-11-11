const db = require('../server/config/database');

async function setupAcceptanceDatasets() {
  const orgId = '00000000-0000-0000-0000-000000000001';
  const userId = 1;

  console.log('--- Setting up Acceptance Test Datasets ---');

  // Helper to ensure dataset and rows
  async function ensureDataset(name, schema, rows) {
    let dsRes = await db.query('SELECT * FROM datasets WHERE name = $1 AND organization_id = $2', [name, orgId]);
    let dataset = dsRes.rows[0];

    if (!dataset) {
      const insRes = await db.query(`
        INSERT INTO datasets (user_id, organization_id, name, description, row_count, column_count, schema, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `, [userId, orgId, name, `Acceptance Test Dataset: ${name}`, rows.length, schema.length, JSON.stringify(schema)]);
      dataset = insRes.rows[0];
      console.log(`Created dataset: ${name} (ID: ${dataset.id})`);
    } else {
      await db.query(`
        UPDATE datasets SET row_count = $1, column_count = $2, schema = $3, updated_at = NOW()
        WHERE id = $4
      `, [rows.length, schema.length, JSON.stringify(schema), dataset.id]);
      console.log(`Updated dataset metadata: ${name} (ID: ${dataset.id})`);
    }

    // Refresh rows
    await db.query('DELETE FROM dataset_rows WHERE dataset_id = $1', [dataset.id]);
    for (let i = 0; i < rows.length; i++) {
      await db.query('INSERT INTO dataset_rows (dataset_id, row_index, data) VALUES ($1, $2, $3)', [dataset.id, i, JSON.stringify(rows[i])]);
    }
    console.log(`Inserted ${rows.length} rows for dataset ${dataset.id} (${name})`);
    return dataset.id;
  }

  // Dataset 1: Mixed Variance Telemetry (Already exists as 391, verify it)
  const ds1Id = 391;

  // Dataset 2: No Date Column (Enterprise Customer Directory)
  const ds2Schema = [
    { name: 'customer_id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'segment', type: 'string' },
    { name: 'credit_limit', type: 'integer' }
  ];
  const ds2Rows = [
    { customer_id: 'CUST-001', name: 'Alpha Retailers', segment: 'Enterprise', credit_limit: 500000 },
    { customer_id: 'CUST-002', name: 'Beta Solutions', segment: 'Mid-Market', credit_limit: 250000 },
    { customer_id: 'CUST-003', name: 'Gamma Traders', segment: 'SMB', credit_limit: 100000 },
    { customer_id: 'CUST-004', name: 'Delta Logistics', segment: 'Enterprise', credit_limit: 750000 },
    { customer_id: 'CUST-005', name: 'Epsilon Tech', segment: 'Mid-Market', credit_limit: 300000 },
    { customer_id: 'CUST-006', name: 'Zeta Ventures', segment: 'SMB', credit_limit: 120000 }
  ];
  const ds2Id = await ensureDataset('Enterprise Customer Directory', ds2Schema, ds2Rows);

  // Dataset 3: With Missing Values (Audit Telemetry With Missing Values)
  const ds3Schema = [
    { name: 'date', type: 'date' },
    { name: 'store_id', type: 'string' },
    { name: 'sales_amount', type: 'integer' },
    { name: 'visitor_count', type: 'integer' },
    { name: 'rating', type: 'numeric' }
  ];
  const ds3Rows = [
    { date: '2026-03-01', store_id: 'STR-101', sales_amount: 15000, visitor_count: 320, rating: 4.5 },
    { date: '2026-03-02', store_id: 'STR-102', sales_amount: null, visitor_count: 210, rating: 4.1 },
    { date: '2026-03-03', store_id: 'STR-101', sales_amount: 22000, visitor_count: null, rating: 4.8 },
    { date: null, store_id: 'STR-103', sales_amount: 18000, visitor_count: 290, rating: null },
    { date: '2026-03-05', store_id: 'STR-102', sales_amount: 12500, visitor_count: 180, rating: 3.9 },
    { date: '2026-03-06', store_id: 'STR-104', sales_amount: null, visitor_count: null, rating: 4.2 },
    { date: '2026-03-07', store_id: 'STR-103', sales_amount: 31000, visitor_count: 450, rating: 4.9 },
    { date: null, store_id: 'STR-104', sales_amount: 9000, visitor_count: 150, rating: null }
  ];
  const ds3Id = await ensureDataset('Audit Telemetry With Missing Values', ds3Schema, ds3Rows);

  // Dataset 4: With Duplicate Records (Audit Telemetry With Duplicate Records)
  const ds4Schema = [
    { name: 'transaction_id', type: 'string' },
    { name: 'region', type: 'string' },
    { name: 'amount', type: 'integer' },
    { name: 'status', type: 'string' }
  ];
  const ds4Rows = [
    { transaction_id: 'TXN-901', region: 'North', amount: 5000, status: 'Completed' },
    { transaction_id: 'TXN-902', region: 'South', amount: 7500, status: 'Completed' },
    { transaction_id: 'TXN-901', region: 'North', amount: 5000, status: 'Completed' }, // duplicate 1
    { transaction_id: 'TXN-903', region: 'East', amount: 3200, status: 'Pending' },
    { transaction_id: 'TXN-904', region: 'West', amount: 8900, status: 'Completed' },
    { transaction_id: 'TXN-902', region: 'South', amount: 7500, status: 'Completed' }, // duplicate 2
    { transaction_id: 'TXN-905', region: 'North', amount: 6100, status: 'Completed' },
    { transaction_id: 'TXN-901', region: 'North', amount: 5000, status: 'Completed' }  // duplicate 3
  ];
  const ds4Id = await ensureDataset('Audit Telemetry With Duplicate Records', ds4Schema, ds4Rows);

  // Dataset 5: Different Metric and Dimension Names (Global Supply Chain Logistics)
  const ds5Schema = [
    { name: 'dispatch_date', type: 'date' },
    { name: 'origin_hub', type: 'string' },
    { name: 'carrier_partner', type: 'string' },
    { name: 'shipping_cost_inr', type: 'integer' },
    { name: 'package_weight_kg', type: 'numeric' }
  ];
  const ds5Rows = [
    { dispatch_date: '2026-04-01', origin_hub: 'Mumbai Hub', carrier_partner: 'BlueDart', shipping_cost_inr: 1250, package_weight_kg: 14.5 },
    { dispatch_date: '2026-04-02', origin_hub: 'Delhi Hub', carrier_partner: 'Delhivery', shipping_cost_inr: 980, package_weight_kg: 8.2 },
    { dispatch_date: '2026-04-03', origin_hub: 'Bengaluru Hub', carrier_partner: 'BlueDart', shipping_cost_inr: 2100, package_weight_kg: 26.0 },
    { dispatch_date: '2026-04-04', origin_hub: 'Chennai Hub', carrier_partner: 'DTDC', shipping_cost_inr: 650, package_weight_kg: 5.0 },
    { dispatch_date: '2026-04-05', origin_hub: 'Mumbai Hub', carrier_partner: 'Delhivery', shipping_cost_inr: 1750, package_weight_kg: 19.8 },
    { dispatch_date: '2026-04-06', origin_hub: 'Kolkata Hub', carrier_partner: 'DTDC', shipping_cost_inr: 1100, package_weight_kg: 11.4 }
  ];
  const ds5Id = await ensureDataset('Global Supply Chain Logistics', ds5Schema, ds5Rows);

  console.log('\n--- 5 Acceptance Datasets Ready ---');
  console.log(`1. With Date Column: Mixed Variance Telemetry (ID: ${ds1Id})`);
  console.log(`2. Without Date Column: Enterprise Customer Directory (ID: ${ds2Id})`);
  console.log(`3. With Missing Values: Audit Telemetry With Missing Values (ID: ${ds3Id})`);
  console.log(`4. With Duplicate Records: Audit Telemetry With Duplicate Records (ID: ${ds4Id})`);
  console.log(`5. Different Metric/Dim Names: Global Supply Chain Logistics (ID: ${ds5Id})`);

  process.exit(0);
}

setupAcceptanceDatasets().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});

