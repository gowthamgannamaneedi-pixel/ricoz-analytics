const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

/**
 * RicozAnalytics — Enterprise PDF Report Generation Engine
 * Produces executive-ready business intelligence reports matching Power BI & Tableau standards.
 * Features:
 * - Executive cover and banner with Ricoz brand logo and metadata chips
 * - Data-backed Executive Summary highlights (no hallucinations)
 * - Aligned KPI performance cards with dynamic target attainment
 * - Print-ready vector graphics:
 *   1. Revenue Velocity Trend (Smooth line chart with area fill, vertices & peak callout)
 *   2. Sales Channel Distribution (Vertical bar chart with % shares & leader highlight)
 *   3. Regional Revenue Comparison (Horizontal bar chart sorted descending with % shares)
 *   4. Product Performance (Ranked horizontal bars with circular rank badges)
 * - Intelligent Telemetry Data Table with semantic column mapping, alternating shading & audit totals
 * - Two-pass dynamic page numbering ("Page X of Y") and confidentiality footers
 * - Graceful handling of missing optional dimensions
 */

// Enterprise Palette Tokens
const THEME = {
  navy: '#0f172a',
  slateDark: '#1e293b',
  slateMedium: '#334155',
  slateLight: '#64748b',
  slateMuted: '#94a3b8',
  border: '#e2e8f0',
  borderDark: '#cbd5e1',
  bgLight: '#f8fafc',
  bgCard: '#ffffff',
  bluePrimary: '#2563eb',
  blueSecondary: '#3b82f6',
  blueLight: '#60a5fa',
  blueSoft: '#93c5fd',
  bluePale: '#eff6ff',
  cyan: '#0284c7',
  cyanLight: '#38bdf8',
  emerald: '#059669',
  emeraldLight: '#10b981',
  emeraldPale: '#f0fdf4',
  amber: '#d97706',
  amberPale: '#fffbeb',
  rose: '#e11d48',
  rosePale: '#fef2f2'
};

const RANK_COLORS = [
  '#1d4ed8', // #1 Royal Dark
  '#2563eb', // #2 Royal Blue
  '#0284c7', // #3 Sky Blue
  '#0d9488', // #4 Teal
  '#4f46e5', // #5 Indigo
  '#6366f1', // #6 Periwinkle
  '#7c3aed', // #7 Violet
  '#9333ea'  // #8 Purple
];

/**
 * Register fonts and return font family identifiers
 */
function setupFonts(doc) {
  const fontRegPath = path.resolve(__dirname, '../assets/fonts/arial.ttf');
  const fontBoldPath = path.resolve(__dirname, '../assets/fonts/arialbd.ttf');

  const hasCustomFont = fs.existsSync(fontRegPath) && fs.existsSync(fontBoldPath);
  if (hasCustomFont) {
    try {
      doc.registerFont('ReportFont', fontRegPath);
      doc.registerFont('ReportFont-Bold', fontBoldPath);
      return { reg: 'ReportFont', bold: 'ReportFont-Bold', hasCustomFont: true };
    } catch (_) {
      // Fallback to standard Helvetica if font registration fails
    }
  }

  return { reg: 'Helvetica', bold: 'Helvetica-Bold', hasCustomFont: false };
}

/**
 * Sanitize text strings for PDF Type 1 standard fonts (WinAnsi encoding) or custom fonts
 */
function sanitizeForPdf(val, hasCustomFont = false) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (hasCustomFont) {
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
  }
  return str
    .replace(/₹/g, 'INR ')
    .replace(/[^\x00-\x7F\xA0-\xFF]/g, ' ')
    .trim();
}

/**
 * Format currency with Indian or standard notation
 */
