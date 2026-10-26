const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const ragKnowledgeService = require('./ragKnowledgeService');
const aiQueryPlannerService = require('./aiQueryPlannerService');
const geminiService = require('./geminiService');
const Dataset = require('../models/datasetModel');
const MetricModel = require('../models/metricModel');
const Dashboard = require('../models/dashboardModel');
const OrganizationModel = require('../models/organizationModel');
const UserModel = require('../models/userModel');

/**
 * LangGraph State Definition
 * Coordinates intent classification, RAG retrieval, deterministic analytics tools, evidence validation, and answer synthesis.
 */
const AssistantState = Annotation.Root({
  message: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => '' }),
  organizationId: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => '' }),
  userId: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => null }),
  userRole: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => 'viewer' }),
  datasetId: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => null }),
  dashboardId: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => null }),
  metricId: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => null }),
  conversationHistory: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => [] }),
  
  // Classification
  intent: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => 'general' }),
  requiresRetrieval: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => false }),
  requiresAnalytics: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => false }),
  requiresWorkspaceContext: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => false }),

  // Authorized Workspace / Account Context
  accountContext: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => null }),

  // Retrieved Knowledge
  retrievedDocs: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => [] }),

  // Analytics Computation
  analyticsResult: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => null }),

  // Evidence Validation & Grounding
  evidenceValidated: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => false }),
  grounded: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => false }),
  insufficientData: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => false }),
  validationMessage: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => '' }),

  // Final Structured Output
  finalAnswer: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => '' }),
  sources: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => [] }),
  visualization: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => null }),
  tableData: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => null }),
  followUpQuestions: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => [] }),
  analysisStatus: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => '' }),
  confidence: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => 'high' }),
  error: Annotation({ reducer: (x, y) => (y !== undefined ? y : x), default: () => null })
});

/**
 * LangGraph Assistant Service
 */
class LangGraphAssistantService {
  constructor() {
    this.graph = this._buildGraph();
  }

  /**
   * Build the StateGraph workflow with conditional routing and validation
   */
  _buildGraph() {
    const workflow = new StateGraph(AssistantState)
      .addNode('classifyIntentNode', this._classifyIntentNode.bind(this))
      .addNode('resolveWorkspaceContextNode', this._resolveWorkspaceContextNode.bind(this))
      .addNode('retrieveKnowledgeNode', this._retrieveKnowledgeNode.bind(this))
      .addNode('executeAnalyticsNode', this._executeAnalyticsNode.bind(this))
      .addNode('validateEvidenceNode', this._validateEvidenceNode.bind(this))
      .addNode('synthesizeAnswerNode', this._synthesizeAnswerNode.bind(this))
      
      .addEdge(START, 'classifyIntentNode')
      .addConditionalEdges(
        'classifyIntentNode',
        (state) => {
          if (state.requiresWorkspaceContext) {
            return 'resolveWorkspaceContextNode';
          }
          if (state.requiresRetrieval) {
            return 'retrieveKnowledgeNode';
          }
          if (state.requiresAnalytics) {
            return 'executeAnalyticsNode';
          }
          return 'synthesizeAnswerNode';
        },
        ['resolveWorkspaceContextNode', 'retrieveKnowledgeNode', 'executeAnalyticsNode', 'synthesizeAnswerNode']
      )
      .addEdge('resolveWorkspaceContextNode', 'validateEvidenceNode')
      .addConditionalEdges(
        'retrieveKnowledgeNode',
        (state) => {
          if (state.requiresAnalytics) {
            return 'executeAnalyticsNode';
          }
          return 'validateEvidenceNode';
        },
        ['executeAnalyticsNode', 'validateEvidenceNode']
      )
      .addEdge('executeAnalyticsNode', 'validateEvidenceNode')
      .addEdge('validateEvidenceNode', 'synthesizeAnswerNode')
      .addEdge('synthesizeAnswerNode', END);

    return workflow.compile();
  }

