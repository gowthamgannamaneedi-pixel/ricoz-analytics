const reportService = require('../server/services/reportService');
const fs = require('fs');
const path = require('path');

async function testReport() {
  try {
    const reportObj = {
      id: 'test-report-001',
      title: 'Executive Financial & Variance Report',
      description: 'Genuinely computed executive intelligence from Mixed Variance Telemetry.',
      dataset_id: 391,
      format: 'pdf',
      filters: {}
    };

    console.log('Compiling report data for dataset 391...');
    const data = await reportService.compileReportData(reportObj, '00000000-0000-0000-0000-000000000001');
    console.log('Compiled Report Data Summary:');
    console.log('  Title:', data.title);
    console.log('  Dataset:', data.datasetName, `(ID: ${data.datasetId})`);
    console.log('  KPIs count:', data.kpis.length);
    data.kpis.forEach(k => console.log(`    - ${k.name}: ${k.value} (${k.calculation || 'direct'})`));
    console.log('  Rows count:', data.rows ? data.rows.length : 0);
    console.log('  Trends points:', data.trends ? data.trends.length : 0);
    console.log('  Insights count:', data.insights ? data.insights.length : 0);

    console.log('\nGenerating PDF buffer...');
    const pdfBuf = await reportService.generatePdf(data);
    const pdfPath = path.join(__dirname, 'test-report-output.pdf');
    fs.writeFileSync(pdfPath, pdfBuf);
    console.log(`Saved PDF (${pdfBuf.length} bytes) to: ${pdfPath}`);

    console.log('\nGenerating Excel buffer...');
    const xlsxBuf = await reportService.generateExcel(data);
    const xlsxPath = path.join(__dirname, 'test-report-output.xlsx');
    fs.writeFileSync(xlsxPath, xlsxBuf);
    console.log(`Saved Excel (${xlsxBuf.length} bytes) to: ${xlsxPath}`);

  } catch (err) {
    console.error('Report test failed:', err);
  } finally {
    process.exit(0);
  }
}

testReport();