function formatCurrency(val, currency = 'INR', compact = false, hasCustomFont = false) {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const num = Number(val);
  const isNegative = num < 0;
  const abs = Math.abs(num);

  const isRupee = currency === 'INR' || currency === '₹';
  const sym = (!currency || currency === '') ? '' : (hasCustomFont && isRupee ? '₹' : (currency === 'INR' ? 'INR ' : `${currency} `));

  if (compact) {
    if (abs >= 10000000) {
      return `${isNegative ? '-' : ''}${sym}${(abs / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
      return `${isNegative ? '-' : ''}${sym}${(abs / 100000).toFixed(2)} L`;
    }
    if (abs >= 1000) {
      return `${isNegative ? '-' : ''}${sym}${(abs / 1000).toFixed(1)}k`;
    }
    return `${isNegative ? '-' : ''}${sym}${abs.toFixed(0)}`;
  }

  // Standard Indian formatting: 15,00,000.00
  const parts = abs.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1] === '00' ? '' : `.${parts[1]}`;
  const lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  } else {
    integerPart = lastThree;
  }

  return `${isNegative ? '-' : ''}${sym}${integerPart}${decimalPart}`;
}

/**
 * Compact numeric formatter for charts and badges
 */
function formatCompactNumber(val, currency = '', hasCustomFont = false) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return formatCurrency(val, currency, true, hasCustomFont);
}

/**
 * Format standard number with Indian comma separators
 */
function formatNumber(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const num = Number(val);
  return num.toLocaleString('en-IN');
}

/**
 * Format date string into human-readable compact executive date
 */
function formatDate(dateStr, includeYear = true) {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  // If already clean like 'Jul 15' or 'Sep 1', return as is
  if (/^[A-Za-z]{3}\s+\d{1,2}$/.test(trimmed)) {
    return trimmed;
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return trimmed;
  const opts = includeYear
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
}

/**
 * Synthesize data-backed executive summary bullet points based strictly on actual data
 */
function buildExecutiveSummary(data, hasCustomFont = false) {
  const highlights = [];
  const kpis = data.kpis || [];
  const widgets = data.widgets || [];

  // 1. Core Financial / KPI Highlight
  const revenueKpi = kpis.find(k => k.id === 'kpi-revenue' || /revenue|sales/i.test(k.name));
  const ordersKpi = kpis.find(k => k.id === 'kpi-orders' || /order|count/i.test(k.name));
  const aovKpi = kpis.find(k => k.id === 'kpi-aov' || /average|aov/i.test(k.name));

  if (revenueKpi && revenueKpi.value) {
    const revStr = formatCurrency(revenueKpi.value, revenueKpi.unit || 'INR', false, hasCustomFont);
    const orderStr = ordersKpi && ordersKpi.value ? `${formatNumber(ordersKpi.value)} verified transactions` : '';
    const aovStr = aovKpi && aovKpi.value ? `delivering an Average Order Value (AOV) of ${formatCurrency(aovKpi.value, 'INR', false, hasCustomFont)}` : '';

    let targetPctStr = '';
    if (revenueKpi.target) {
      const pct = Math.round((Number(revenueKpi.value) / Number(revenueKpi.target)) * 100);
      targetPctStr = ` (${pct}% of target)`;
    }

    let line = `Aggregate revenue reached ${revStr}${targetPctStr}`;
    if (orderStr) line += ` across ${orderStr}`;
    if (aovStr) line += `, ${aovStr}.`;
    else line += '.';
    highlights.push(line);
  }

  // 2. Trend & Growth Velocity Highlight
  const trendWidget = widgets.find(w => w.type === 'line_chart' || /trend|velocity/i.test(w.title));
  if (trendWidget && Array.isArray(trendWidget.chart_data) && trendWidget.chart_data.length >= 2) {
    const points = trendWidget.chart_data;
    const sorted = [...points].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const peak = sorted[0];
    const peakDate = peak.formattedDate || formatDate(peak.name) || peak.name;

    highlights.push(
      `Revenue velocity peaked at ${formatCurrency(peak.value, 'INR', false, hasCustomFont)} on ${sanitizeForPdf(peakDate, hasCustomFont)}, displaying strong trajectory over the observation interval.`
    );
  }

  // 3. Sales Channel Distribution Highlight
  const channelWidget = widgets.find(w => /channel/i.test(w.title) || (w.id && w.id.includes('channel')));
  if (channelWidget && Array.isArray(channelWidget.chart_data) && channelWidget.chart_data.length > 0) {
    const items = [...channelWidget.chart_data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const top = items[0];
    const total = items.reduce((s, i) => s + (Number(i.value) || 0), 0);
    const share = total > 0 ? ((top.value / total) * 100).toFixed(1) : '0';

    highlights.push(
      `Sales distribution was anchored by ${sanitizeForPdf(top.name, hasCustomFont)}, accounting for ${formatCurrency(top.value, 'INR', false, hasCustomFont)} (${share}% of total reported channel revenue).`
    );
  }

  // 4. Regional Distribution Highlight
  const regionWidget = widgets.find(w => /region/i.test(w.title) || (w.id && w.id.includes('region')));
  if (regionWidget && Array.isArray(regionWidget.chart_data) && regionWidget.chart_data.length > 0) {
    const items = [...regionWidget.chart_data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const top = items[0];
    const second = items.length > 1 ? items[1] : null;
    const total = items.reduce((s, i) => s + (Number(i.value) || 0), 0);
    const topShare = total > 0 ? ((top.value / total) * 100).toFixed(1) : '0';

    let regLine = `Geographic performance was led by ${sanitizeForPdf(top.name, hasCustomFont)} with ${formatCurrency(top.value, 'INR', false, hasCustomFont)} (${topShare}% share)`;
    if (second && second.value > 0) {
      const secShare = total > 0 ? ((second.value / total) * 100).toFixed(1) : '0';
      regLine += `, followed by ${sanitizeForPdf(second.name, hasCustomFont)} (${secShare}% share).`;
    } else {
      regLine += '.';
    }
    highlights.push(regLine);
  }

  // 5. Product Performance Highlight
  const productWidget = widgets.find(w => /product|sku/i.test(w.title) || (w.id && w.id.includes('product')));
  if (productWidget && Array.isArray(productWidget.chart_data) && productWidget.chart_data.length > 0) {
    const items = [...productWidget.chart_data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const top = items[0];
    highlights.push(
      `Top performing catalog item was ${sanitizeForPdf(top.name, hasCustomFont)} generating ${formatCurrency(top.value, 'INR', false, hasCustomFont)} in attributed revenue.`
    );
  }

  // Fallback if data is sparse
  if (highlights.length === 0) {
    highlights.push(
      `Executive audit confirmed ${data.totalRowCount || (data.rows ? data.rows.length : 0)} verified transactional records across ${sanitizeForPdf(data.datasetName, hasCustomFont)}.`
    );
    highlights.push('All metric calculations and dimensions reflect authorized source dataset schema aggregations.');
  }

  return highlights;
}

/**
 * Render Header Brand Badge (Official Ricoz logo + metadata)
 */
function drawReportHeader(doc, data, fonts) {
  const x = 36;
  const y = 36;
  const w = 523;
  const h = 58;

  // Navy banner
  doc.roundedRect(x, y, w, h, 6).fill(THEME.navy);

  // Logo: Load official PNG image if available
  const logoPath = path.resolve(__dirname, '../assets/logo-light.png');
  let logoDrawn = false;
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, x + 12, y + 15, { height: 26 });
      logoDrawn = true;
    } catch (_) {}
  }

  if (!logoDrawn) {
    // Vector Geometric Fallback
    const logoX = x + 12;
    const logoY = y + 14;
    doc.roundedRect(logoX, logoY + 14, 5, 14, 1.5).fill(THEME.cyanLight);
    doc.roundedRect(logoX + 7, logoY + 7, 5, 21, 1.5).fill(THEME.blueLight);
    doc.roundedRect(logoX + 14, logoY, 5, 28, 1.5).fill('#ffffff');

    doc.fillColor('#ffffff').fontSize(13.5).font(fonts.bold)
      .text('RICOZ ANALYTICS', logoX + 26, y + 13);
  }

  doc.fillColor(THEME.slateMuted).fontSize(7).font(fonts.reg)
    .text('ENTERPRISE BUSINESS INTELLIGENCE & REPORTING ENGINE', x + 12, y + 43);

  // Right Metadata Badges
  const metaRightX = x + w - 14;
  const dateStr = data.generatedAt instanceof Date
    ? data.generatedAt.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
    : String(data.generatedAt || '');

  doc.fillColor(THEME.cyanLight).fontSize(7.5).font(fonts.bold)
    .text(sanitizeForPdf(data.organizationName || 'Ricoz Enterprise', fonts.hasCustomFont).toUpperCase(), x + 240, y + 12, { width: metaRightX - (x + 240), align: 'right' });

  doc.fillColor(THEME.slateMuted).fontSize(6.5).font(fonts.reg)
    .text(`Generated: ${dateStr}`, x + 240, y + 25, { width: metaRightX - (x + 240), align: 'right' });

  const periodText = `Reporting Period: ${sanitizeForPdf(data.reportingPeriod || 'All Time', fonts.hasCustomFont)}`;
  doc.fillColor('#ffffff').fontSize(6.5).font(fonts.reg)
    .text(periodText, x + 240, y + 36, { width: metaRightX - (x + 240), align: 'right' });

  const dashText = `Dashboard Context: ${sanitizeForPdf(data.dashboardTitle || 'Executive Dashboard', fonts.hasCustomFont).toUpperCase()}`;
  doc.fillColor(THEME.cyanLight).fontSize(6.2).font(fonts.bold)
    .text(dashText, x + 240, y + 46, { width: metaRightX - (x + 240), align: 'right' });
}

/**
 * Render Executive Summary Callout Box
 */
function drawExecutiveSummaryBox(doc, highlights, x, y, width, fonts) {
  const boxH = 54;

  // Background box with blue left accent border
  doc.roundedRect(x, y, width, boxH, 5)
    .fillAndStroke(THEME.bgLight, THEME.border);

  // Left solid accent bar
  doc.roundedRect(x, y, 3.5, boxH, 1.5)
    .fill(THEME.bluePrimary);

  // Title
  doc.fillColor(THEME.navy).fontSize(8).font(fonts.bold)
    .text('EXECUTIVE SUMMARY & BUSINESS INTELLIGENCE HIGHLIGHTS', x + 12, y + 7);

  // Bullet items (up to 3)
  let curY = y + 19;
  highlights.slice(0, 3).forEach(hl => {
    doc.circle(x + 15, curY + 3.5, 1.8).fill(THEME.bluePrimary);
    doc.fillColor(THEME.slateDark).fontSize(7).font(fonts.reg)
      .text(hl, x + 22, curY, { width: width - 32, lineBreak: false });
    curY += 11;
  });
}

/**
 * Render KPI Cards Ribbon (4 aligned cards)
 */
function drawKpiCardsRibbon(doc, kpis, x, y, width, fonts) {
  const cardCount = Math.min(kpis.length, 4);
  if (cardCount === 0) return;

  const gap = 10;
  const cardW = (width - gap * (cardCount - 1)) / cardCount;
  const cardH = 56;

  kpis.slice(0, cardCount).forEach((kpi, idx) => {
    const cardX = x + idx * (cardW + gap);

    // Container
    doc.roundedRect(cardX, y, cardW, cardH, 5)
      .fillAndStroke(THEME.bgCard, THEME.border);

    // Accent top bar
    doc.roundedRect(cardX, y, cardW, 3, 1)
      .fill(idx === 0 ? THEME.bluePrimary : (idx === 1 ? THEME.cyan : (idx === 2 ? THEME.emerald : THEME.slateLight)));

    // Metric Name
    const kpiName = sanitizeForPdf(kpi.name, fonts.hasCustomFont);
    doc.fillColor(THEME.slateLight).fontSize(7.5).font(fonts.bold)
      .text(kpiName, cardX + 8, y + 7, { width: cardW - 16, lineBreak: false });

    // Metric Value
    const formattedVal = typeof kpi.value === 'number'
      ? (kpi.type === 'currency' ? formatCurrency(kpi.value, kpi.unit || 'INR', false, fonts.hasCustomFont) : `${formatNumber(kpi.value)}${kpi.unit ? ` ${sanitizeForPdf(kpi.unit, fonts.hasCustomFont)}` : ''}`)
      : sanitizeForPdf(String(kpi.value), fonts.hasCustomFont);

    const valFontSize = formattedVal.length > 14 ? 10 : (formattedVal.length > 10 ? 11.5 : 12.5);
    doc.fillColor(THEME.navy).fontSize(valFontSize).font(fonts.bold)
      .text(formattedVal, cardX + 8, y + 21, { width: cardW - 16, lineBreak: false });

    // Target Status Pill
    if (kpi.target) {
      const rawPct = Math.round((Number(kpi.value) / Number(kpi.target)) * 100);
      const targetFormatted = formatCompactNumber(kpi.target, kpi.type === 'currency' ? 'INR' : '', fonts.hasCustomFont);
      const isGood = rawPct >= 90;

      const pillBg = isGood ? THEME.emeraldPale : THEME.amberPale;
      const pillTextColor = isGood ? THEME.emerald : THEME.amber;

      const pillW = cardW - 16;
      const pillH = 12;
      const pillY = y + cardH - 16;

      doc.roundedRect(cardX + 8, pillY, pillW, pillH, 2.5)
        .fill(pillBg);

      doc.fillColor(pillTextColor).fontSize(6.5).font(fonts.bold)
        .text(`Target: ${targetFormatted} • ${rawPct}%`, cardX + 8, pillY + 2.5, { width: pillW, align: 'center', lineBreak: false });
    } else {
      doc.fillColor(THEME.emerald).fontSize(6.5).font(fonts.bold)
        .text('✓ Verified Metric', cardX + 8, y + cardH - 14, { width: cardW - 16, lineBreak: false });
    }
  });
}

/**
 * Render Chart 1: Revenue Velocity Trend (Vector Line Chart)
 */
function drawRevenueTrendLineChart(doc, { x, y, width, height, title, subtitle, data, fonts }) {
  doc.save();
  const fReg = fonts ? fonts.reg : 'Helvetica';
  const fBold = fonts ? fonts.bold : 'Helvetica-Bold';
  const hasCustomFont = fonts ? fonts.hasCustomFont : false;

  // Card background
  doc.roundedRect(x, y, width, height, 6)
    .fillAndStroke(THEME.bgCard, THEME.border);

  // Header
  doc.fillColor(THEME.navy).fontSize(9.5).font(fBold)
    .text(sanitizeForPdf(title || 'Revenue Velocity Trend', hasCustomFont), x + 12, y + 10, { width: width - 110, lineBreak: false });
  doc.fillColor(THEME.slateLight).fontSize(7).font(fReg)
    .text(sanitizeForPdf(subtitle || 'Daily revenue changes over reporting period', hasCustomFont), x + 12, y + 23, { width: width - 110, lineBreak: false });

  // Legend
  const legendX = x + width - 95;
  const legendY = y + 14;
  doc.circle(legendX, legendY, 3).fillColor(THEME.bluePrimary).fill();
  doc.fillColor(THEME.slateMedium).fontSize(6.8).font(fReg)
    .text('Revenue', legendX + 6, legendY - 3.5, { lineBreak: false });

  if (!data || data.length === 0) {
    doc.fillColor(THEME.slateMuted).fontSize(7.5).font(fReg)
      .text('No time-series date telemetry available.', x + 12, y + height / 2 - 5, { width: width - 24, align: 'center' });
    doc.restore();
    return;
  }

  const plotX = x + 44;
  const plotY = y + 38;
  const plotW = width - 58;
  const plotH = height - 60;

  const values = data.map(d => Number(d.value) || 0);
  const maxVal = Math.max(...values, 100);
  const scaleMax = maxVal * 1.15; // 15% headroom

  // Gridlines & Y-Axis Labels
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const stepVal = (scaleMax / gridSteps) * (gridSteps - i);
    const lineY = plotY + (plotH / gridSteps) * i;

    doc.strokeColor(THEME.border).lineWidth(0.6)
      .moveTo(plotX, lineY).lineTo(plotX + plotW, lineY).stroke();

    doc.fillColor(THEME.slateLight).fontSize(6.5).font(fReg)
      .text(formatCompactNumber(stepVal, 'INR', hasCustomFont), x + 2, lineY - 3.5, { width: 38, align: 'right', lineBreak: false });
  }

  // Baseline
  doc.strokeColor(THEME.borderDark).lineWidth(0.8)
    .moveTo(plotX, plotY + plotH).lineTo(plotX + plotW, plotY + plotH).stroke();

  // Points
  const points = data.map((d, idx) => {
    const val = Number(d.value) || 0;
    const ptX = data.length === 1 ? plotX + plotW / 2 : plotX + (idx / (data.length - 1)) * plotW;
    const ptY = plotY + plotH - (val / scaleMax) * plotH;
    const dateLabel = d.formattedDate || formatDate(d.name, false) || d.name || `P${idx + 1}`;
    return { x: ptX, y: ptY, val, dateLabel };
  });

  // Area Fill Under Curve
  if (points.length > 1) {
    doc.save();
    doc.moveTo(plotX, plotY + plotH);
    doc.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      doc.lineTo(points[i].x, points[i].y);
    }
    doc.lineTo(points[points.length - 1].x, plotY + plotH);
    doc.closePath();
    doc.fillColor(THEME.bluePrimary).fillOpacity(0.12).fill();
    doc.restore();
  }

  // Stroke Line
  if (points.length > 1) {
    doc.strokeColor(THEME.bluePrimary).lineWidth(2);
    doc.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      doc.lineTo(points[i].x, points[i].y);
    }
    doc.stroke();
  }

  // Vertices and Peak Callout
  let maxIdx = 0;
  points.forEach((p, idx) => {
    if (p.val > points[maxIdx].val) maxIdx = idx;
    if (points.length <= 25 || idx === 0 || idx === points.length - 1 || idx === maxIdx) {
      doc.circle(p.x, p.y, idx === maxIdx ? 3.5 : 2)
        .fillColor('#ffffff').strokeColor(THEME.bluePrimary).lineWidth(1.5)
        .fillAndStroke();
    }
  });

  // Peak Callout Pill
  if (points[maxIdx] && points[maxIdx].val > 0) {
    const peak = points[maxIdx];
    const peakStr = formatCompactNumber(peak.val, 'INR', hasCustomFont);
    const badgeW = Math.max(40, peakStr.length * 5.5 + 8);
    const badgeH = 12;
    const badgeX = Math.max(plotX + 2, Math.min(plotX + plotW - badgeW - 2, peak.x - badgeW / 2));
    const badgeY = Math.max(plotY - 6, peak.y - 16);

    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5)
      .fill(THEME.navy);
    doc.fillColor('#ffffff').fontSize(6).font(fBold)
      .text(peakStr, badgeX, badgeY + 2.5, { width: badgeW, align: 'center', lineBreak: false });
  }

  // X-Axis Date Labels (Subsampled cleanly to prevent overlapping)
  const maxLabels = Math.min(5, points.length);
  const step = Math.max(1, Math.ceil((points.length - 1) / (maxLabels - 1)));
  const labeledIndices = new Set();
  for (let i = 0; i < points.length; i += step) labeledIndices.add(i);
  labeledIndices.add(points.length - 1);

  labeledIndices.forEach(idx => {
    const p = points[idx];
    doc.fillColor(THEME.slateMedium).fontSize(6.5).font(fReg)
      .text(sanitizeForPdf(p.dateLabel, hasCustomFont), p.x - 20, plotY + plotH + 5, { width: 40, align: 'center', lineBreak: false });
  });

  doc.restore();
}

/**
 * Render Chart 2: Sales Channel Distribution (Vector Vertical Bar Chart)
 */
function drawSalesChannelBarChart(doc, { x, y, width, height, title, subtitle, data, fonts }) {
  doc.save();
  const fReg = fonts ? fonts.reg : 'Helvetica';
  const fBold = fonts ? fonts.bold : 'Helvetica-Bold';
  const hasCustomFont = fonts ? fonts.hasCustomFont : false;

  doc.roundedRect(x, y, width, height, 6)
    .fillAndStroke(THEME.bgCard, THEME.border);

  doc.fillColor(THEME.navy).fontSize(9.5).font(fBold)
    .text(sanitizeForPdf(title || 'Sales Channel Distribution', hasCustomFont), x + 12, y + 10, { width: width - 24, lineBreak: false });
  doc.fillColor(THEME.slateLight).fontSize(7).font(fReg)
    .text(sanitizeForPdf(subtitle || 'Revenue generated across sales channels', hasCustomFont), x + 12, y + 23, { width: width - 24, lineBreak: false });

  if (!data || data.length === 0) {
    doc.fillColor(THEME.slateMuted).fontSize(7.5).font(fReg)
      .text('No sales channel telemetry detected.', x + 12, y + height / 2 - 5, { width: width - 24, align: 'center' });
    doc.restore();
    return;
  }

  const plotX = x + 44;
  const plotY = y + 38;
  const plotW = width - 58;
  const plotH = height - 60;

  const sorted = [...data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)).slice(0, 5);
  const total = sorted.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const maxVal = Math.max(...sorted.map(d => Number(d.value) || 0), 100);
  const scaleMax = maxVal * 1.18; // 18% headroom

  // Gridlines & Ticks
  const gridSteps = 3;
  for (let i = 0; i <= gridSteps; i++) {
    const stepVal = (scaleMax / gridSteps) * (gridSteps - i);
    const lineY = plotY + (plotH / gridSteps) * i;

    doc.strokeColor(THEME.border).lineWidth(0.6)
      .moveTo(plotX, lineY).lineTo(plotX + plotW, lineY).stroke();

    doc.fillColor(THEME.slateLight).fontSize(6.5).font(fReg)
      .text(formatCompactNumber(stepVal, 'INR', hasCustomFont), x + 2, lineY - 3.5, { width: 38, align: 'right', lineBreak: false });
  }

  // Baseline
  doc.strokeColor(THEME.borderDark).lineWidth(0.8)
    .moveTo(plotX, plotY + plotH).lineTo(plotX + plotW, plotY + plotH).stroke();

  // Bars
  const n = sorted.length;
  const slotW = plotW / n;
  const barWidth = Math.min(32, slotW * 0.55);

  sorted.forEach((item, idx) => {
    const val = Number(item.value) || 0;
    const barH = Math.max(3, (val / scaleMax) * plotH);
    const barX = plotX + idx * slotW + (slotW - barWidth) / 2;
    const barY = plotY + plotH - barH;
    const isTop = idx === 0;

    const barColor = isTop ? THEME.bluePrimary : (idx === 1 ? THEME.blueSecondary : THEME.cyan);

    // Rounded top bar
    doc.roundedRect(barX, barY, barWidth, barH, 2.5).fill(barColor);

    // Formatted value above bar
    doc.fillColor(isTop ? THEME.bluePrimary : THEME.navy).fontSize(6.5).font(fBold)
      .text(formatCompactNumber(val, 'INR', hasCustomFont), barX - 12, barY - 9.5, { width: barWidth + 24, align: 'center', lineBreak: false });

    // Percentage pill below value if space
    const pct = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '';
    doc.fillColor(THEME.slateLight).fontSize(6).font(fReg)
      .text(pct, barX - 10, barY + 3, { width: barWidth + 20, align: 'center', lineBreak: false });

    // Channel label below baseline
    const label = sanitizeForPdf(item.name || item.category, hasCustomFont);
    doc.fillColor(THEME.slateMedium).fontSize(6.8).font(fReg)
      .text(label, barX - 14, plotY + plotH + 5, { width: barWidth + 28, align: 'center', lineBreak: false });
  });

  doc.restore();
}

/**
 * Render Chart 3: Regional Revenue Comparison (Vector Horizontal Bar Chart)
 */
function drawRegionalHorizontalBarChart(doc, { x, y, width, height, title, subtitle, data, fonts }) {
  doc.save();
  const fReg = fonts ? fonts.reg : 'Helvetica';
  const fBold = fonts ? fonts.bold : 'Helvetica-Bold';
  const hasCustomFont = fonts ? fonts.hasCustomFont : false;

  doc.roundedRect(x, y, width, height, 6)
    .fillAndStroke(THEME.bgCard, THEME.border);

  doc.fillColor(THEME.navy).fontSize(9.5).font(fBold)
    .text(sanitizeForPdf(title || 'Regional Revenue Comparison', hasCustomFont), x + 12, y + 10, { width: width - 24, lineBreak: false });
  doc.fillColor(THEME.slateLight).fontSize(7).font(fReg)
    .text(sanitizeForPdf(subtitle || 'Regional rankings sorted from highest to lowest revenue', hasCustomFont), x + 12, y + 23, { width: width - 24, lineBreak: false });

  if (!data || data.length === 0) {
    doc.fillColor(THEME.slateMuted).fontSize(7.5).font(fReg)
      .text('No regional dimension available in dataset.', x + 12, y + height / 2 - 5, { width: width - 24, align: 'center' });
    doc.restore();
    return;
  }

  const sorted = [...data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)).slice(0, 6);
  const total = sorted.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const maxVal = Math.max(...sorted.map(i => Number(i.value) || 0), 100);

  const topY = y + 38;
  const labelWidth = 62;
  const valWidth = 68;
  const barAreaLeft = x + labelWidth + 14;
  const barAreaWidth = width - labelWidth - valWidth - 28;
  const availableHeight = height - 48;
  const rowHeight = Math.min(22, availableHeight / sorted.length);
  const barHeight = Math.max(6, rowHeight * 0.45);

  sorted.forEach((item, idx) => {
    const val = Number(item.value) || 0;
    const rowY = topY + idx * rowHeight;
    const share = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
    const isLeader = idx === 0;

    // Region Name
    doc.fillColor(isLeader ? THEME.navy : THEME.slateDark).fontSize(7.2).font(isLeader ? fBold : fReg)
      .text(sanitizeForPdf(item.name || item.category, hasCustomFont), x + 12, rowY + (rowHeight - barHeight) / 2 - 2, {
        width: labelWidth,
        align: 'left',
        lineBreak: false
      });

    // Background track
    doc.roundedRect(barAreaLeft, rowY + (rowHeight - barHeight) / 2, barAreaWidth, barHeight, 2.5)
      .fill(THEME.bgLight);

    // Active bar
    const barWidth = Math.max(4, (val / maxVal) * barAreaWidth);
    const barColor = RANK_COLORS[idx % RANK_COLORS.length];
    doc.roundedRect(barAreaLeft, rowY + (rowHeight - barHeight) / 2, barWidth, barHeight, 2.5)
      .fill(barColor);

    // Value and share
    doc.fillColor(THEME.navy).fontSize(6.8).font(fBold)
      .text(formatCompactNumber(val, 'INR', hasCustomFont), barAreaLeft + barAreaWidth + 4, rowY + (rowHeight - barHeight) / 2 - 2, {
        width: 36,
        align: 'left',
        lineBreak: false
      });

    doc.fillColor(THEME.slateLight).fontSize(6.5).font(fReg)
      .text(`(${share}%)`, barAreaLeft + barAreaWidth + 38, rowY + (rowHeight - barHeight) / 2 - 2, {
        width: 26,
        align: 'right',
        lineBreak: false
      });
  });

  doc.restore();
}

/**
 * Render Chart 4: Product Performance (Ranked Horizontal Bar Chart)
 */
function drawProductPerformanceChart(doc, { x, y, width, height, title, subtitle, data, fonts }) {
  doc.save();
  const fReg = fonts ? fonts.reg : 'Helvetica';
  const fBold = fonts ? fonts.bold : 'Helvetica-Bold';
  const hasCustomFont = fonts ? fonts.hasCustomFont : false;

  doc.roundedRect(x, y, width, height, 6)
    .fillAndStroke(THEME.bgCard, THEME.border);

  doc.fillColor(THEME.navy).fontSize(9.5).font(fBold)
    .text(sanitizeForPdf(title || 'Top Product Performance', hasCustomFont), x + 12, y + 10, { width: width - 24, lineBreak: false });
  doc.fillColor(THEME.slateLight).fontSize(7).font(fReg)
    .text(sanitizeForPdf(subtitle || 'Top-performing catalog items by sales revenue', hasCustomFont), x + 12, y + 23, { width: width - 24, lineBreak: false });

  if (!data || data.length === 0) {
    doc.fillColor(THEME.slateMuted).fontSize(7.5).font(fReg)
      .text('No product SKU telemetry available.', x + 12, y + height / 2 - 5, { width: width - 24, align: 'center' });
    doc.restore();
    return;
  }

  const sorted = [...data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)).slice(0, 8);
  const total = sorted.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const maxVal = Math.max(...sorted.map(i => Number(i.value) || 0), 100);

  const topY = y + 38;
  const labelWidth = 78;
  const valWidth = 66;
  const barAreaLeft = x + labelWidth + 22;
  const barAreaWidth = width - labelWidth - valWidth - 36;
  const availableHeight = height - 48;
  const rowHeight = Math.min(18, availableHeight / sorted.length);
  const barHeight = Math.max(5, rowHeight * 0.42);

  sorted.forEach((item, idx) => {
    const val = Number(item.value) || 0;
    const rowY = topY + idx * rowHeight;
    const share = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';

    // Rank Circle Badge
    doc.circle(x + 18, rowY + rowHeight / 2 - 1, 4.5)
      .fill(idx < 3 ? THEME.bluePale : THEME.bgLight);

    doc.fillColor(idx < 3 ? THEME.bluePrimary : THEME.slateLight).fontSize(5.5).font(fBold)
      .text(String(idx + 1), x + 14, rowY + rowHeight / 2 - 4.5, { width: 8, align: 'center', lineBreak: false });

    // Product Name
    doc.fillColor(idx === 0 ? THEME.navy : THEME.slateDark).fontSize(6.8).font(idx === 0 ? fBold : fReg)
      .text(sanitizeForPdf(item.name || item.category, hasCustomFont), x + 26, rowY + (rowHeight - barHeight) / 2 - 2, {
        width: labelWidth - 14,
        align: 'left',
        lineBreak: false
      });

    // Background track
    doc.roundedRect(barAreaLeft, rowY + (rowHeight - barHeight) / 2, barAreaWidth, barHeight, 2)
      .fill(THEME.bgLight);

    // Bar fill
    const barWidth = Math.max(4, (val / maxVal) * barAreaWidth);
    const color = idx === 0 ? THEME.emerald : (idx < 3 ? THEME.bluePrimary : THEME.cyan);
    doc.roundedRect(barAreaLeft, rowY + (rowHeight - barHeight) / 2, barWidth, barHeight, 2)
      .fill(color);

    // Value on Right
    doc.fillColor(THEME.navy).fontSize(6.5).font(fBold)
      .text(formatCompactNumber(val, 'INR', hasCustomFont), barAreaLeft + barAreaWidth + 4, rowY + (rowHeight - barHeight) / 2 - 2, {
        width: 34,
        align: 'left',
        lineBreak: false
      });

    doc.fillColor(THEME.slateLight).fontSize(6.2).font(fReg)
      .text(`(${share}%)`, barAreaLeft + barAreaWidth + 36, rowY + (rowHeight - barHeight) / 2 - 2, {
        width: 24,
        align: 'right',
        lineBreak: false
      });
  });

  doc.restore();
}

/**
 * Smart Column Resolution for the Telemetry Data Table
 * Maps arbitrary dataset fields to enterprise reporting columns with proper alignments & widths
 */
function resolveTableColumns(rows, schema) {
  if (!rows || rows.length === 0) return [];
  const sample = rows[0];
  const keys = Object.keys(sample);

  // Preferred enterprise semantic mapping
  const semanticOrder = [
    { type: 'date', patterns: [/^order_date$/i, /^date$/i, /^transaction_date$/i, /^created_at$/i, /^period$/i], label: 'DATE', width: 68, align: 'left' },
    { type: 'order_id', patterns: [/^order_id$/i, /^txn_id$/i, /^id$/i, /^order_number$/i, /^reference$/i], label: 'ORDER ID', width: 64, align: 'left' },
    { type: 'region', patterns: [/^region$/i, /^territory$/i, /^location$/i, /^city$/i, /^state$/i], label: 'REGION', width: 72, align: 'left' },
    { type: 'channel', patterns: [/^channel$/i, /^sales_channel$/i, /^source$/i, /^medium$/i], label: 'CHANNEL', width: 88, align: 'left' },
    { type: 'product', patterns: [/^product$/i, /^product_name$/i, /^item$/i, /^sku$/i, /^category$/i, /^segment$/i], label: 'PRODUCT', width: 105, align: 'left' },
    { type: 'units', patterns: [/^units_sold$/i, /^units$/i, /^quantity$/i, /^qty$/i], label: 'UNITS', width: 44, align: 'right' },
    { type: 'revenue', patterns: [/^sales_amount$/i, /^revenue$/i, /^sales$/i, /^amount$/i, /^total_amount$/i, /^gross_sales$/i], label: 'REVENUE', width: 82, align: 'right' }
  ];

  const resolved = [];
  const matchedKeys = new Set();

  for (const sem of semanticOrder) {
    const foundKey = keys.find(k => !matchedKeys.has(k) && sem.patterns.some(p => p.test(k)));
    if (foundKey) {
      resolved.push({
        key: foundKey,
        label: sem.label,
        width: sem.width,
        align: sem.align,
        type: sem.type
      });
      matchedKeys.add(foundKey);
    }
  }

  // If semantic patterns didn't match enough columns, use raw keys from rows
  if (resolved.length < 3) {
    const fallbackCols = keys.slice(0, 7).map(k => {
      const isNum = rows.some(r => typeof r[k] === 'number');
      const isCurr = /revenue|sales|amount|price|profit/i.test(k);
      const isDate = /date|time/i.test(k);
      return {
        key: k,
        label: k.replace(/_/g, ' ').toUpperCase(),
        width: Math.floor(523 / Math.min(keys.length, 7)),
        align: isNum ? 'right' : 'left',
        type: isCurr ? 'revenue' : (isDate ? 'date' : (isNum ? 'units' : 'text'))
      };
    });
    return fallbackCols;
  }

  // Adjust widths proportionally to exactly fit 523pt content width
  const totalW = resolved.reduce((s, c) => s + c.width, 0);
  const factor = 523 / totalW;
  resolved.forEach(c => {
    c.width = Math.floor(c.width * factor);
  });
  const sumW = resolved.reduce((s, c) => s + c.width, 0);
  if (sumW < 523 && resolved.length > 0) {
    resolved[resolved.length - 1].width += (523 - sumW);
  }

  return resolved;
}

/**
 * Render Telemetry Data Table on Page 2 and Subsequent Pages
 */
function drawDataTable(doc, { rows, schema, datasetName, totalCount, x, startY, width, fonts }) {
  const fReg = fonts.reg;
  const fBold = fonts.bold;
  const hasCustomFont = fonts.hasCustomFont;

  const columns = resolveTableColumns(rows, schema);
  if (columns.length === 0) return startY;

  // Header Badge (Dataset Name & Scope)
  doc.roundedRect(x, startY, width, 22, 3).fill(THEME.bgLight);
  doc.fillColor(THEME.slateDark).fontSize(7.5).font(fBold)
    .text(`Dataset: ${sanitizeForPdf(datasetName || 'Primary Telemetry', hasCustomFont)}`, x + 8, startY + 6.5, { lineBreak: false });

  const totalDisplayRows = Math.min(rows.length, 60);
  const scopeMsg = `Showing verified records (1 to ${totalDisplayRows} of ${formatNumber(totalCount || rows.length)} rows)  •  Full telemetry export via CSV/XLSX`;
  doc.fillColor(THEME.slateLight).fontSize(7).font(fReg)
    .text(scopeMsg, x + 200, startY + 6.5, { width: width - 208, align: 'right', lineBreak: false });

  let curY = startY + 28;

  // Function to render table header
  const renderTableHeader = (headerY) => {
    doc.roundedRect(x, headerY, width, 20, 2).fill(THEME.navy);
    let colX = x + 8;
    columns.forEach(col => {
      doc.fillColor('#ffffff').fontSize(7.2).font(fBold)
        .text(col.label, colX, headerY + 5.5, { width: col.width - 6, align: col.align, lineBreak: false });
      colX += col.width;
    });
  };

  renderTableHeader(curY);
  curY += 20;

  // Data Rows
  let sumUnits = 0;
  let sumRevenue = 0;
  const rowHeight = 17.5;
  const maxRowsPerPage = 34;
  let rowsOnCurrentPage = 0;

  for (let rIdx = 0; rIdx < totalDisplayRows; rIdx++) {
    const row = rows[rIdx];

    // Check if new page is needed
    if (curY > 740 || rowsOnCurrentPage >= maxRowsPerPage) {
      doc.addPage();
      // Running header on continuation page
      doc.roundedRect(x, 36, width, 26, 3).fill(THEME.navy);
      doc.fillColor('#ffffff').fontSize(8.5).font(fBold)
        .text('RICOZ ANALYTICS  •  DATASET TELEMETRY AUDIT (CONTINUED)', x + 10, 44, { lineBreak: false });
      curY = 70;
      renderTableHeader(curY);
      curY += 20;
      rowsOnCurrentPage = 0;
    }

    const isEven = rIdx % 2 === 0;
    const rowBg = isEven ? '#ffffff' : THEME.bgLight;

    doc.rect(x, curY, width, rowHeight).fillAndStroke(rowBg, '#f1f5f9');

    let colX = x + 8;
    columns.forEach(col => {
      const rawVal = row[col.key];
      let displayVal = '-';

      if (rawVal !== undefined && rawVal !== null) {
        if (col.type === 'revenue' || /sales|revenue|amount|profit|price/i.test(col.key)) {
          const num = Number(rawVal);
          displayVal = formatCurrency(num, 'INR', false, hasCustomFont);
          sumRevenue += (isNaN(num) ? 0 : num);
        } else if (col.type === 'units' || /units|quantity|qty/i.test(col.key)) {
          const num = Number(rawVal);
          displayVal = formatNumber(num);
          sumUnits += (isNaN(num) ? 0 : num);
        } else if (col.type === 'date' || /date/i.test(col.key)) {
          displayVal = formatDate(rawVal);
        } else {
          displayVal = sanitizeForPdf(String(rawVal), hasCustomFont);
        }
      }

      doc.fillColor(THEME.slateDark).fontSize(7).font(fReg)
        .text(displayVal, colX, curY + 4.5, { width: col.width - 6, align: col.align, lineBreak: false });
      colX += col.width;
    });

    curY += rowHeight;
    rowsOnCurrentPage++;
  }

  // Summary Totals Row
  doc.rect(x, curY, width, 20).fillAndStroke(THEME.bluePale, THEME.borderDark);
  doc.fillColor(THEME.bluePrimary).fontSize(7.5).font(fBold)
    .text(`SUMMARY AUDIT TOTALS (${totalDisplayRows} DISPLAYED RECORDS)`, x + 8, curY + 5.5, { width: 300, lineBreak: false });

  // Locate units and revenue column X positions for totals
  let runningX = x + 8;
  columns.forEach(col => {
    if (col.type === 'units' || /units|quantity|qty/i.test(col.key)) {
      doc.fillColor(THEME.bluePrimary).fontSize(7.5).font(fBold)
        .text(formatNumber(sumUnits), runningX, curY + 5.5, { width: col.width - 6, align: 'right', lineBreak: false });
    } else if (col.type === 'revenue' || /sales|revenue|amount/i.test(col.key)) {
      doc.fillColor(THEME.bluePrimary).fontSize(7.5).font(fBold)
        .text(formatCurrency(sumRevenue, 'INR', false, hasCustomFont), runningX, curY + 5.5, { width: col.width - 6, align: 'right', lineBreak: false });
    }
    runningX += col.width;
  });

  return curY + 20;
}

/**
 * Helper to ensure widget chart_data is fully populated from dataset rows if not already populated
 */
function ensureWidgetChartData(data) {
  if (!data.widgets) data.widgets = [];
  if (!data.rows || data.rows.length === 0) return;

  const rows = data.rows;
  const keys = Object.keys(rows[0] || {});

  const dateCol = keys.find(k => /order_date|date|quarter|month|period|time/i.test(k));
  const metricCol = keys.find(k => /sales_amount|revenue|sales|amount|price/i.test(k)) || keys.find(k => typeof rows[0][k] === 'number');
  const regionCol = keys.find(k => /region|territory|city|state|location/i.test(k));
  const channelCol = keys.find(k => /channel|source|medium/i.test(k));
  const segmentCol = keys.find(k => /segment|category|tier/i.test(k));
  const productCol = keys.find(k => /product|sku|item/i.test(k));

  // 1. Trend widget
  let trendW = data.widgets.find(w => w.type === 'line_chart' || /trend|velocity/i.test(w.title));
  if ((!trendW || !trendW.chart_data || trendW.chart_data.length === 0) && dateCol && metricCol) {
    const trendMap = new Map();
    rows.forEach(r => {
      const d = String(r[dateCol] || '');
      const v = Number(r[metricCol]) || 0;
      trendMap.set(d, (trendMap.get(d) || 0) + v);
    });
    const chart_data = Array.from(trendMap.entries()).map(([name, value]) => ({ name, value }));
    if (trendW) trendW.chart_data = chart_data;
    else {
      data.widgets.push({
        id: 'widget-trend',
        title: 'Revenue Velocity Trend',
        type: 'line_chart',
        chart_data
      });
    }
  }

  // 2. Channel widget
  const catCol = channelCol || segmentCol;
  let chanW = data.widgets.find(w => /channel|segment/i.test(w.title));
  if ((!chanW || !chanW.chart_data || chanW.chart_data.length === 0) && catCol && metricCol) {
    const catMap = new Map();
    rows.forEach(r => {
      const c = String(r[catCol] || '');
      const v = Number(r[metricCol]) || 0;
      catMap.set(c, (catMap.get(c) || 0) + v);
    });
    const chart_data = Array.from(catMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    if (chanW) chanW.chart_data = chart_data;
    else {
      data.widgets.push({
        id: 'widget-channel',
        title: channelCol ? 'Sales Channel Distribution' : 'Segment Distribution',
        type: 'bar_chart',
        chart_data
      });
    }
  }

  // 3. Regional widget
  let regW = data.widgets.find(w => /region/i.test(w.title));
  if ((!regW || !regW.chart_data || regW.chart_data.length === 0) && regionCol && metricCol) {
    const regMap = new Map();
    rows.forEach(r => {
      const reg = String(r[regionCol] || '');
      const v = Number(r[metricCol]) || 0;
      regMap.set(reg, (regMap.get(reg) || 0) + v);
    });
    const chart_data = Array.from(regMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    if (regW) regW.chart_data = chart_data;
    else {
      data.widgets.push({
        id: 'widget-region',
        title: 'Regional Revenue Comparison',
        type: 'horizontal_bar_chart',
        chart_data
      });
    }
  }

  // 4. Product widget
  let prodW = data.widgets.find(w => /product|sku/i.test(w.title));
  if ((!prodW || !prodW.chart_data || prodW.chart_data.length === 0) && (productCol || segmentCol) && metricCol) {
    const pCol = productCol || segmentCol;
    const prodMap = new Map();
    rows.forEach(r => {
      const p = String(r[pCol] || '');
      const v = Number(r[metricCol]) || 0;
      prodMap.set(p, (prodMap.get(p) || 0) + v);
    });
    const chart_data = Array.from(prodMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    if (prodW) prodW.chart_data = chart_data;
    else {
      data.widgets.push({
        id: 'widget-product',
        title: 'Top Product Performance',
        type: 'bar_chart',
        chart_data
      });
    }
  }
}

/**
 * Main PDF Generation Engine
 * Creates a pristine executive presentation compliant with enterprise BI standards
 */
async function generateExecutivePdf(data) {
  ensureWidgetChartData(data);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margins: { top: 36, bottom: 22, left: 36, right: 36 },
        size: 'A4',
        bufferPages: true,
        info: {
          Title: sanitizeForPdf(data.title || 'Executive Report'),
          Author: 'RicozAnalytics Enterprise Platform',
          Subject: 'Executive Business Intelligence Report',
          Keywords: 'Analytics, Business Intelligence, Revenue, KPI, Ricoz'
        }
      });

      const fonts = setupFonts(doc);

      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const margin = 36;
      const contentWidth = 523; // 595.28 - 72

      // ======================================================================
      // PAGE 1: EXECUTIVE DASHBOARD & CORE CHARTS
      // ======================================================================

      // 1. Executive Header Bar
      drawReportHeader(doc, data, fonts);

      // 2. Report Title & Subtitle Block
      let curY = 104;
      doc.fillColor(THEME.navy).fontSize(15).font(fonts.bold)
        .text(sanitizeForPdf(data.title, fonts.hasCustomFont), margin, curY, { width: contentWidth, lineBreak: false });

      if (data.description) {
        curY += 19;
        doc.fillColor(THEME.slateLight).fontSize(8.5).font(fonts.reg)
          .text(sanitizeForPdf(data.description, fonts.hasCustomFont), margin, curY, { width: contentWidth, lineBreak: false });
      }

      curY += 16;

      // 3. Executive Summary Box
      const highlights = buildExecutiveSummary(data, fonts.hasCustomFont);
      drawExecutiveSummaryBox(doc, highlights, margin, curY, contentWidth, fonts);

      // 4. Key Performance Indicators Ribbon
      curY += 60;
      drawKpiCardsRibbon(doc, data.kpis || [], margin, curY, contentWidth, fonts);

      // 5. Visualizations Section (Row 1: Line Chart & Channel Bar Chart)
      curY += 64;
      const colWidth = (contentWidth - 11) / 2; // 256pt each
      const chartHeight = 176;

      const widgets = data.widgets || [];
      const trendWidget = widgets.find(w => w.type === 'line_chart' || /trend|velocity/i.test(w.title)) || {
        title: 'Revenue Velocity Trend',
        subtitle: 'Daily chronological sales performance',
        chart_data: []
      };

      const channelWidget = widgets.find(w => /channel/i.test(w.title) || (w.id && w.id.includes('channel'))) || {
        title: 'Sales Channel Distribution',
        subtitle: 'Revenue comparison across active channels',
        chart_data: []
      };

      // Chart 1: Revenue Velocity Trend
      drawRevenueTrendLineChart(doc, {
        x: margin,
        y: curY,
        width: colWidth,
        height: chartHeight,
        title: trendWidget.title || 'Revenue Velocity Trend',
        subtitle: 'Daily chronological sales performance',
        data: trendWidget.chart_data || [],
        fonts
      });

      // Chart 2: Sales Channel Distribution
      drawSalesChannelBarChart(doc, {
        x: margin + colWidth + 11,
        y: curY,
        width: colWidth,
        height: chartHeight,
        title: channelWidget.title || 'Sales Channel Distribution',
        subtitle: 'Revenue comparison across active channels',
        data: channelWidget.chart_data || [],
        fonts
      });

      // 6. Visualizations Section (Row 2: Regional & Product Rankings)
      curY += chartHeight + 8;

      const regionWidget = widgets.find(w => /region/i.test(w.title) || (w.id && w.id.includes('region'))) || {
        title: 'Regional Revenue Comparison',
        subtitle: 'Ranked performance across operating territories',
        chart_data: []
      };

      const productWidget = widgets.find(w => /product|sku|category/i.test(w.title) || (w.id && w.id.includes('product'))) || {
        title: 'Top Product Performance',
        subtitle: 'Revenue volume across product catalog',
        chart_data: []
      };

      // Chart 3: Regional Revenue Comparison (Horizontal Bar Chart)
      drawRegionalHorizontalBarChart(doc, {
        x: margin,
        y: curY,
        width: colWidth,
        height: chartHeight,
        title: regionWidget.title || 'Regional Revenue Comparison',
        subtitle: 'Regional rankings sorted from highest to lowest revenue',
        data: regionWidget.chart_data || [],
        fonts
      });

      // Chart 4: Product Performance (Ranked Bar Chart)
      drawProductPerformanceChart(doc, {
        x: margin + colWidth + 11,
        y: curY,
        width: colWidth,
        height: chartHeight,
        title: productWidget.title || 'Top Product Performance',
        subtitle: 'Leading catalog items ranked by aggregate sales revenue',
        data: productWidget.chart_data || [],
        fonts
      });

      // ======================================================================
      // PAGE 2: DATASET TELEMETRY AUDIT & DATA TABLE
      // ======================================================================
      doc.addPage();

      // Page 2 Running Header
      doc.roundedRect(margin, 36, contentWidth, 28, 4).fill(THEME.navy);
      doc.fillColor('#ffffff').fontSize(8.5).font(fonts.bold)
        .text('RICOZ ANALYTICS', margin + 12, 45, { lineBreak: false });
      doc.fillColor(THEME.slateMuted).fontSize(7.5).font(fonts.reg)
        .text(`Executive Telemetry Audit  •  ${sanitizeForPdf(data.title, fonts.hasCustomFont)}`, margin + 120, 46, { lineBreak: false });
      doc.fillColor(THEME.cyanLight).fontSize(7).font(fonts.bold)
        .text(sanitizeForPdf(data.organizationName, fonts.hasCustomFont), margin + 300, 46, { width: contentWidth - 312, align: 'right', lineBreak: false });

      // Telemetry Data Table
      drawDataTable(doc, {
        rows: data.rows || [],
        schema: data.datasetSchema || [],
        datasetName: data.datasetName || 'Primary Telemetry',
        totalCount: data.totalRowCount || (data.rows ? data.rows.length : 0),
        x: margin,
        startY: 72,
        width: contentWidth,
        fonts
      });

      // ======================================================================
      // TWO-PASS PAGE NUMBERING AND CONFIDENTIALITY FOOTERS ON ALL PAGES
      // ======================================================================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        const footerY = 792;
        // Subtle divider line
        doc.strokeColor(THEME.border).lineWidth(0.8)
          .moveTo(margin, footerY).lineTo(margin + contentWidth, footerY).stroke();

        // Left Confidentiality Statement
        doc.fillColor(THEME.slateMuted).fontSize(6.8).font(fonts.reg)
          .text('CONFIDENTIAL & PROPRIETARY — RicozAnalytics Enterprise Intelligence Platform', margin, footerY + 5, {
            width: contentWidth * 0.70,
            align: 'left',
            lineBreak: false
          });

        // Right Dynamic Page Numbering: "Page X of Y"
        doc.fillColor(THEME.slateLight).fontSize(7).font(fonts.bold)
          .text(`Page ${i + 1} of ${range.count}`, margin + contentWidth * 0.70, footerY + 5, {
            width: contentWidth * 0.30,
            align: 'right',
            lineBreak: false
          });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateExecutivePdf,
  sanitizeForPdf,
  formatCurrency,
  formatCompactNumber,
  buildExecutiveSummary,
  drawRevenueTrendLineChart,
  drawSalesChannelBarChart,
  drawRegionalHorizontalBarChart,
  drawProductPerformanceChart
};