  /**
   * Node 1: Classify whether user question requires workspace context, analytics, RAG knowledge, or both (hybrid)
   */
  async _classifyIntentNode(state) {
    let rawQ = (state.message || '').trim();

    // 0. Multi-turn context resolution: if current query is contextual, resolve missing metric/dimension
    if (Array.isArray(state.conversationHistory) && state.conversationHistory.length > 0) {
      const qCheck = rawQ.toLowerCase();
      const isContextualFollowUp = [
        'which region', 'what about', 'how about', 'and for', 'show by',
        'why', 'difference', 'compare', 'trend', 'performed best', 'highest', 'best'
      ].some(p => qCheck.startsWith(p) || qCheck.includes(p));

      const lacksMetric = !['revenue', 'sales', 'profit', 'units', 'orders', 'amount', 'churn'].some(m => qCheck.includes(m));

      if (isContextualFollowUp && lacksMetric) {
        // Find last user or assistant query in conversation
        for (let i = state.conversationHistory.length - 1; i >= 0; i--) {
          const prevMsg = state.conversationHistory[i];
          const prevContent = (prevMsg.content || '').toLowerCase();
          if (prevContent.includes('revenue')) {
            rawQ = `${rawQ} (context: revenue)`;
            break;
          } else if (prevContent.includes('sales')) {
            rawQ = `${rawQ} (context: sales)`;
            break;
          }
        }
      }
    }

    const qLower = rawQ.toLowerCase();
    const words = qLower.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(Boolean);
    const cleanQ = words.join(' ');

    // 1. Organization & Workspace context checks (Typo-tolerant: "origination", "organisation", "org", "company", "workspace", "tenant", "enterprise")
    const orgTerms = ['organization', 'organisation', 'origination', 'org', 'company', 'workspace', 'tenant', 'enterprise'];
    const hasOrgTerm = orgTerms.some(t => {
      const regex = new RegExp(`\\b${t}s?\\b`, 'i');
      return regex.test(qLower);
    });
    const isOrgQuery = hasOrgTerm && (
      qLower.includes('name') || qLower.includes('what is') || qLower.includes('who is') ||
      qLower.includes('which') || qLower.includes('my') || qLower.includes('our') ||
      qLower.includes('current') || qLower.includes('tell me') || qLower.includes('show') ||
      qLower.includes('info') || qLower.includes('details') || qLower.includes('plan')
    );

    // 2. User & Profile context checks
    const userPhrases = [
      'who am i', 'what is my name', 'my name', 'my role', 'what is my role',
      'my email', 'what is my email', 'my profile', 'my account', 'current user',
      'logged in as', 'my permissions', 'user details'
    ];
    const isUserQuery = userPhrases.some(p => qLower === p || qLower.includes(p));

    if (isOrgQuery || orgTerms.some(t => cleanQ === t || cleanQ === `my ${t}` || cleanQ === `what is my ${t}`)) {
      return {
        message: rawQ,
        intent: 'ORGANIZATION_CONTEXT',
        requiresWorkspaceContext: true,
        requiresRetrieval: false,
        requiresAnalytics: false,
        analysisStatus: 'Classified as authorized workspace context request'
      };
    }

    if (isUserQuery) {
      return {
        message: rawQ,
        intent: 'USER_CONTEXT',
        requiresWorkspaceContext: true,
        requiresRetrieval: false,
        requiresAnalytics: false,
        analysisStatus: 'Classified as user profile context request'
      };
    }

    // Comprehensive retrieval triggers
    const retrievalKeywords = [
      'contain', 'contains', 'dataset', 'datasets', 'schema', 'schemas',
      'column', 'columns', 'field', 'fields', 'table', 'tables', 'structure', 'metadata',
      'formula', 'definition of', 'business policy', 'policies',
      'benchmark', 'benchmarks', 'churn rate', 'target', 'threshold', 'hhi', 'sla', 'rule', 'rules',
      'dictionary', 'dictionaries', 'what is in', 'what does this dataset'
    ];
    const isRetrievalMatch = retrievalKeywords.some(kw => qLower.includes(kw));

    // Analytical calculation triggers
    const analyticsKeywords = [
      'total', 'how much', 'calculate', 'compare', 'trend', 'highest', 'lowest',
      'current', 'quarter', 'drop', 'growth', 'sum', 'average', 'count',
      'ranking', 'breakdown', 'top', 'bottom', 'sales', 'revenue', 'orders',
      'performed best', 'best', 'leader', 'worst', 'rank', 'region'
    ];
    const isAnalyticsMatch = analyticsKeywords.some(kw => qLower.includes(kw));

    // Explanatory tokens for hybrid intent
    const explanatoryTokens = ['explain', 'why', 'difference', 'what explains', 'driver', 'cause', 'reason'];
    const isExplanatoryMatch = explanatoryTokens.some(tok => qLower.includes(tok));

    // Check fast-path chit-chat
    let rawPlan = null;
    try {
      rawPlan = await geminiService.planQuery(rawQ, {
        datasets: [],
        metrics: [],
        dashboards: [],
        alerts: [],
        forecasts: []
      });
    } catch (_) {
      rawPlan = { intent: 'NON_ANALYTICS', confidence: 'medium' };
    }

    const intent = rawPlan?.intent || 'NON_ANALYTICS';
    const conversationalIntents = ['GREETING', 'FAREWELL', 'THANKS', 'HELP', 'CAPABILITIES'];

    if (conversationalIntents.includes(intent.toUpperCase()) && !isRetrievalMatch && !isAnalyticsMatch) {
      return {
        message: rawQ,
        intent: intent.toUpperCase(),
        requiresWorkspaceContext: false,
        requiresRetrieval: intent.toUpperCase() === 'HELP',
        requiresAnalytics: false,
        analyticsResult: {
          intent: intent.toUpperCase(),
          plan: {
            intent: intent.toUpperCase(),
            metric: null,
            date_column: null,
            group_by: null,
            aggregation: null,
            visualization: null,
            confidence: rawPlan?.confidence || 'high'
          },
          data: {},
          visualization: null,
          sources: []
        },
        analysisStatus: 'Conversational fast path'
      };
    }

    // Explicit knowledge questions take precedence over metric keywords
    const isExplicitKnowledgeQuery = [
      'what is the formula', 'formula for', 'formula of',
      'definition of', 'what is the definition',
      'policy on', 'business policy', 'benchmark for', 'sla for',
      'what does this dataset contain', 'what columns', 'dataset schema',
      'table structure', 'what data is in'
    ].some(p => qLower.includes(p)) ||
    (['meaning of', 'define'].some(p => qLower.includes(p)) && ['metric', 'column', 'kpi', 'sla', 'churn', 'hhi', 'dataset', 'gross margin', 'net revenue', 'policy'].some(k => qLower.includes(k)));

    // Ambiguous / vague single-token inputs without conversation context
    const ambiguousSingleTokens = ['difference', 'why', 'tell me', 'what', 'explain', 'show me', 'details', 'data', 'metrics', 'compare'];
    const isAmbiguousQuery = (words.length <= 2 && ambiguousSingleTokens.includes(cleanQ)) ||
      (!isRetrievalMatch && !isAnalyticsMatch && !isExplicitKnowledgeQuery &&
       !['revenue', 'sales', 'profit', 'units', 'orders', 'region'].some(m => qLower.includes(m)));

    if (isAmbiguousQuery) {
      return {
        message: rawQ,
        intent: 'AMBIGUOUS',
        requiresWorkspaceContext: false,
        requiresRetrieval: false,
        requiresAnalytics: false,
        analysisStatus: 'Clarification requested'
      };
    }

    let resolvedIntent = intent;
    let requiresRetrieval = false;
    let requiresAnalytics = false;

    if (isExplicitKnowledgeQuery && !isExplanatoryMatch && !['highest', 'lowest', 'rank', 'breakdown', 'trend'].some(k => qLower.includes(k))) {
      resolvedIntent = 'knowledge_retrieval';
      requiresRetrieval = true;
      requiresAnalytics = false;
    } else if ((isAnalyticsMatch || ['ranking', 'breakdown', 'kpi', 'trend', 'comparison'].includes(String(resolvedIntent).toLowerCase())) &&
        (isExplanatoryMatch || isRetrievalMatch)) {
      resolvedIntent = 'hybrid';
      requiresRetrieval = true;
      requiresAnalytics = true;
    } else if (isRetrievalMatch && !isAnalyticsMatch) {
      resolvedIntent = 'knowledge_retrieval';
      requiresRetrieval = true;
      requiresAnalytics = false;
    } else {
      resolvedIntent = resolvedIntent && !conversationalIntents.includes(resolvedIntent.toUpperCase())
        ? resolvedIntent
        : 'analytics';
      requiresAnalytics = true;
      requiresRetrieval = false;
    }

    return {
      message: rawQ,
      intent: resolvedIntent,
      requiresRetrieval,
      requiresAnalytics,
      analysisStatus: `Classified as ${resolvedIntent} (Retrieval: ${requiresRetrieval}, Analytics: ${requiresAnalytics})`
    };
  }

