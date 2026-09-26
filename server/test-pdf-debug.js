const fs = require('fs');
const path = require('path');
const reportService = require('./services/reportService');

async function debugPdf() {
  const sampleData = {
    reportId: 'test-report-1',
    title: 'Q4 Indian Enterprise Revenue Digest',
    description: 'Weekly financial telemetry, regional breakdown, and quota velocity.',
    format: 'pdf',
    organizationId: '00000000-0000-0000-0000-000000000001',
    organizationName: 'Ricoz Primary Organization',
    dashboardTitle: 'Executive Sales Command',
    generatedAt: new Date(),
    kpis: [
      { name: 'Total Revenue', value: 2450000, unit: 'INR', type: 'currency', target: 2000000, progress: 122.5, status: 'on_track' },
      { name: 'Active Subscriptions', value: 1420, unit: '', type: 'count', target: 1200, progress: 118.3, status: 'on_track' },
      { name: 'Average Deal Size', value: 85400, unit: 'INR', type: 'currency', target: 75000, progress: 113.8, status: 'on_track' },
      { name: 'Customer Churn Rate', value: 1.8, unit: '%', type: 'percentage', target: 2.0, progress: 90.0, status: 'on_track' }
    ],
    widgets: [
      { title: 'Quarterly Revenue Velocity', type: 'line_chart', position: { w: 6, h: 4 } },
      { title: 'Regional Segment Breakdown', type: 'bar_chart', position: { w: 6, h: 4 } }
    ],
    datasetName: 'Sample Transactions',
    datasetSchema: [
      { name: 'Region', type: 'text' },
      { name: 'Segment', type: 'text' },
      { name: 'UnitsSold', type: 'number' },
      { name: 'Revenue', type: 'number' },
      { name: 'ProfitMargin', type: 'number' },
      { name: 'Quarter', type: 'text' }
    ],
    rows: [
      { Region: 'North India', Segment: 'Enterprise', UnitsSold: 450, Revenue: 1125000, ProfitMargin: 24.5, Quarter: 'Q4 2025' },
      { Region: 'South India', Segment: 'Mid-Market', UnitsSold: 380, Revenue: 760000, ProfitMargin: 21.0, Quarter: 'Q4 2025' },
      { Region: 'West India', Segment: 'Enterprise', UnitsSold: 290, Revenue: 870000, ProfitMargin: 28.2, Quarter: 'Q4 2025' },
      { Region: 'East India', Segment: 'SMB', UnitsSold: 510, Revenue: 510000, ProfitMargin: 18.4, Quarter: 'Q4 2025' },
      { Region: 'Central India', Segment: 'Government', UnitsSold: 120, Revenue: 480000, ProfitMargin: 31.0, Quarter: 'Q4 2025' }
    ]
  };

  console.log('Generating PDF buffer...');
  const pdfBuffer = await reportService.generatePdf(sampleData);
  console.log('Buffer type:', Buffer.isBuffer(pdfBuffer));
  console.log('Buffer length:', pdfBuffer.length);
  console.log('Header (first 10 bytes):', pdfBuffer.subarray(0, 10).toString('utf-8'));
  console.log('Tail (last 100 bytes):', pdfBuffer.subarray(pdfBuffer.length - 100).toString('utf-8'));
  
  const testFilePath = path.join(__dirname, 'test_output.pdf');
  fs.writeFileSync(testFilePath, pdfBuffer);
  console.log('Saved test PDF to:', testFilePath);

  // Check xref and trailer and %%EOF
  const content = pdfBuffer.toString('latin1');
  const hasEof = content.includes('%%EOF');
  const hasXref = content.includes('xref') || content.includes('/XRef');
  const hasTrailer = content.includes('trailer') || content.includes('/Type /XRef');
  console.log('Contains %%EOF:', hasEof);
  console.log('Contains xref:', hasXref);
  console.log('Contains trailer:', hasTrailer);
  
  // Let's inspect objects in the PDF
  const objMatches = content.match(/\d+ \d+ obj/g);
  console.log('Objects count:', objMatches ? objMatches.length : 0);
  console.log('Objects:', objMatches);
}

debugPdf().catch(console.error);
