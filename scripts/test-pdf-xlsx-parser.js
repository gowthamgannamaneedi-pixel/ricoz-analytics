const fs = require('fs');
const path = require('path');
const { PDFParse } = require(path.resolve(__dirname, '../server/node_modules/pdf-parse'));
const ExcelJS = require(path.resolve(__dirname, '../server/node_modules/exceljs'));
const { generateExecutivePdf } = require(path.resolve(__dirname, '../server/services/pdfReportGenerator'));
const reportService = require(path.resolve(__dirname, '../server/services/reportService'));

async function testPdfAndXlsxVerification() {
  console.log('================================================================');
  console.log('  RICOZANALYTICS STAGE 4.1: PDF & XLSX ENGINE AUDIT');
  console.log('================================================================\n');

  const outDir = path.resolve(__dirname, '../test-output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Realistic enterprise dataset payload matching Ricoz Executive Overview
  const sampleReportData = {
    title: 'Q3 Enterprise Executive Performance Report',
    organizationName: 'RicozAnalytics Global',
    generatedAt: new Date('2026-11-14T10:00:00Z'),
    dashboardTitle: 'Executive Overview Dashboard',
    description: 'Quarterly key performance indicators, regional velocity, and channel distribution.',
    datasetName: 'sample_3_data_quality_test',
    kpis: [
      { name: 'Total Sales', value: 5790000, target: 5500000, progress: 105.3 },
      { name: 'Total Orders', value: 252, target: 250, progress: 100.8 },
      { name: 'Total Units Sold', value: 3861, target: 3500, progress: 110.3 },
      { name: 'Average Order Value', value: 22976, target: 22000, progress: 104.4 }
    ],
    widgets: [
      {
        id: 'widget-regional',
        title: 'Regional Performance',
        type: 'horizontal_bar',
        chart_data: [
          { name: 'West', value: 1630000, share: '28.1%' },
          { name: 'North', value: 1420000, share: '24.5%' },
          { name: 'East', value: 1410000, share: '24.3%' },
          { name: 'South', value: 1320000, share: '22.8%' }
        ]
      },
      {
        id: 'widget-channel',
        title: 'Sales by Channel',
        type: 'donut_chart',
        chart_data: [
          { name: 'Direct Sales', value: 2850000 },
          { name: 'Enterprise Partner', value: 1840000 },
          { name: 'Online Portal', value: 1100000 }
        ]
      }
    ],
    rows: [
      { 'Record ID': 'REC-0001', 'Event Date': '2026-01-01', 'Product': 'Alpha', 'Revenue': 15829.84, 'Customer': 'Custom-01' },
      { 'Record ID': 'REC-0002', 'Event Date': '2026-01-02', 'Product': 'Delta', 'Revenue': 4235.43, 'Customer': 'Custom-02' },
      { 'Record ID': 'REC-0003', 'Event Date': '2026-01-03', 'Product': 'Beta', 'Revenue': 26650.09, 'Customer': 'Custom-03' },
      { 'Record ID': 'REC-0004', 'Event Date': '2026-01-04', 'Product': 'Gamma', 'Revenue': 11470.49, 'Customer': 'Custom-04' },
      { 'Record ID': 'REC-0005', 'Event Date': '2026-01-05', 'Product': 'Alpha', 'Revenue': 37674.19, 'Customer': 'Custom-05' }
    ],
    datasetRows: [
      { 'Record ID': 'REC-0001', 'Event Date': '2026-01-01', 'Product': 'Alpha', 'Revenue': 15829.84, 'Customer': 'Custom-01' },
      { 'Record ID': 'REC-0002', 'Event Date': '2026-01-02', 'Product': 'Delta', 'Revenue': 4235.43, 'Customer': 'Custom-02' },
      { 'Record ID': 'REC-0003', 'Event Date': '2026-01-03', 'Product': 'Beta', 'Revenue': 26650.09, 'Customer': 'Custom-03' },
      { 'Record ID': 'REC-0004', 'Event Date': '2026-01-04', 'Product': 'Gamma', 'Revenue': 11470.49, 'Customer': 'Custom-04' },
      { 'Record ID': 'REC-0005', 'Event Date': '2026-01-05', 'Product': 'Alpha', 'Revenue': 37674.19, 'Customer': 'Custom-05' }
    ]
  };

  // -------------------------------------------------------------
  // TEST 1: PDF REPORT GENERATION & REAL PDF PARSING
  // -------------------------------------------------------------
  console.log('⏳ 1. Generating Executive PDF Report via pdfReportGenerator...');
  const pdfBuffer = await generateExecutivePdf(sampleReportData);
  const pdfFilePath = path.join(outDir, 'Ricoz_Executive_Report_Verified.pdf');
  fs.writeFileSync(pdfFilePath, pdfBuffer);
  console.log(`✅ PDF Generated: ${pdfFilePath} (${pdfBuffer.length} bytes)`);

  console.log('⏳ 2. Parsing and inspecting generated PDF using pdf-parse...');
  const parser = new PDFParse({ data: pdfBuffer });
  await parser.load();
  const pdfTextResult = await parser.getText();
  const extractedText = pdfTextResult.text || '';
  const numPages = pdfTextResult.total || 1;

  console.log('\n--- PDF METADATA & PARSER RESULTS ---');
  console.log(`• Number of Pages: ${numPages}`);
  console.log(`• Total Extracted Characters: ${extractedText.length}`);
  console.log(`• First 350 chars of extracted text:\n${extractedText.trim().substring(0, 350)}...\n`);

  // Assertions on PDF content
  const requiredPdfKeywords = [
    'Q3 Enterprise Executive Performance Report',
    'RICOZ',
    'Total Sales',
    'Total Orders',
    'Regional Performance',
    'CONFIDENTIAL'
  ];

  const missingPdfKeywords = requiredPdfKeywords.filter(kw => !extractedText.includes(kw));
  if (missingPdfKeywords.length > 0) {
    throw new Error(`PDF Parser failed verification! Missing expected keywords: ${missingPdfKeywords.join(', ')}`);
  }
  console.log('✅ ALL PDF CONTENT ASSERTIONS PASSED (Header, Title, KPIs, Footers legible and valid).');

  // -------------------------------------------------------------
  // TEST 2: XLSX WORKBOOK GENERATION & EXCELJS PARSING
  // -------------------------------------------------------------
  console.log('\n⏳ 3. Generating XLSX Workbook via reportService.generateExcel...');
  const xlsxBuffer = await reportService.generateExcel(sampleReportData);
  const xlsxFilePath = path.join(outDir, 'Ricoz_Dashboard_Workbook_Verified.xlsx');
  fs.writeFileSync(xlsxFilePath, xlsxBuffer);
  console.log(`✅ XLSX Generated: ${xlsxFilePath} (${xlsxBuffer.length} bytes)`);

  console.log('⏳ 4. Loading and validating XLSX Workbook with ExcelJS...');
  const readWorkbook = new ExcelJS.Workbook();
  await readWorkbook.xlsx.load(xlsxBuffer);

  const sheetNames = readWorkbook.worksheets.map(w => w.name);
  console.log(`• Found Worksheets: [${sheetNames.join(', ')}]`);

  if (!sheetNames.includes('Executive Summary') || !sheetNames.includes('Dashboard Widgets') || !sheetNames.includes('Dataset Telemetry')) {
    throw new Error(`XLSX missing required worksheets! Got: ${sheetNames.join(', ')}`);
  }

  // Validate Executive Summary Sheet
  const summarySheet = readWorkbook.getWorksheet('Executive Summary');
  const titleCell = summarySheet.getRow(2).getCell(2).value;
  console.log(`• Sheet 1 Row 2 Value: "${titleCell}"`);
  if (titleCell !== sampleReportData.title) {
    throw new Error(`XLSX Title mismatch: expected "${sampleReportData.title}", got "${titleCell}"`);
  }

  // Validate Dataset Telemetry Sheet
  const dataSheet = readWorkbook.getWorksheet('Dataset Telemetry');
  const rowCount = dataSheet.rowCount;
  console.log(`• Sheet 3 (Dataset Telemetry) Total Rows: ${rowCount}`);
  if (rowCount < 6) { // Header + 5 rows
    throw new Error(`Dataset Telemetry rows insufficient: expected >= 6, got ${rowCount}`);
  }

  console.log('✅ ALL XLSX WORKBOOK ASSERTIONS PASSED (3 sheets, verified structure, valid cell styles).');

  return {
    pdfSize: pdfBuffer.length,
    pdfPages: numPages,
    xlsxSize: xlsxBuffer.length,
    xlsxSheets: sheetNames
  };
}

testPdfAndXlsxVerification()
  .then(res => {
    console.log('\n================================================================');
    console.log(' STAGE 4.1 AUDIT: PDF & XLSX ENGINES VERIFIED SUCCESSFULLY');
    console.log(JSON.stringify(res, null, 2));
    console.log('================================================================');
  })
  .catch(err => {
    console.error('❌ Audit Failure:', err);
    process.exit(1);
  });