  /**
   * Node: Resolve authorized workspace context (organization name, plan, user role, user profile)
   * Strictly tenant-isolated: only reads authenticated organizationId and userId.
   */
  async _resolveWorkspaceContextNode(state) {
    try {
      let org = null;
      let user = null;

      if (state.organizationId) {
        org = await OrganizationModel.findById(state.organizationId);
      }

      if (state.userId) {
        user = await UserModel.findById(state.userId);
        if (user && user.organization_id && state.organizationId && user.organization_id !== state.organizationId) {
          console.warn('[LangGraph] Cross-tenant security violation: User organization mismatch');
          user = null;
        }
      }

      return {
        accountContext: {
          organization: org ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
            plan: org.plan,
            subscription_status: org.subscription_status
          } : null,
          user: user ? {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          } : null
        },
        analysisStatus: org ? `Resolved workspace context (${org.name})` : 'Workspace context completed'
      };
    } catch (err) {
      console.warn('[LangGraph] Workspace context resolution error:', err.message);
      return {
        accountContext: { organization: null, user: null },
        error: err.message,
        analysisStatus: 'Workspace context resolution error'
      };
    }
  }

  /**
   * Node 2: Retrieve relevant knowledge using tenant-isolated pgvector cosine similarity
   */
  async _retrieveKnowledgeNode(state) {
    try {
      // 1. Sync knowledge to ensure latest metrics & policies exist
      await ragKnowledgeService.syncOrganizationKnowledge(state.organizationId).catch(() => null);

      // 2. Perform tenant-isolated vector search with dataset context
      const docs = await ragKnowledgeService.searchKnowledge(state.message, {
        organizationId: state.organizationId,
        datasetId: state.datasetId,
        limit: 3,
        minSimilarity: 0.12
      });

      return {
        retrievedDocs: docs,
        analysisStatus: docs.length > 0
          ? `Retrieved ${docs.length} knowledge source(s) via pgvector semantic search`
          : 'Queried enterprise knowledge base (no exact match found)'
      };
    } catch (err) {
      console.warn('[LangGraph] Knowledge retrieval error:', err.message);
      return {
        retrievedDocs: [],
        analysisStatus: 'Knowledge retrieval encountered an issue, proceeding with available data'
      };
    }
  }

  /**
   * Node 3: Execute authorized analytics tools for exact numerical calculations
   */
  async _executeAnalyticsNode(state) {
    try {
      const result = await aiQueryPlannerService.processQuery({
        message: state.message,
        organizationId: state.organizationId,
        userId: state.userId,
        userRole: state.userRole,
        datasetId: state.datasetId,
        dashboardId: state.dashboardId,
        metricId: state.metricId
      });

      return {
        analyticsResult: result,
        analysisStatus: `Computed verified analytics across dataset records`
      };
    } catch (err) {
      console.warn('[LangGraph] Analytics tool execution error:', err.message);
      return {
        analyticsResult: null,
        error: err.message,
        analysisStatus: `Analytics execution error: ${err.message}`
      };
    }
  }

  /**
   * Node 4: Validate returned data and evidence
   * Verifies that retrieval and analytics results are authentic, grounded, and within schema limitations.
   */
  async _validateEvidenceNode(state) {
    const {
      requiresRetrieval,
      requiresAnalytics,
      requiresWorkspaceContext,
      retrievedDocs = [],
      analyticsResult,
      accountContext,
      error,
      message,
      intent
    } = state;
    
    let evidenceValidated = false;
    let grounded = false;
    let insufficientData = false;
    let validationMessage = '';

    const conversational = ['GREETING', 'FAREWELL', 'THANKS', 'HELP', 'CAPABILITIES'];
    if (conversational.includes(String(intent).toUpperCase())) {
      return {
        evidenceValidated: false,
        grounded: false,
        insufficientData: false,
        validationMessage: 'Conversational response'
      };
    }

    if (String(intent).toUpperCase() === 'AMBIGUOUS' || String(intent).toUpperCase() === 'NON_ANALYTICS') {
      return {
        evidenceValidated: false,
        grounded: false,
        insufficientData: false,
        validationMessage: 'Awaiting clarification'
      };
    }

    // Workspace & Account Context validation
    if (requiresWorkspaceContext || ['ORGANIZATION_CONTEXT', 'USER_CONTEXT'].includes(String(intent).toUpperCase())) {
      const org = accountContext?.organization;
      const user = accountContext?.user;

      if (String(intent).toUpperCase() === 'ORGANIZATION_CONTEXT') {
        if (org && org.name) {
          return {
            evidenceValidated: true,
            grounded: true,
            insufficientData: false,
            validationMessage: `Verified against authenticated workspace session (${org.name})`
          };
        } else {
          return {
            evidenceValidated: false,
            grounded: false,
            insufficientData: true,
            validationMessage: 'Organization context is unavailable for this session.'
          };
        }
      }

      if (String(intent).toUpperCase() === 'USER_CONTEXT') {
        if (user && (user.name || user.email)) {
          return {
            evidenceValidated: true,
            grounded: true,
            insufficientData: false,
            validationMessage: `Verified against authenticated user session (${user.email || user.name})`
          };
        } else {
          return {
            evidenceValidated: false,
            grounded: false,
            insufficientData: true,
            validationMessage: 'User profile context is unavailable for this session.'
          };
        }
      }
    }

    // Check Analytics execution validity
    let analyticsValid = false;
    if (requiresAnalytics) {
      if (error) {
        analyticsValid = false;
        insufficientData = true;
        validationMessage = `Analytics computation failed: ${error}`;
      } else if (analyticsResult) {
        const rowCount = analyticsResult.sources?.[0]?.row_count;
        const data = analyticsResult.data || {};

        if (rowCount === 0 || rowCount === undefined) {
          insufficientData = true;
          analyticsValid = false;
          validationMessage = 'Selected dataset contains 0 records or physical file is unavailable.';
        } else if (data.insufficient_data || analyticsResult.insufficientData) {
          insufficientData = true;
          analyticsValid = false;
          validationMessage = 'Required metric or dimension columns are missing in the selected dataset.';
        } else if (Object.keys(data).length === 0 && !analyticsResult.answer) {
          insufficientData = true;
          analyticsValid = false;
          validationMessage = 'No analytical records match requested criteria.';
        } else {
          // Intent-specific checks: for ranking queries, ensure identifiable top performer exists with value > 0
          const qLower = (message || '').toLowerCase();
          const isRankingQuery = String(intent).toLowerCase().includes('ranking') ||
            ['highest', 'lowest', 'rank', 'ranking', 'top', 'performed best'].some(k => qLower.includes(k));

          if (isRankingQuery) {
            const rankingList = Array.isArray(data.ranking) ? data.ranking : (Array.isArray(data.breakdown) ? data.breakdown : []);
            const topPerformer = data.top_performer || rankingList[0];

            if (!topPerformer || !topPerformer.name || Number(topPerformer.value || 0) <= 0) {
              analyticsValid = false;
              insufficientData = true;
              validationMessage = 'Ranking requires identifiable categories with measurable values, but none were found.';
            } else {
              analyticsValid = true;
              validationMessage = `Validated across ${Number(rowCount || 0).toLocaleString()} dataset records (Leader: ${topPerformer.name})`;
            }
          } else {
            analyticsValid = true;
            validationMessage = `Validated across ${Number(rowCount || 0).toLocaleString()} dataset records`;
          }
        }
      }
    }

    // Check Retrieval validity
    let retrievalValid = false;
    if (requiresRetrieval) {
      const validDocs = (retrievedDocs || []).filter(d => (d.similarity || 0) >= 0.10);
      if (validDocs.length > 0) {
        retrievalValid = true;
        validationMessage = validationMessage
          ? `${validationMessage} & verified against ${validDocs.length} knowledge source(s)`
          : `Validated against ${validDocs.length} knowledge source(s)`;
      } else {
        retrievalValid = false;
        if (!requiresAnalytics) {
          insufficientData = true;
          validationMessage = 'No relevant enterprise knowledge found for query.';
        }
      }
    }

    // Determine Grounding status based on intent
    if (intent === 'hybrid') {
      grounded = analyticsValid && !insufficientData;
      evidenceValidated = analyticsValid && !insufficientData;
    } else if (intent === 'knowledge_retrieval') {
      grounded = retrievalValid && !insufficientData;
      evidenceValidated = retrievalValid && !insufficientData;
    } else if (requiresAnalytics) {
      grounded = analyticsValid && !insufficientData;
      evidenceValidated = grounded;
    } else {
      grounded = false;
      evidenceValidated = false;
    }

    return {
      evidenceValidated,
      grounded,
      insufficientData,
      validationMessage
    };
  }

  /**
   * Helper: Synthesize structured 5-part ranking answer
   */
  _synthesizeRankingAnswer({
    analyticsResult,
    retrievedDocs = [],
    message = '',
    isHybrid = false
  }) {
    const data = analyticsResult?.data || {};
    const ranking = Array.isArray(data.ranking) ? data.ranking : (Array.isArray(data.breakdown) ? data.breakdown : []);
    const topPerformer = data.top_performer || (ranking.length > 0 ? {
      name: ranking[0].name || ranking[0].category,
      value: ranking[0].value,
      share: ranking[0].percentage
    } : null);
    const runnerUp = data.runner_up || (ranking.length > 1 ? {
      name: ranking[1].name || ranking[1].category,
      value: ranking[1].value,
      share: ranking[1].percentage
    } : null);
    const difference = data.difference;
    const winningDrivers = data.winning_drivers || [];
    const dimensionName = (data.dimension || 'Region').charAt(0).toUpperCase() + (data.dimension || 'Region').slice(1);
    const userAsksRevenue = (message || '').toLowerCase().includes('revenue');
    const metricName = userAsksRevenue ? 'revenue' : (data.metric || 'Revenue').replace(/_/g, ' ');
    const isCurrency = ['revenue', 'sales', 'sales_amount', 'amount', 'profit'].some(m => metricName.toLowerCase().includes(m));
    const datasetSource = analyticsResult?.sources?.[0];
    const datasetName = datasetSource?.dataset_name || 'Selected dataset';
    const rowCount = datasetSource?.row_count || 0;

    const formatVal = (v) => {
      if (typeof v !== 'number') return String(v || 0);
      const str = v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return isCurrency ? `₹${str}` : v.toLocaleString('en-IN');
    };

    if (!topPerformer || Number(topPerformer.value || 0) <= 0) {
      return `The selected dataset does not contain sufficient positive values for **${metricName}** across ${dimensionName.toLowerCase()}s to establish a ranking.`;
    }

    // 1. Direct answer
    const topShareStr = topPerformer.share ? ` (${topPerformer.share}% of total)` : '';
    const directAnswer = `**${topPerformer.name}** has the highest ${metricName} with **${formatVal(topPerformer.value)}**${topShareStr}.`;

    // 2. Comparison Table
    let comparison = `| ${dimensionName} | ${metricName.charAt(0).toUpperCase() + metricName.slice(1)} | Share of Total |\n| :--- | :--- | :--- |\n`;
    ranking.forEach(r => {
      const name = r.name || r.category || 'Unknown';
      const val = formatVal(r.value);
      const share = r.percentage ? `${r.percentage}%` : '—';
      comparison += `| ${name} | ${val} | ${share} |\n`;
    });

    // 3. Difference
    let diffSection = '';
    if (difference && runnerUp) {
      diffSection = `**${difference.leader}** leads second-place **${difference.runnerUp}** (${formatVal(runnerUp.value)}) by **${formatVal(difference.absoluteDifference)}** (+${difference.percentageDifference}% higher).`;
    } else if (runnerUp) {
      const absDiff = Number((topPerformer.value - runnerUp.value).toFixed(2));
      const pctDiff = runnerUp.value > 0 ? Number((((topPerformer.value - runnerUp.value) / runnerUp.value) * 100).toFixed(1)) : 0;
      diffSection = `**${topPerformer.name}** leads second-place **${runnerUp.name}** (${formatVal(runnerUp.value)}) by **${formatVal(absDiff)}** (+${pctDiff}% higher).`;
    } else {
      diffSection = `No secondary ${dimensionName.toLowerCase()} is present in the dataset for comparative lead calculation.`;
    }

    // 4. Explanation
    let explanationSection = '';
    if (winningDrivers.length > 0) {
      const topDrivers = winningDrivers.slice(0, 2);
      const driverList = topDrivers.map(d => `**${d.name || d.category}** (${formatVal(d.value)})`).join(' and ');
      const driverTotal = topDrivers.reduce((sum, d) => sum + (d.value || 0), 0);
      const driverShare = topPerformer.value > 0 ? ((driverTotal / topPerformer.value) * 100).toFixed(1) : 0;
      explanationSection = `Within ${topPerformer.name}, revenue was concentrated in ${driverList}, accounting for ${driverShare}% of regional sales.`;
    }

    const topDoc = retrievedDocs && retrievedDocs.length > 0 ? retrievedDocs[0] : null;
    if (topDoc && isHybrid) {
      if (explanationSection) {
        explanationSection += ` In addition, ${topDoc.title} notes: "${topDoc.content.slice(0, 160).trim()}..."`;
      } else {
        explanationSection = `According to **${topDoc.title}**: "${topDoc.content.slice(0, 160).trim()}..."`;
      }
    }

    if (!explanationSection) {
      explanationSection = `The dataset records show transactional totals by ${dimensionName.toLowerCase()}, but do not contain external causal factors (such as regional headcount, market territory size, or customer acquisition spend) explaining customer demand variations.`;
    } else {
      explanationSection += ` The dataset does not track macro market factors (e.g. territorial marketing budgets) that might further explain regional demand.`;
    }

    // 5. Source
    let sourceSection = `**${datasetName}** (${rowCount.toLocaleString()} verified records)`;
    if (topDoc) {
      sourceSection += ` and **${topDoc.title}**`;
    }

    return `**Direct answer:** ${directAnswer}

**Comparison:**
${comparison}
**Difference:** ${diffSection}

**Explanation:** ${explanationSection}

**Source:** ${sourceSection}.`;
  }

  /**
   * Node 5: Synthesize grounded response with citations, tables, and context follow-ups
   */
  async _synthesizeAnswerNode(state) {
    const {
      intent,
      retrievedDocs = [],
      analyticsResult,
      error,
      message,
      grounded = false,
      evidenceValidated = false,
      insufficientData = false
    } = state;

    // 1. Workspace Organization Context
    if (String(intent).toUpperCase() === 'ORGANIZATION_CONTEXT') {
      const org = state.accountContext?.organization;
      if (org && org.name) {
        return {
          finalAnswer: `Your authorized workspace organization is **${org.name}**${org.plan ? ` (Plan: **${org.plan.toUpperCase()}**)` : ''}.`,
          sources: [{
            title: org.name,
            document_type: 'workspace_organization',
            plan: org.plan || 'starter',
            type: 'workspace_context'
          }],
          grounded: true,
          evidenceValidated: true,
          insufficientData: false,
          followUpQuestions: [
            'What datasets are available in this organization?',
            'What was our total revenue?',
            'Which region performed best?'
          ],
          analysisStatus: `Verified against workspace session (${org.name})`
        };
      } else {
        return {
          finalAnswer: 'Unable to resolve your organization name from the current workspace session. Please verify that your workspace session is active and authenticated.',
          sources: [],
          grounded: false,
          evidenceValidated: false,
          insufficientData: true,
          followUpQuestions: [
            'What datasets are available?',
            'Who am I logged in as?'
          ],
          analysisStatus: 'Organization context unavailable'
        };
      }
    }

    // 2. User & Profile Context
    if (String(intent).toUpperCase() === 'USER_CONTEXT') {
      const user = state.accountContext?.user;
      if (user && (user.name || user.email)) {
        return {
          finalAnswer: `You are currently logged in as **${user.name || 'User'}** (${user.email || 'N/A'}) with the role of **${(user.role || 'viewer').toUpperCase()}**.`,
          sources: [{
            title: user.name || user.email,
            document_type: 'user_profile',
            role: user.role || 'viewer',
            type: 'workspace_context'
          }],
          grounded: true,
          evidenceValidated: true,
          insufficientData: false,
          followUpQuestions: [
            'What is my organization name?',
            'What datasets can I access?',
            'What was our total revenue?'
          ],
          analysisStatus: `Verified against user profile (${user.email || user.name})`
        };
      } else {
        return {
          finalAnswer: 'Unable to resolve your user account details from the current workspace session.',
          sources: [],
          grounded: false,
          evidenceValidated: false,
          insufficientData: true,
          followUpQuestions: [
            'What is my organization name?',
            'What datasets are available?'
          ],
          analysisStatus: 'User profile unavailable'
        };
      }
    }

    // 3. Ambiguous / Unclear Queries (Ask for useful clarification)
    if (String(intent).toUpperCase() === 'AMBIGUOUS' || String(intent).toUpperCase() === 'NON_ANALYTICS') {
      return {
        finalAnswer: "Could you please clarify what you'd like to analyze? For example, you can ask for total revenue, regional breakdown, top performers, sales trends, or workspace details.",
        sources: [],
        grounded: false,
        evidenceValidated: false,
        insufficientData: false,
        followUpQuestions: [
          'What is my organization name?',
          'What was our total revenue?',
          'Which region has the highest revenue?'
        ],
        analysisStatus: 'Awaiting clarification'
      };
    }

    // 4. Conversational Fast Path (Greetings, Farewell, Thanks, Help, Capabilities)
    const conversational = ['GREETING', 'FAREWELL', 'THANKS', 'HELP', 'CAPABILITIES'];
    if (conversational.includes(String(intent).toUpperCase())) {
      const answer = await geminiService.explainResults(message, { intent: String(intent).toUpperCase() }, {}, {});
      return {
        finalAnswer: answer,
        sources: [],
        grounded: false,
        evidenceValidated: false,
        insufficientData: false,
        followUpQuestions: [
          'What is my organization name?',
          'What was our total revenue?',
          'Which region performed best?'
        ],
        analysisStatus: 'Conversational response'
      };
    }

    // 5. Handle Errors and Insufficient Data honestly
    if (error && !analyticsResult && retrievedDocs.length === 0) {
      return {
        finalAnswer: `I encountered an issue processing your question: ${error}. Please verify that the dataset is connected and contains comparative observations.`,
        sources: [],
        grounded: false,
        evidenceValidated: false,
        insufficientData: true,
        followUpQuestions: [
          'What datasets are available?',
          'What metrics are defined in the workspace?'
        ],
        analysisStatus: 'Error encountered'
      };
    }

    if (insufficientData) {
      return {
        finalAnswer: `The selected dataset does not contain sufficient records or matching columns to answer "${message}". Please choose a dataset with verified transactional records or check the available column definitions.`,
        sources: [],
        grounded: false,
        evidenceValidated: false,
        insufficientData: true,
        followUpQuestions: [
          'What does this dataset contain?',
          'What metrics are available?'
        ],
        analysisStatus: 'Insufficient dataset records'
      };
    }

    // 6. Assemble Sources
    const sources = [];
    if (retrievedDocs && retrievedDocs.length > 0) {
      retrievedDocs.forEach(d => {
        sources.push({
          title: d.title,
          document_type: d.document_type,
          similarity: d.similarity,
          snippet: d.content ? d.content.substring(0, 150) : '',
          type: 'rag_document'
        });
      });
    }

    if (analyticsResult?.sources && Array.isArray(analyticsResult.sources)) {
      analyticsResult.sources.forEach(s => {
        sources.push({
          title: s.dataset_name || 'Dataset telemetry',
          document_type: 'physical_dataset',
          row_count: s.row_count || 0,
          type: 'dataset'
        });
      });
    }

    // 7. Formulate Answer & Synthesis
    let finalAnswer = '';
    let visualization = analyticsResult?.visualization || null;
    let tableData = null;

    const qLower = (message || '').toLowerCase();
    const isRankingIntent = String(intent).toLowerCase().includes('ranking') ||
      Boolean(analyticsResult?.data?.ranking) ||
      ['highest', 'lowest', 'rank', 'ranking', 'top', 'performed best'].some(k => qLower.includes(k));

    if (isRankingIntent && analyticsResult?.data && (analyticsResult.data.ranking || analyticsResult.data.top_performer)) {
      // 5-part ranking answer structure
      finalAnswer = this._synthesizeRankingAnswer({
        analyticsResult,
        retrievedDocs,
        message,
        isHybrid: intent === 'hybrid'
      });
    } else if (intent === 'knowledge_retrieval' || (retrievedDocs.length > 0 && !analyticsResult)) {
      // Pure RAG response
      const topDoc = retrievedDocs[0];
      const isDatasetSpecific = topDoc.document_type === 'dataset_dictionary' ||
        ['contain', 'contains', 'dataset', 'column', 'schema', 'structure'].some(k => qLower.includes(k));

      if (isDatasetSpecific) {
        finalAnswer = `### ${topDoc.title}\n\n${topDoc.content}`;
      } else {
        finalAnswer = `### ${topDoc.title}\n\n${topDoc.content}`;
        if (retrievedDocs.length > 1) {
          finalAnswer += `\n\n**Additional Knowledge Context:**\n`;
          for (let i = 1; i < retrievedDocs.length; i++) {
            finalAnswer += `• **${retrievedDocs[i].title}**: ${retrievedDocs[i].content}\n`;
          }
        }
      }
    } else if (intent === 'hybrid') {
      const topDoc = retrievedDocs[0];
      const analyticsText = analyticsResult?.answer || 'Calculated metrics based on current physical telemetry.';
      let explanationContext = topDoc ? `According to **${topDoc.title}**:\n> ${topDoc.content}` : '';
      finalAnswer = `### Validated Analytics Observation\n${analyticsText}\n\n### Grounded Business Context & Explanation\n${explanationContext}`;
    } else {
      finalAnswer = analyticsResult?.answer || 'Analysis complete.';
    }

    // Extract tableData for frontend display
    if (analyticsResult?.data) {
      const data = analyticsResult.data;
      const dimName = (data.dimension || 'Category').charAt(0).toUpperCase() + (data.dimension || 'Category').slice(1);
      const metName = (data.metric || 'Value').replace(/_/g, ' ');
      const userAsksRevenue = (message || '').toLowerCase().includes('revenue');
      const metLabel = userAsksRevenue ? 'Revenue' : (metName.charAt(0).toUpperCase() + metName.slice(1));
      const isCurr = ['revenue', 'sales', 'sales_amount', 'amount', 'profit'].some(m => metName.toLowerCase().includes(m));
      const fmt = (v) => isCurr ? `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : Number(v || 0).toLocaleString('en-IN');

      if (Array.isArray(data.ranking) && data.ranking.length > 0) {
        tableData = {
          headers: [dimName, metLabel, 'Share of Total'],
          rows: data.ranking.map(r => [
            r.name || r.category || 'Item',
            fmt(r.value),
            r.percentage ? `${r.percentage}%` : '—'
          ])
        };
      } else if (Array.isArray(data.breakdown) && data.breakdown.length > 0) {
        tableData = {
          headers: ['Segment', 'Amount', 'Contribution'],
          rows: data.breakdown.map(b => [
            b.name || b.category || 'Slice',
            fmt(b.value),
            b.percentage ? `${b.percentage}%` : '—'
          ])
        };
      }
    }

    // 5. Context-Aware Follow-Up Questions (Dynamic & Relevant)
    const followUpQuestions = this._generateFollowUpQuestions(message, intent, analyticsResult, retrievedDocs);

    // 6. Concise Analysis Status
    const docCount = retrievedDocs.length;
    const rowsCount = analyticsResult?.sources?.[0]?.row_count || 0;
    let analysisStatus = 'Analysis complete';

    if (docCount > 0 && rowsCount > 0) {
      analysisStatus = `Retrieved ${docCount} knowledge document(s) & computed across ${Number(rowsCount).toLocaleString()} physical records`;
    } else if (docCount > 0) {
      analysisStatus = `Retrieved ${docCount} knowledge document(s) via pgvector semantic search`;
    } else if (rowsCount > 0) {
      analysisStatus = `Computed exact aggregation from ${Number(rowsCount).toLocaleString()} dataset records`;
    }

    return {
      finalAnswer,
      sources,
      visualization,
      tableData,
      followUpQuestions,
      analysisStatus,
      grounded,
      evidenceValidated,
      insufficientData,
      confidence: analyticsResult?.confidence || 'high'
    };
  }

  /**
   * Generate 2-3 highly relevant follow-up questions based on query and results
   */
  _generateFollowUpQuestions(query, intent, analyticsResult, retrievedDocs) {
    const q = (query || '').toLowerCase();

    if (q.includes('origination') || q.includes('organization') || q.includes('organisation') || q.includes('workspace') || q.includes('company')) {
      return [
        'What datasets are available in this organization?',
        'What is our total revenue?',
        'Which region has the highest revenue?'
      ];
    }
    if (q.includes('who am i') || q.includes('my role') || q.includes('my account') || q.includes('my email')) {
      return [
        'What is my organization name?',
        'What datasets can I access?',
        'What was our total revenue?'
      ];
    }

    if (q.includes('contain') || q.includes('dataset') || q.includes('schema') || q.includes('column')) {
      return [
        'What is the total revenue in this dataset?',
        'Which region has the highest revenue?',
        'Show sales trend for last 6 months'
      ];
    }
    if (q.includes('revenue') || q.includes('sales')) {
      return [
        'Which region has the highest revenue?',
        'Compare this month with last month',
        'What is our policy on Gross Revenue vs Net Revenue?'
      ];
    }
    if (q.includes('region') || q.includes('state')) {
      return [
        'What was the total revenue across all regions?',
        'Show sales trend for last 6 months',
        'Which product category performs best in top regions?'
      ];
    }
    if (q.includes('product')) {
      return [
        'What is the top 5 product ranking by revenue?',
        'Show quarterly revenue growth',
        'Are there any inventory or supply bottlenecks?'
      ];
    }
    if (q.includes('formula') || q.includes('policy') || q.includes('definition')) {
      return [
        'What was our total revenue calculated with this formula?',
        'What are the operational performance thresholds & SLAs?',
        'Show the churn rate and customer lifetime value benchmarks'
      ];
    }
    if (q.includes('drop') || q.includes('decrease') || q.includes('anomal')) {
      return [
        'Which segment was the primary detractor?',
        'What should we check next regarding this drop?',
        'Compare performance against the previous period'
      ];
    }

    return [
      'What was our total revenue?',
      'Which region performed best?',
      'Show revenue trend for last 6 months'
    ];
  }

  /**
   * Main entrypoint to process query through LangGraph
   */
  async processQuery({
    message,
    organizationId,
    userId,
    userRole = 'viewer',
    datasetId = null,
    dashboardId = null,
    metricId = null,
    conversationHistory = []
  }) {
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error('Query message cannot be empty.');
    }

    const initialState = {
      message: message.trim(),
      organizationId,
      userId,
      userRole,
      datasetId,
      dashboardId,
      metricId,
      conversationHistory
    };

    const finalState = await this.graph.invoke(initialState);

    if (finalState.error && (finalState.error.includes('permission') || finalState.error.includes('access') || finalState.error.includes('not found'))) {
      throw new Error(finalState.error);
    }

    const resolvedIntent = (finalState.intent === 'hybrid' || finalState.intent === 'knowledge_retrieval')
      ? finalState.intent
      : (finalState.analyticsResult?.intent || finalState.intent);
    const resolvedPlan = finalState.analyticsResult?.plan || {
      intent: resolvedIntent,
      metric: null,
      date_column: null,
      group_by: null,
      aggregation: null,
      visualization: null,
      confidence: finalState.confidence || 'high'
    };

    return {
      question: message.trim(),
      answer: finalState.finalAnswer,
      intent: resolvedIntent,
      plan: resolvedPlan,
      data: finalState.analyticsResult?.data || {},
      visualization: finalState.visualization,
      tableData: finalState.tableData,
      sources: finalState.sources,
      followUpQuestions: finalState.followUpQuestions,
      analysisStatus: finalState.analysisStatus,
      confidence: finalState.confidence,
      grounded: finalState.grounded,
      evidenceValidated: finalState.evidenceValidated,
      insufficientData: finalState.insufficientData
    };
  }
}

module.exports = new LangGraphAssistantService();
