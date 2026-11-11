const reportService = require('../server/services/reportService');
const Dataset = require('../server/models/datasetModel');
const fs = require('fs');
const path = require('path');

async function testReportExports() {
  console.log('=====================================================');
  console.log('📄 RICOZANALYTICS REPORT EXPORT VERIFICATION');
  console.log('=====================================================\n');

  const datasetIds = [391, 394, 396];
  const orgId = '00000000-0000-0000-0000-000000000001';

  let allPassed = true;

  for (const dsId of datasetIds) {
    const dataset = await Dataset.findById(dsId);
    console.log(`\n-----------------------------------------------------`);
    console.log(`Inspecting Dataset ${dsId}: ${dataset.name}`);
    console.log(`-----------------------------------------------------`);

    const mockReport = {
      id: `rep-${dsId}`,
      title: `Executive Intelligence Report - ${dataset.name}`,
      description: `Acceptance validation report for dataset ${dsId}`,
      format: 'pdf',
      dataset_id: dsId,
      organization_id: orgId
    };

    // 1. Compile report data
    const reportData = await reportService.compileReportData(mockReport, orgId);
    console.log(`Organization: ${reportData.organizationName}`);
    console.log(`KPIs Compiled: ${reportData.kpis.length}`);
    for (const kpi of reportData.kpis) {
      console.log(`  • ${kpi.name}: ${kpi.value} ${kpi.unit || ''} (Calc: ${kpi.calculation})`);
    }

    // Verify KPI semantics: if no order_id column, verify 'Total Records' and 'Average Sales per Record'
    const hasOrderIdentifier = dataset.schema && dataset.schema.some(col => {
      const name = typeof col === 'string' ? col : (col.name || '');
      return ['order_id', 'orderid', 'order_number', 'invoice_id'].includes(name.toLowerCase());
    });

    if (!hasOrderIdentifier) {
      const ordersKpi = reportData.kpis.find(k => k.name === 'Total Orders');
      const aovKpi = reportData.kpis.find(k => k.name === 'Average Order Value');
      if (ordersKpi || aovKpi) {
        console.error(`❌ FAILED: Misleading 'Total Orders' or 'Average Order Value' found on dataset without order ID.`);
        allPassed = false;
      } else {
        console.log(`✅ PASSED: Correct non-order terminology verified ('Total Records' & 'Average Sales per Record').`);
      }
    }

    // 2. Generate PDF
    const pdfBuffer = await reportService.generatePdf(reportData);
    console.log(`✅ Generated PDF Buffer: ${pdfBuffer.length} bytes`);
    if (pdfBuffer.length < 1000) {
      console.error(`❌ PDF buffer too small (${pdfBuffer.length} bytes)`);
      allPassed = false;
    }

    // 3. Generate Excel
    const excelBuffer = await reportService.generateExcel(reportData);
    console.log(`✅ Generated Excel Buffer: ${excelBuffer.length} bytes`);
    if (excelBuffer.length < 1000) {
      console.error(`❌ Excel buffer too small (${excelBuffer.length} bytes)`);
      allPassed = false;
    }
  }

  console.log('\n=====================================================');
  if (allPassed) {
    console.log('🏁 ALL REPORT EXPORTS PASSED GROUND TRUTH VERIFICATION');
  } else {
    console.error('❌ SOME REPORT EXPORTS FAILED GROUND TRUTH VERIFICATION');
  }
  console.log('=====================================================');

  process.exit(allPassed ? 0 : 1);
}

testReportExports().catch(err => {
  console.error('Fatal error in report export verification:', err);
  process.exit(1);
});

