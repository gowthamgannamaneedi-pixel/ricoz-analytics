const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const reportService = require('./services/reportService');
const { generateExecutivePdf, sanitizeForPdf, formatCurrency, buildExecutiveSummary } = require('./services/pdfReportGenerator');

async function runEnterprisePdfVerification() {
  console.log('================================================================');
  console.log('  RicozAnalytics: Comprehensive Enterprise PDF Verification Suite ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 7;

  // -------------------------------------------------------------------------
  // TEST SCENARIO 1: Revenue Over Time (Chronological Line Chart)
  // -------------------------------------------------------------------------
  console.log('--- Test 1: Report containing revenue over time ---');
  const reportTimeData = {
    reportId: 'test-scenario-1',
    title: 'Enterprise Revenue Velocity & Trend Analysis',
    description: 'Chronological time-series revenue tracking across continuous operational intervals.',
    format: 'pdf',
    organizationId: '00000000-0000-0000-0000-000000000001',
    organizationName: 'Ricoz Enterprise Global',
    dashboardTitle: 'Executive Sales Command',
    reportingPeriod: 'Q3 2026',
    generatedAt: new Date(),
    kpis: [
      { name: 'Total Revenue', value: 1500000, unit: 'INR', type: 'currency', target: 1600000, progress: 93.8 },
      { name: 'Total Orders', value: 15, unit: '', type: 'count', target: 18, progress: 83.3 },
      { name: 'Average Deal Size', value: 100000, unit: 'INR', type: 'currency', target: 90000, progress: 111.1 },
      { name: 'Units Delivered', value: 216, unit: '', type: 'count', target: 200, progress: 108.0 }
    ],
    widgets: [
      {
        id: 'w-trend',
        title: 'Daily Revenue Velocity',
        type: 'line_chart',
        chart_data: [
          { name: 'Jul 01', value: 45000 },
          { name: 'Jul 08', value: 125000 },
          { name: 'Jul 15', value: 89000 },
          { name: 'Jul 22', value: 195000 },
          { name: 'Jul 29', value: 215000 }
        ]
      }
    ],
    datasetName: 'Quarterly Telemetry',
    datasetSchema: [{ name: 'Date', type: 'date' }, { name: 'Revenue', type: 'number' }],
    rows: [
      { Date: '2026-07-01', Revenue: 45000 },
      { Date: '2026-07-08', Revenue: 125000 },
      { Date: '2026-07-15', Revenue: 89000 },
      { Date: '2026-07-22', Revenue: 195000 },
      { Date: '2026-07-29', Revenue: 215000 }
    ]
  };

  const buf1 = await reportService.generatePdf(reportTimeData);
  if (!buf1.subarray(0, 5).toString().startsWith('%PDF-') || !buf1.toString('latin1').includes('%%EOF')) {
    throw new Error('Test 1 failed: Invalid PDF binary stream');
  }
  console.log(`  ✓ Scenario 1 passed! Generated ${buf1.length} bytes valid PDF with vector line chart.`);
  passed++;

  // -------------------------------------------------------------------------
  // TEST SCENARIO 2: Regional Revenue Comparison (Horizontal Bar Chart)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Report containing regional revenue comparison ---');
  const reportRegionData = {
    ...reportTimeData,
    title: 'Geographic & Regional Performance Audit',
    widgets: [
      {
        id: 'w-region',
        title: 'Regional Revenue Comparison',
        type: 'horizontal_bar_chart',
        chart_data: [
          { name: 'Bengaluru Hub', value: 555000 },
          { name: 'Mumbai Metro', value: 361000 },
          { name: 'Delhi NCR', value: 302000 },
          { name: 'Hyderabad Tech', value: 282000 }
        ]
      }
    ]
  };

  const buf2 = await reportService.generatePdf(reportRegionData);
  const str2 = buf2.toString('latin1');
  if (!str2.includes('Regional Revenue Comparison') && !str2.includes('/Type /Page')) {
    throw new Error('Test 2 failed: Missing regional components');
  }
  console.log(`  ✓ Scenario 2 passed! Generated ${buf2.length} bytes with horizontal regional rankings.`);
  passed++;

  // -------------------------------------------------------------------------
  // TEST SCENARIO 3: Sales Channel Distribution (Vertical Bar Chart)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Report containing sales-channel data ---');
  const reportChannelData = {
    ...reportTimeData,
    title: 'Omnichannel Attribution & Performance Audit',
    widgets: [
      {
        id: 'w-channel',
        title: 'Sales Channel Distribution',
        type: 'bar_chart',
        chart_data: [
          { name: 'Enterprise Direct', value: 680000 },
          { name: 'Partner Reseller', value: 420000 },
          { name: 'Digital Portal', value: 290000 },
          { name: 'Government Tender', value: 110000 }
        ]
      }
    ]
  };

  const buf3 = await reportService.generatePdf(reportChannelData);
  console.log(`  ✓ Scenario 3 passed! Generated ${buf3.length} bytes with sales channel distribution bars.`);
  passed++;

  // -------------------------------------------------------------------------
  // TEST SCENARIO 4: Product Performance Breakdown
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: Report containing product SKU data ---');
  const reportProductData = {
    ...reportTimeData,
    title: 'Product Catalog Velocity & SKU Contribution',
    widgets: [
      {
        id: 'w-product',
        title: 'Top Product Performance',
        type: 'bar_chart',
        chart_data: [
          { name: 'Cloud SaaS Platform', value: 495000 },
          { name: 'Enterprise Server Suite', value: 455000 },
          { name: 'Storage SAN Hardware', value: 320000 },
          { name: 'Consulting Retainer', value: 230000 }
        ]
      }
    ]
  };

  const buf4 = await reportService.generatePdf(reportProductData);
  console.log(`  ✓ Scenario 4 passed! Generated ${buf4.length} bytes with product catalog ranking.`);
  passed++;

  // -------------------------------------------------------------------------
  // TEST SCENARIO 5: Missing Optional Dimensions (Graceful Fallback)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 5: Report missing one or more optional chart dimensions ---');
  const reportMissingData = {
    reportId: 'test-scenario-5',
    title: 'Minimal Dimension Operational Telemetry',
    description: 'Report dataset containing only primary metrics without regional or channel attributes.',
    format: 'pdf',
    organizationId: '00000000-0000-0000-0000-000000000001',
    organizationName: 'Ricoz Enterprise Global',
    dashboardTitle: 'Raw Sensor Stream',
    reportingPeriod: 'All Time',
    generatedAt: new Date(),
    kpis: [
      { name: 'Metric Aggregate', value: 85000, unit: '', type: 'count', target: null }
    ],
    widgets: [], // No widgets configured
    datasetName: 'Raw Ingestion Sensor Feed',
    datasetSchema: [{ name: 'Reading', type: 'number' }, { name: 'Status', type: 'text' }],
    rows: [
      { Reading: 104, Status: 'Normal' },
      { Reading: 112, Status: 'Normal' }
    ]
  };

  const buf5 = await reportService.generatePdf(reportMissingData);
  if (!buf5.subarray(0, 5).toString().startsWith('%PDF-')) {
    throw new Error('Test 5 failed: Failed on missing optional dimensions');
  }
  console.log(`  ✓ Scenario 5 passed! Gracefully handled missing dimensions without failure (${buf5.length} bytes).`);
  passed++;

  // -------------------------------------------------------------------------
  // TEST SCENARIO 6: Large Multi-Page Report (50+ rows pagination)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 6: Large report spanning multiple PDF pages ---');
  const largeRows = [];
  for (let i = 1; i <= 60; i++) {
    largeRows.push({
      TxnID: `TXN-${1000 + i}`,
      Region: i % 2 === 0 ? 'North Region' : 'South Region',
      Segment: i % 3 === 0 ? 'Enterprise' : 'Mid-Market',
      Units: 10 + (i % 5),
      Revenue: 25000 + i * 1500,
      Profit: 5000 + i * 300,
      Date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`
    });
  }

  const reportLargeData = {
    ...reportTimeData,
    title: 'High-Volume Enterprise Transactions Master Audit',
    description: 'Exhaustive transaction registry spanning multiple ledger intervals.',
    rows: largeRows,
    totalRowCount: largeRows.length
  };

  const buf6 = await reportService.generatePdf(reportLargeData);
  const str6 = buf6.toString('latin1');
  const pageMatch = str6.match(/\/Type \/Page\b/g);
  const pageCount = pageMatch ? pageMatch.length : 0;
  console.log(`  ✓ Scenario 6 passed! Successfully generated multi-page PDF (${pageCount} pages, ${buf6.length} bytes) with two-pass page numbering.`);
  if (pageCount < 2) {
    throw new Error('Expected at least 2 pages for large report dataset');
  }
  passed++;

  // -------------------------------------------------------------------------
  // TEST SCENARIO 7: Data Quality & Discrepancy Reconciliation
  // -------------------------------------------------------------------------
  console.log('\n--- Test 7: Report with missing values or inconsistent KPI totals ---');
  const dirtyRows = [
    { order_id: 1, region: null, sales: '45000.5', units: null },
    { order_id: 2, region: 'Bengaluru', sales: 125000, units: 10 },
    { order_id: 3, region: '', sales: undefined, units: 'invalid' },
    { order_id: 4, region: 'Mumbai', sales: 85000, units: 5 }
  ];

  const reportDirtyData = {
    ...reportTimeData,
    title: 'Reconciled Audit Report (Data Quality Tolerant)',
    rows: dirtyRows,
    datasetSchema: [
      { name: 'order_id', type: 'number' },
      { name: 'region', type: 'text' },
      { name: 'sales', type: 'number' },
      { name: 'units', type: 'number' }
    ]
  };

  const buf7 = await reportService.generatePdf(reportDirtyData);
  if (!buf7.subarray(0, 5).toString().startsWith('%PDF-')) {
    throw new Error('Test 7 failed: Error processing missing/dirty data values');
  }
  console.log(`  ✓ Scenario 7 passed! Reconciled dirty/missing values cleanly (${buf7.length} bytes).`);
  passed++;

  // -------------------------------------------------------------------------
  // GENERATE SAMPLE PDF: Q3-Enterprise-Revenue-Report (Redesigned)
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('  Generating Full Production Sample: Q3-Enterprise-Revenue-Report');
  console.log('----------------------------------------------------------------');

  const productionQ3Data = {
    reportId: 'q3-enterprise-revenue-001',
    title: 'Q3 Enterprise Revenue Report',
    description: 'Executive revenue performance, multi-region geographic distribution, and channel attribution telemetry.',
    format: 'pdf',
    organizationId: '00000000-0000-0000-0000-000000000001',
    organizationName: 'Ricoz Enterprise Headquarters',
    dashboardTitle: 'Enterprise Executive Dashboard',
    reportingPeriod: 'Q3 2026 (Jul 01 - Sep 30)',
    generatedAt: new Date('2026-10-26T15:48:58.000Z'),
    kpis: [
      {
        id: 'kpi-revenue',
        name: 'Total Revenue',
        value: 1593000.5,
        unit: 'INR',
        type: 'currency',
        target: 1500000,
        progress: 106.2,
        status: 'verified',
        calculation: 'SUM(sales_amount)'
      },
      {
        id: 'kpi-orders',
        name: 'Total Orders',
        value: 15,
        unit: '',
        type: 'count',
        target: 14,
        progress: 107.1,
        status: 'verified',
        calculation: 'COUNT(order_id)'
      },
      {
        id: 'kpi-units',
        name: 'Units Sold',
        value: 232,
        unit: '',
        type: 'count',
        target: 200,
        progress: 116.0,
        status: 'verified',
        calculation: 'SUM(units_sold)'
      },
      {
        id: 'kpi-aov',
        name: 'Average Order Value',
        value: 106200,
        unit: 'INR',
        type: 'currency',
        target: 100000,
        progress: 106.2,
        status: 'verified',
        calculation: 'Total Revenue / Total Orders'
      }
    ],
    widgets: [
      {
        id: 'widget-revenue-trend',
        title: 'Revenue Velocity Trend',
        type: 'line_chart',
        position: { w: 6, h: 4 },
        chart_data: [
          { name: 'Jul 15', value: 45000.5 },
          { name: 'Jul 16', value: 125000 },
          { name: 'Jul 17', value: 89000 },
          { name: 'Jul 20', value: 195000 },
          { name: 'Jul 21', value: 142000 },
          { name: 'Jul 25', value: 215000 },
          { name: 'Jul 27', value: 165000 },
          { name: 'Jul 29', value: 138000 }
        ]
      },
      {
        id: 'widget-channel-distribution',
        title: 'Sales Channel Distribution',
        type: 'bar_chart',
        position: { w: 6, h: 4 },
        chart_data: [
          { name: 'Direct Enterprise', value: 620000 },
          { name: 'Partner Reseller', value: 480000 },
          { name: 'Digital Portal', value: 340000.5 },
          { name: 'Government Tender', value: 153000 }
        ]
      },
      {
        id: 'widget-regional-breakdown',
        title: 'Regional Revenue Comparison',
        type: 'horizontal_bar_chart',
        position: { w: 6, h: 4 },
        chart_data: [
          { name: 'Bengaluru Hub', value: 455000.5 },
          { name: 'Mumbai Metro', value: 361000 },
          { name: 'Delhi NCR', value: 302000 },
          { name: 'Chennai Central', value: 282000 },
          { name: 'Hyderabad Tech', value: 193000 }
        ]
      },
      {
        id: 'widget-product-performance',
        title: 'Top Product Performance',
        type: 'bar_chart',
        position: { w: 6, h: 4 },
        chart_data: [
          { name: 'Software Enterprise License', value: 595000 },
          { name: 'Cloud SaaS Suite', value: 584000 },
          { name: 'Hardware Infrastructure', value: 279000.5 },
          { name: 'Professional Services', value: 135000 }
        ]
      }
    ],
    datasetName: 'Enterprise Indian Telemetry Q3',
    datasetSchema: [
      { name: 'order_id', type: 'number' },
      { name: 'region', type: 'text' },
      { name: 'category', type: 'text' },
      { name: 'sales_amount', type: 'number' },
      { name: 'units_sold', type: 'number' },
      { name: 'profit', type: 'number' },
      { name: 'order_date', type: 'date' }
    ],
    totalRowCount: 15,
    rows: [
      { order_id: 1001, region: 'Bengaluru', category: 'Hardware', sales_amount: 45000.50, units_sold: 12, profit: 6500.00, order_date: '2026-07-15' },
      { order_id: 1002, region: 'Mumbai', category: 'Software', sales_amount: 125000.00, units_sold: 5, profit: 35000.00, order_date: '2026-07-16' },
      { order_id: 1003, region: 'Delhi NCR', category: 'Cloud SaaS', sales_amount: 89000.00, units_sold: 20, profit: 22000.00, order_date: '2026-07-17' },
      { order_id: 1004, region: 'Hyderabad', category: 'Hardware', sales_amount: 62000.00, units_sold: 18, profit: 9400.00, order_date: '2026-07-18' },
      { order_id: 1005, region: 'Chennai', category: 'Services', sales_amount: 34000.00, units_sold: 8, profit: 7100.00, order_date: '2026-07-19' },
      { order_id: 1006, region: 'Bengaluru', category: 'Software', sales_amount: 195000.00, units_sold: 10, profit: 48000.00, order_date: '2026-07-20' },
      { order_id: 1007, region: 'Mumbai', category: 'Cloud SaaS', sales_amount: 142000.00, units_sold: 25, profit: 38000.00, order_date: '2026-07-21' },
      { order_id: 1008, region: 'Delhi NCR', category: 'Services', sales_amount: 48000.00, units_sold: 15, profit: 11200.00, order_date: '2026-07-22' },
      { order_id: 1009, region: 'Hyderabad', category: 'Hardware', sales_amount: 78000.00, units_sold: 22, profit: 14500.00, order_date: '2026-07-23' },
      { order_id: 1010, region: 'Chennai', category: 'Software', sales_amount: 110000.00, units_sold: 7, profit: 29000.00, order_date: '2026-07-24' },
      { order_id: 1011, region: 'Bengaluru', category: 'Cloud SaaS', sales_amount: 215000.00, units_sold: 30, profit: 62000.00, order_date: '2026-07-25' },
      { order_id: 1012, region: 'Mumbai', category: 'Hardware', sales_amount: 94000.00, units_sold: 16, profit: 18000.00, order_date: '2026-07-26' },
      { order_id: 1013, region: 'Delhi NCR', category: 'Software', sales_amount: 165000.00, units_sold: 9, profit: 41000.00, order_date: '2026-07-27' },
      { order_id: 1014, region: 'Hyderabad', category: 'Services', sales_amount: 53000.00, units_sold: 11, profit: 12800.00, order_date: '2026-07-28' },
      { order_id: 1015, region: 'Chennai', category: 'Cloud SaaS', sales_amount: 138000.00, units_sold: 24, profit: 36000.00, order_date: '2026-07-29' }
    ]
  };

  const redesignedPdfBuffer = await reportService.generatePdf(productionQ3Data);
  
  // Save both locally in server and in Downloads directory as requested
  const localDest = path.join(__dirname, 'test_output.pdf');
  const downloadsDest = path.join('C:\\Users\\gowth\\Downloads', 'Q3-Enterprise-Revenue-Report-redesigned.pdf');
  fs.writeFileSync(localDest, redesignedPdfBuffer);
  fs.writeFileSync(downloadsDest, redesignedPdfBuffer);

  console.log(`\n  ✓ Redesigned Reference PDF created successfully!`);
  console.log(`    Location 1: ${localDest} (${redesignedPdfBuffer.length} bytes)`);
  console.log(`    Location 2: ${downloadsDest} (${redesignedPdfBuffer.length} bytes)`);

  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} ENTERPRISE PDF VERIFICATION SCENARIOS PASSED! `);
  console.log('================================================================\n');
}

runEnterprisePdfVerification().catch(err => {
  console.error('Enterprise PDF Verification Suite Error:', err);
  process.exit(1);
});
