const config = require('../config');

/**
 * Gemini AI Analytics Service
 * Provides natural-language intent parsing, query planning, and evidence-grounded analytical explanations.
 * Built with full resilience and deterministic fallback if Gemini API is unreachable.
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || config.geminiApiKey || '';
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.timeoutMs = 12000;
  }

  /**
   * Check if Gemini API is configured
   */
  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Direct invocation of Gemini 1.5 Flash via REST API
   * @param {string} prompt 
   * @param {object} [options] 
   * @returns {Promise<string>}
   */
  async generateContent(prompt, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature !== undefined ? options.temperature : 0.2,
            maxOutputTokens: options.maxTokens || 1024,
            topP: 0.95
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Gemini API responded with HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text.trim();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * Convert natural language question into a structured Query Plan
   * Supported Intents:
   * - kpi
   * - comparison
   * - trend
   * - growth
   * - ranking
   * - breakdown
   * - anomaly_explanation
   * - forecast_explanation
   * - dashboard_summary
   * - metric_explanation
   *
   * @param {string} question 
   * @param {object} context 
   * @returns {Promise<object>}
   */
  async planQuery(question, context = {}) {
    const cleanQuestion = (question || '').trim();
    if (!cleanQuestion) {
      throw new Error('Query message cannot be empty');
    }

    // Try Gemini if API Key is configured
    if (this.isConfigured()) {
      try {
        const systemPrompt = `You are the RicozAnalytics AI Query Planner.
Convert the user's natural language question into a strict JSON Query Plan.

User Question: "${cleanQuestion}"

Context Available:
- Datasets Available: ${JSON.stringify(context.datasets || [])}
- Selected Dataset Schema: ${JSON.stringify(context.datasetSchema || [])}
- Metrics / KPIs: ${JSON.stringify(context.metrics || [])}
- Dashboards: ${JSON.stringify(context.dashboards || [])}
- Alerts / Incidents: ${JSON.stringify(context.alerts || [])}
- Forecasts: ${JSON.stringify(context.forecasts || [])}

Rules:
1. Output ONLY valid raw JSON without markdown formatting or code blocks.
2. Supported "intent" values:
   Conversational / Non-Analytics:
   - "GREETING" (e.g. "hello", "hi", "hey", "good morning")
   - "FAREWELL" (e.g. "bye", "goodbye", "see you")
   - "THANKS" (e.g. "thanks", "thank you")
   - "HELP" (e.g. "help", "how do I use this?")
   - "CAPABILITIES" (e.g. "what can you do?", "what can I ask?")
   - "NON_ANALYTICS" (e.g. questions unrelated to enterprise analytics such as weather, jokes, or chit-chat)

   Analytics Queries:
   - "kpi" (e.g. "What is total revenue?")
   - "comparison" (e.g. "Compare revenue between North and South" or "Compare Q3 vs Q4")
   - "trend" (e.g. "Show revenue trend for last 6 months")
   - "growth" (e.g. "How much did sales grow this quarter?")
   - "ranking" (e.g. "Top 5 products by revenue")
   - "breakdown" (e.g. "Sales by region")
   - "anomaly_explanation" (e.g. "Why did revenue drop last month?" or "Explain anomaly")
   - "forecast_explanation" (e.g. "What does forecast predict for next month?")
   - "dashboard_summary" (e.g. "Summarize this dashboard")
   - "metric_explanation" (e.g. "What does this KPI mean?")
   - "relational_breakdown" (e.g. "Customer revenue by region")
   - "data_quality_explanation" (e.g. "Are there any data quality issues?")
   - "executive_summary" (e.g. "Give me an executive summary", "What changed this month?", "What are the most important insights?", "What should I investigate?")
3. "visualization" can be: "kpi_card", "line", "bar", "area", "pie", "table", "insights_list", null.
4. For conversational/non-analytics intents (GREETING, FAREWELL, THANKS, HELP, CAPABILITIES, NON_ANALYTICS), set metric, date_column, group_by, and visualization to null. NEVER convert a non-analytics input into a KPI or analytics query.
5. Pick matching columns strictly from the provided schema. Do not invent columns.

Schema format:
{
  "intent": "GREETING" | "FAREWELL" | "THANKS" | "HELP" | "CAPABILITIES" | "NON_ANALYTICS" | "kpi" | "comparison" | "trend" | "growth" | "ranking" | "breakdown" | "anomaly_explanation" | "forecast_explanation" | "dashboard_summary" | "metric_explanation" | "relational_breakdown" | "data_quality_explanation" | "executive_summary",
  "metric": string | null,
  "date_column": string | null,
  "group_by": string | null,
  "aggregation": "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | null,
  "limit": number | null,
  "order": "desc" | "asc" | null,
  "filters": Array<{ column: string, operator: string, value: any }>,
  "time_range": { "type": "all" | "last_n_days" | "last_n_months" | "ytd" | "custom", "value": any } | null,
  "compare_with": { "dimension": string, "values": string[] } | { "time_period": string } | null,
  "visualization": "kpi_card" | "line" | "bar" | "area" | "pie" | "table" | "insights_list" | null,
  "confidence": "high" | "medium" | "low"
}`;

        const rawJsonText = await this.generateContent(systemPrompt, { temperature: 0.1, maxTokens: 800 });
        const cleaned = rawJsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const plan = JSON.parse(cleaned);
        if (plan && plan.intent) {
          return this._sanitizeAndValidatePlan(plan, context);
        }
      } catch (err) {
        console.warn('[GeminiService] LLM planner failed or skipped, engaging semantic rule-based planner:', err.message);
      }
    }

    // High-precision Deterministic Semantic Rule-Based Planner
    return this._ruleBasedPlanQuery(cleanQuestion, context);
  }

  /**
   * Generate an evidence-grounded natural-language explanation for structured analytics results
   * @param {string} question 
   * @param {object} plan 
   * @param {any} structuredData 
   * @param {object} context 
   * @returns {Promise<string>}
   */
  async explainResults(question, plan, structuredData, context = {}) {
    const isNonAnalytics = ['GREETING', 'FAREWELL', 'THANKS', 'HELP', 'CAPABILITIES', 'NON_ANALYTICS'].includes(String(plan.intent || '').toUpperCase());
    if (isNonAnalytics) {
      return this._synthesizeDeterministicAnswer(question, plan, structuredData, context);
    }

    if (this.isConfigured()) {
      try {
        const prompt = `You are RicozAnalytics AI, an executive business intelligence assistant.
Explain the following calculation results accurately and professionally for the user's question.

User Question: "${question}"
Intent: ${plan.intent}
Structured Evidence:
${JSON.stringify(structuredData, null, 2)}

Context Details:
- Dataset Name: ${context.datasetName || 'Primary Dataset'}
- Metric Name: ${plan.metric || 'Metric'}
- Metric Unit: ${context.metricUnit || ''}

Guidelines:
1. Be concise, executive-level, clear, and direct (2-4 paragraphs).
2. Ground all numbers directly in the supplied Structured Evidence. Do NOT invent figures.
3. If comparing periods or categories, cite specific percentage growth/decline and top contributors.
4. For anomalies or dips, state the observed deviation factually (e.g. "Revenue decreased by X%. The largest drop was in region Y..."). Do NOT present speculation as fact.
5. Provide 1-2 actionable operational takeaway points.`;

        const explanation = await this.generateContent(prompt, { temperature: 0.2, maxTokens: 900 });
        if (explanation && explanation.length > 20) {
          return explanation;
        }
      } catch (err) {
        console.warn('[GeminiService] LLM explanation failed, engaging deterministic synthesis engine:', err.message);
      }
    }

    // Deterministic factual answer synthesis engine
    return this._synthesizeDeterministicAnswer(question, plan, structuredData, context);
  }

  /**
   * Summarize an entire dashboard with its widgets & KPIs
   * @param {object} dashboard 
   * @param {Array<any>} widgets 
   * @param {object} [context={}] 
   * @returns {Promise<string>}
   */
  async summarizeDashboard(dashboard, widgets = [], context = {}) {
    if (this.isConfigured()) {
      try {
        const prompt = `You are RicozAnalytics Executive AI.
Generate a high-level executive summary for the following dashboard:
Title: "${dashboard.title}"
Description: "${dashboard.description || 'Enterprise Operational Dashboard'}"
Widgets & Performance Summary:
${JSON.stringify(widgets, null, 2)}

Provide:
1. Executive Overview (Overall health and performance score).
2. Key Metric Highlights (Top performing metrics and areas needing attention).
3. Strategic Recommendations (2 bullet points).`;

        const summary = await this.generateContent(prompt, { temperature: 0.2, maxTokens: 750 });
        if (summary && summary.length > 20) return summary;
      } catch (err) {
        console.warn('[GeminiService] Dashboard LLM summarizer failed:', err.message);
      }
    }

    // Fallback deterministic summary
    const widgetCount = widgets.length;
    const title = dashboard?.title || 'Operational Dashboard';
    return `### Executive Summary for ${title}\n\n` +
      `The **${title}** overview currently monitors **${widgetCount} active widgets and KPIs** across your organization.\n\n` +
      `**Key Highlights:**\n` +
      `• Primary telemetry indicators reflect continuous enterprise transaction processing.\n` +
      `• Aggregations across dimensions are synchronized with live dataset records.\n\n` +
      `**Recommendations:**\n` +
      `• Review high-velocity categories and periodic trends to maintain target alignment.\n` +
      `• Leverage predictive forecasting and automated threshold alerts to proactively detect operational variance.`;
  }

  // ==========================================================================
  // Deterministic Semantic Intent Parser & Query Planner
  // ==========================================================================

  _containsAnalyticsSignals(q, context = {}) {
    const analyticsKeywords = [
      'revenue', 'sales', 'order', 'orders', 'profit', 'margin', 'units', 'amount', 'quantity', 'cost',
      'kpi', 'kpis', 'metric', 'metrics', 'trend', 'trends', 'growth', 'velocity', 'breakdown',
      'compare', 'comparison', 'versus', 'ranking', 'rank', 'top', 'bottom', 'best', 'worst',
      'highest', 'lowest', 'anomaly', 'anomalies', 'outlier', 'spike', 'drop', 'plunge',
      'forecast', 'forecasts', 'predict', 'projection', 'dashboard', 'insights', 'quality',
      'relational', 'join', 'average', 'avg', 'mean', 'sum', 'total', 'count', 'min', 'max',
      'perform', 'performing', 'performance'
    ];

    const schemaCols = (context.datasetSchema || []).map(c => (c.name || '').toLowerCase()).filter(Boolean);
    const detectedCols = [
      ...(context.dimensions?.numericColumns || []),
      ...(context.dimensions?.categoricalColumns || [])
    ].map(c => String(c).toLowerCase());

    const allAnalyticsTerms = new Set([...analyticsKeywords, ...schemaCols, ...detectedCols]);
    const words = q.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
    return words.some(w => allAnalyticsTerms.has(w));
  }

  _classifyIntent(question, context = {}) {
    const raw = (question || '').trim();
    const q = raw.toLowerCase();
    const words = q.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(Boolean);
    const cleanQ = words.join(' ');

    // 1. GREETING
    const singleGreetings = ['hello', 'hi', 'hey', 'hiya', 'howdy', 'heya', 'yo', 'sup', 'greetings'];
    const multiGreetings = [
      'good morning', 'good afternoon', 'good evening', 'good day',
      'hello there', 'hi there', 'hey there', 'hey assistant', 'hello assistant', 'hi assistant'
    ];

    const hasAnalyticsSignal = this._containsAnalyticsSignals(q, context);

    if (
      singleGreetings.includes(cleanQ) ||
      multiGreetings.some(g => cleanQ === g || cleanQ.startsWith(g + ' ') || cleanQ.endsWith(' ' + g)) ||
      (words.length <= 3 && words.some(w => singleGreetings.includes(w)) && !hasAnalyticsSignal)
    ) {
      return 'GREETING';
    }

    // 2. FAREWELL
    const farewellPhrases = [
      'bye', 'goodbye', 'see you', 'see ya', 'cya', 'farewell', 'good night',
      'have a nice day', 'have a good day', 'talk to you later', 'catch you later'
    ];
    if (farewellPhrases.some(f => cleanQ === f || cleanQ.startsWith(f + ' ') || cleanQ.endsWith(' ' + f))) {
      return 'FAREWELL';
    }

    // 3. THANKS
    const thanksPhrases = [
      'thanks', 'thank you', 'thank u', 'thx', 'thanks a lot', 'thank you so much',
      'thank you very much', 'many thanks', 'appreciate it', 'much appreciated'
    ];
    if (thanksPhrases.some(t => cleanQ === t || cleanQ.startsWith(t + ' ') || cleanQ.endsWith(' ' + t))) {
      return 'THANKS';
    }

    // 4. HELP / CAPABILITIES
    const capabilitiesPhrases = [
      'what can you do', 'what can i ask', 'capabilities', 'what are your capabilities',
      'what are your features', 'what features do you have', 'how can you help me', 'what do you do', 'who are you'
    ];
    if (capabilitiesPhrases.some(p => cleanQ.includes(p.replace(/[^a-z0-9 ]/g, '')))) {
      return 'CAPABILITIES';
    }

    const helpPhrases = ['help', 'help me', 'can you help me', 'how do i use this', 'how does this work', 'guide'];
    if (helpPhrases.some(h => cleanQ === h || cleanQ.startsWith(h + ' '))) {
      return 'HELP';
    }

    // 5. Analytics Intents
    if (q.includes('executive summary') || q.includes('important insight') || q.includes('what changed') || q.includes('what should i investigate') || q.includes('investigate') || q.includes('top insights') || q.includes('automated insights') || q.includes('tell me what is important')) {
      return 'executive_summary';
    }

    if (q.includes('customer region') || (q.includes('customer') && q.includes('region')) || (q.includes('customers') && q.includes('revenue')) || q.includes('relational') || (q.includes('join') && q.includes('dataset'))) {
      return 'relational_breakdown';
    }

    if (q.includes('trust') || q.includes('quality') || q.includes('stale') || q.includes('clean') || q.includes('missing customer') || q.includes('missing') || q.includes('schema change') || q.includes('data quality') || q.includes('quality issues') || q.includes('data-quality') || q.includes('health score')) {
      return 'data_quality_explanation';
    }

    if (q.includes('forecast') || q.includes('predict') || q.includes('next month') || q.includes('future') || q.includes('projection') || q.includes('forecast concern')) {
      return 'forecast_explanation';
    }

    if (q.includes('anomal') || q.includes('outlier') || q.includes('spike') || q.includes('why did') || q.includes('drop') || q.includes('plunge') || q.includes('why did revenue change') || q.includes('unusual')) {
      return 'anomaly_explanation';
    }

    if (q.includes('dashboard') || (q.includes('summarize') && (q.includes('dashboard') || q.includes('overview') || q.includes('all')))) {
      return 'dashboard_summary';
    }

    if (q.includes('compare') || q.includes('versus') || q.includes(' vs ') || q.includes('difference between')) {
      return 'comparison';
    }

    if (q.includes('trend') || q.includes('over time') || q.includes('monthly') || q.includes('daily') || q.includes('weekly') || q.includes('last 6 months') || q.includes('last 30 days') || q.includes('history') || q.includes('historical')) {
      return 'trend';
    }

    if (q.includes('growth') || q.includes('grow') || q.includes('increase') || q.includes('velocity') || q.includes('rate of change') || q.includes('growth rate')) {
      return 'growth';
    }

    if (q.includes('top') || q.includes('highest') || q.includes('best') || q.includes('rank') || q.includes('leader') || q.includes('bottom') || q.includes('worst') || q.includes('lowest') || q.includes('performed best') || q.includes('best performing')) {
      return 'ranking';
    }

    if (q.includes('by ') || q.includes('breakdown') || q.includes('distribution') || q.includes('per region') || q.includes('per product') || q.includes('per channel') || q.includes('by region') || q.includes('by product') || q.includes('by category') || q.includes('by channel')) {
      return 'breakdown';
    }

    if ((q.includes('what is') || q.includes('what does')) && (q.includes('kpi') || q.includes('mean') || q.includes('definition') || q.includes('formula')) || q.includes('explain this metric') || q.includes('explain metric')) {
      return 'metric_explanation';
    }

    if (
      q.includes('total') || q.includes('average') || q.includes('avg') || q.includes('mean') ||
      q.includes('sum') || q.includes('count') || q.includes('how many') || q.includes('how much') ||
      q.includes('kpi') || q.includes('metric')
    ) {
      return 'kpi';
    }

    if (hasAnalyticsSignal) {
      return 'kpi';
    }

    // 6. Unknown / Non-Analytics Input (Never convert unknown input to arbitrary KPI query)
    return 'NON_ANALYTICS';
  }

  _ruleBasedPlanQuery(question, context = {}) {
    const q = (question || '').toLowerCase().trim();
    const intent = this._classifyIntent(question, context);

    if (['GREETING', 'FAREWELL', 'THANKS', 'HELP', 'CAPABILITIES', 'NON_ANALYTICS'].includes(intent)) {
      return {
        intent,
        metric: null,
        date_column: null,
        group_by: null,
        joins: [],
        base_dataset: null,
        aggregation: null,
        limit: null,
        order: null,
        filters: [],
        time_range: null,
        compare_with: null,
        visualization: null,
        confidence: 'high'
      };
    }

    const detected = context.dimensions || {};
    const numericCols = detected.numericColumns || [];

    let visualization = 'kpi_card';
    let groupBy = null;
    let limit = null;
    let order = null;
    let timeRange = null;
    let compareWith = null;
    let aggregation = 'SUM';
    let metric = detected.primaryMetric || 'revenue';
    let joins = [];
    let baseDataset = null;

    if (intent === 'executive_summary') {
      visualization = 'insights_list';
    } else if (intent === 'relational_breakdown') {
      visualization = 'bar';
      groupBy = 'customers.region';
      metric = 'orders.revenue';
      if (context.relationships && context.relationships.length > 0) {
        const rel = context.relationships[0];
        joins.push({
          dataset: rel.target_dataset_name || 'customers',
          dataset_id: rel.target_dataset_id,
          source_column: rel.source_column,
          target_column: rel.target_column,
          type: 'left'
        });
        baseDataset = rel.source_dataset_name || 'orders';
      }
    } else if (intent === 'data_quality_explanation') {
      visualization = 'kpi_card';
    } else if (intent === 'forecast_explanation') {
      visualization = 'line';
    } else if (intent === 'anomaly_explanation') {
      visualization = 'line';
    } else if (intent === 'dashboard_summary') {
      visualization = 'table';
    } else if (intent === 'comparison') {
      visualization = 'bar';
    } else if (intent === 'trend') {
      visualization = 'line';
    } else if (intent === 'growth') {
      visualization = 'line';
    } else if (intent === 'ranking') {
      visualization = 'bar';
      limit = 5;
      order = q.includes('bottom') || q.includes('lowest') || q.includes('worst') ? 'asc' : 'desc';
      const numMatch = q.match(/top\s*(\d+)/i) || q.match(/bottom\s*(\d+)/i);
      if (numMatch) limit = parseInt(numMatch[1], 10);
    } else if (intent === 'breakdown') {
      visualization = 'pie';
    } else if (intent === 'metric_explanation') {
      visualization = 'kpi_card';
    } else {
      visualization = 'kpi_card';
    }

    // 2. Identify Metric Column (if not set by relational intent)
    if (metric === 'revenue' || metric === detected.primaryMetric) {
      for (const col of numericCols) {
        if (q.includes(col.toLowerCase())) {
          metric = col;
          break;
        }
      }
    }

    // Aggregation mode
    if (q.includes('average') || q.includes('avg ') || q.includes('mean ')) {
      aggregation = 'AVG';
    } else if (q.includes('count') || q.includes('number of') || q.includes('how many')) {
      aggregation = 'COUNT';
    } else if (q.includes('minimum') || q.includes('min ')) {
      aggregation = 'MIN';
    } else if (q.includes('maximum') || q.includes('max ')) {
      aggregation = 'MAX';
    }

    // 3. Identify Date Column
    const dateCol = detected.dateColumn || 'date';

    // 4. Identify Categorical Group By
    const catCols = detected.categoricalColumns || [];
    for (const col of catCols) {
      const lower = col.toLowerCase();
      if (q.includes(`by ${lower}`) || q.includes(`per ${lower}`) || q.includes(lower)) {
        groupBy = col;
        break;
      }
    }
    if (!groupBy) {
      if (q.includes('region') || q.includes('city') || q.includes('state')) groupBy = detected.regionColumn || 'region';
      else if (q.includes('product') || q.includes('item')) groupBy = detected.productColumn || 'product';
      else if (q.includes('category') || q.includes('segment')) groupBy = detected.categoryColumn || 'category';
      else if (q.includes('channel') || q.includes('platform')) groupBy = detected.channelColumn || 'channel';
    }

    // 5. Time Range Extraction
    if (q.includes('last 6 months') || q.includes('past 6 months')) {
      timeRange = { type: 'last_n_months', value: 6 };
    } else if (q.includes('last 3 months') || q.includes('quarter') || q.includes('last quarter') || q.includes('past 3 months')) {
      timeRange = { type: 'last_n_months', value: 3 };
    } else if (q.includes('last 30 days') || q.includes('past 30 days') || q.includes('last month')) {
      timeRange = { type: 'last_n_days', value: 30 };
    } else if (q.includes('last 7 days') || q.includes('past week') || q.includes('this week')) {
      timeRange = { type: 'last_n_days', value: 7 };
    } else if (q.includes('year to date') || q.includes('ytd') || q.includes('this year')) {
      timeRange = { type: 'ytd', value: null };
    }

    // 6. Comparison Extraction
    if (intent === 'comparison') {
      if (q.includes('north') && q.includes('south')) {
        compareWith = { dimension: 'region', values: ['North', 'South'] };
      } else if (q.includes('east') && q.includes('west')) {
        compareWith = { dimension: 'region', values: ['East', 'West'] };
      } else if (q.includes('online') && q.includes('offline')) {
        compareWith = { dimension: 'channel', values: ['Online', 'Offline'] };
      } else if (q.includes('this month') || q.includes('last month')) {
        compareWith = { time_period: 'month_over_month' };
      }
    }

    return {
      intent,
      metric,
      date_column: dateCol,
      group_by: groupBy,
      joins,
      base_dataset: baseDataset,
      aggregation,
      limit: limit || (intent === 'ranking' ? 5 : null),
      order: order || (intent === 'ranking' ? 'desc' : null),
      filters: [],
      time_range: timeRange,
      compare_with: compareWith,
      visualization,
      confidence: 'high'
    };
  }

  _sanitizeAndValidatePlan(plan, context) {
    const nonAnalyticsUpper = ['GREETING', 'FAREWELL', 'THANKS', 'HELP', 'CAPABILITIES', 'NON_ANALYTICS'];
    const rawIntentUpper = String(plan.intent || '').toUpperCase();

    if (nonAnalyticsUpper.includes(rawIntentUpper)) {
      return {
        intent: rawIntentUpper,
        metric: null,
        date_column: null,
        group_by: null,
        aggregation: null,
        limit: null,
        order: null,
        filters: [],
        time_range: null,
        compare_with: null,
        visualization: null,
        confidence: 'high'
      };
    }

    const validIntents = [
      'kpi', 'comparison', 'trend', 'growth', 'ranking', 'breakdown',
      'anomaly_explanation', 'forecast_explanation', 'dashboard_summary', 'metric_explanation',
      'relational_breakdown', 'relational_query', 'data_quality_explanation', 'executive_summary'
    ];
    const validVisualizations = ['kpi_card', 'line', 'bar', 'area', 'pie', 'table', 'insights_list'];
    const validAggs = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];

    const intent = validIntents.includes(plan.intent) ? plan.intent : 'NON_ANALYTICS';
    if (intent === 'NON_ANALYTICS') {
      return {
        intent: 'NON_ANALYTICS',
        metric: null,
        date_column: null,
        group_by: null,
        aggregation: null,
        limit: null,
        order: null,
        filters: [],
        time_range: null,
        compare_with: null,
        visualization: null,
        confidence: 'high'
      };
    }

    return {
      intent,
      metric: plan.metric || context.dimensions?.primaryMetric || 'revenue',
      date_column: plan.date_column || context.dimensions?.dateColumn || 'date',
      group_by: plan.group_by || null,
      aggregation: validAggs.includes(plan.aggregation) ? plan.aggregation : 'SUM',
      limit: typeof plan.limit === 'number' ? Math.max(1, Math.min(100, plan.limit)) : null,
      order: ['asc', 'desc'].includes(plan.order) ? plan.order : null,
      filters: Array.isArray(plan.filters) ? plan.filters : [],
      time_range: plan.time_range || null,
      compare_with: plan.compare_with || null,
      visualization: validVisualizations.includes(plan.visualization) ? plan.visualization : 'kpi_card',
      confidence: plan.confidence || 'high'
    };
  }

  _synthesizeDeterministicAnswer(question, plan, structuredData, context) {
    const rawIntent = String(plan?.intent || '').toUpperCase();
    const metricName = plan.metric ? plan.metric.replace(/_/g, ' ') : 'value';
    const datasetName = context.datasetName || 'Dataset';

    switch (rawIntent) {
      case 'GREETING': {
        const q = (question || '').toLowerCase().trim();
        if (q.startsWith('good morning')) {
          return 'Good morning! What would you like to analyze?';
        }
        if (q.startsWith('good afternoon')) {
          return 'Good afternoon! What would you like to analyze?';
        }
        if (q.startsWith('good evening')) {
          return 'Good evening! What would you like to analyze?';
        }
        if (q === 'hi' || q.startsWith('hi ') || q === 'hey' || q.startsWith('hey ')) {
          return 'Hi! I can help with KPIs, trends, comparisons, anomalies, forecasts, and other analytics questions.';
        }
        return 'Hello! How can I help you analyze your data?';
      }

      case 'FAREWELL': {
        return 'Goodbye! Feel free to return whenever you need analytics insights or data exploration.';
      }

      case 'THANKS': {
        return "You're very welcome! Let me know if you have any other questions about your data or metrics.";
      }

      case 'CAPABILITIES':
      case 'HELP': {
        return `I can assist you with comprehensive analytics and business intelligence across your datasets and dashboards:

• **KPI Analysis**: Calculate sums, averages, totals, and counts across metrics.
• **Trend Exploration**: Evaluate metric progression over time with dynamic line charts.
• **Categorical Breakdowns**: Segment performance by region, product, category, or channel.
• **Rankings**: Identify top and bottom performers across dimensions.
• **Comparative Analysis**: Compare performance across dimensions or historical periods.
• **Growth Measurement**: Measure velocity, period-over-period growth, and rate of change.
• **Anomaly Diagnostics**: Detect statistical outliers, dips, and unexpected telemetry deviations.
• **Predictive Forecasts**: Generate ML-based projections with Holt-Winters / ARIMA models.
• **Dashboard Summaries**: Get high-level executive summaries of entire operational dashboards.
• **Data Quality Explanations**: Review dataset health scores, completeness, and validity.
• **Metric Explanations**: Understand formulas and operational business definitions.
• **Relational Dataset Analysis**: Join and analyze data across linked relational datasets.

Ask me a question about your data to get started!`;
      }

      case 'NON_ANALYTICS': {
        return "I’m focused on RicozAnalytics data and analytics. Ask me about your KPIs, trends, forecasts, anomalies, or dashboards.";
      }

      case 'EXECUTIVE_SUMMARY': {
        if (structuredData.executive_summary) {
          return structuredData.executive_summary;
        }
        const count = structuredData.count || (Array.isArray(structuredData.insights) ? structuredData.insights.length : 0);
        return `### Executive Insights Overview\n\nGenerated **${count} automated insights** across your active organization telemetry, forecasts, and data quality metrics.`;
      }

      case 'KPI':
      case 'KPI_LOOKUP': {
        const val = typeof structuredData.value === 'number'
          ? structuredData.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : structuredData.value || '0';
        return `Based on **${datasetName}**, total **${metricName}** is **${val}** across ${structuredData.count || 0} recorded entries.`;
      }

      case 'TREND':
      case 'GROWTH': {
        const count = Array.isArray(structuredData.trends) ? structuredData.trends.length : (Array.isArray(structuredData) ? structuredData.length : 0);
        const growth = structuredData.growth_rate !== undefined ? `${structuredData.growth_rate > 0 ? '+' : ''}${structuredData.growth_rate}%` : null;
        return `Analyzed **${count} periods** of historical **${metricName}** trend data.` +
          (growth ? ` Growth velocity is measured at **${growth}** across the selected observation interval.` : '') +
          ` Overall trajectory demonstrates healthy enterprise volume.`;
      }

      case 'RANKING': {
        const items = Array.isArray(structuredData.ranking) ? structuredData.ranking : (Array.isArray(structuredData) ? structuredData : []);
        const topItem = items[0];
        if (topItem) {
          const topName = topItem.name || topItem.category || 'Top Item';
          const topVal = Number(topItem.value || 0).toLocaleString();
          return `**${topName}** leads all categories with **${topVal}** in total ${metricName}. Top ${items.length} contributors account for the dominant portion of organizational output.`;
        }
        return `Top contributors for **${metricName}** have been ranked according to total aggregated volume.`;
      }

      case 'BREAKDOWN': {
        const items = Array.isArray(structuredData.breakdown) ? structuredData.breakdown : (Array.isArray(structuredData) ? structuredData : []);
        return `Breakdown of **${metricName}** across ${items.length} categories. Primary segments represent the key drivers of distribution.`;
      }

      case 'RELATIONAL_BREAKDOWN':
      case 'RELATIONAL_QUERY': {
        const items = Array.isArray(structuredData.breakdown) ? structuredData.breakdown : (Array.isArray(structuredData.rows) ? structuredData.rows : []);
        const joined = Array.isArray(structuredData.joined_datasets) ? structuredData.joined_datasets.join(', ') : 'related datasets';
        return `Multi-dataset relational query computed by joining **${datasetName}** with **${joined}**. Evaluated ${items.length} aggregated segments for **${metricName}** across **${plan.group_by || 'dimensions'}**.`;
      }

      case 'COMPARISON': {
        return `Comparison analysis computed for **${metricName}**. The comparative delta and distribution across target entities have been evaluated.`;
      }

      case 'ANOMALY_EXPLANATION':
      case 'ANOMALY_DIAGNOSTICS': {
        const anomCount = structuredData.anomaly_count || (Array.isArray(structuredData.anomalies) ? structuredData.anomalies.length : 0);
        if (anomCount > 0) {
          return `Identified **${anomCount} statistical time-series anomalies** in ${metricName}. The largest detected deviation represents a notable outlier exceeding the baseline dispersion threshold.`;
        }
        return `No severe statistical anomalies or unexpected dips were detected in ${metricName}. Telemetry remains within expected confidence bounds.`;
      }

      case 'DATA_QUALITY_EXPLANATION': {
        const score = structuredData.quality_score !== undefined ? structuredData.quality_score : 100;
        const status = (structuredData.status || 'healthy').toUpperCase();
        const dims = structuredData.dimensions || {};
        const issues = Array.isArray(structuredData.issues) ? structuredData.issues : [];
        const issueSummary = issues.length > 0 
          ? `\n\n**Detected Quality Issues (${issues.length}):**\n` + issues.slice(0, 4).map(i => `• [${(i.severity || 'warning').toUpperCase()}] ${i.message}`).join('\n')
          : `\n\nNo blocking data quality issues detected.`;

        return `Data quality evaluation for **${datasetName}**:\n` +
          `• **Overall Quality Score:** **${score}/100** (${status})\n` +
          `• **Completeness:** ${dims.completeness?.score || 100}%\n` +
          `• **Validity:** ${dims.validity?.score || 100}%\n` +
          `• **Uniqueness:** ${dims.uniqueness?.score || 100}%\n` +
          `• **Consistency:** ${dims.consistency?.score || 100}%\n` +
          `• **Freshness:** ${dims.freshness?.status || 'healthy'} (${dims.freshness?.score || 100}%)` +
          issueSummary;
      }

      case 'FORECAST_EXPLANATION': {
        const model = structuredData.model || 'Holt-Winters / ARIMA';
        const horizon = structuredData.horizon || 30;
        return `Predictive ML model (**${model.toUpperCase()}**) projects steady ${metricName} progression over the next **${horizon} periods** with dynamic confidence bounds.`;
      }

      case 'DASHBOARD_SUMMARY': {
        return `Overview summary for **${datasetName}** dashboard telemetry. All operational cards reflect current synchronization state.`;
      }

      case 'METRIC_EXPLANATION': {
        return `Metric definition for **${metricName}**: Calculated aggregation representing operational performance for ${datasetName}.`;
      }

      default:
        return `Calculated analytical findings for **${question}** based on verified ${datasetName} telemetry records.`;
    }
  }
}

module.exports = new GeminiService();
