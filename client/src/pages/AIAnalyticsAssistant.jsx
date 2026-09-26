import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Trash2,
  Plus,
  RefreshCw,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Table2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ChevronRight,
  Database,
  Layers,
  HelpCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  ShieldCheck,
  LineChart as LineChartIcon,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  queryAI,
  getAIConversations,
  getAIConversationById,
  createAIConversation,
  deleteAIConversation,
  clearAIConversations,
  getDatasets,
  getDashboards,
  getMetrics
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const PIE_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DB2777', '#0891B2', '#4B5563'];

const SUGGESTED_QUERIES = [
  { text: 'Show revenue trend for the last 6 months', intent: 'trend', icon: TrendingUp },
  { text: 'Which region has the highest revenue?', intent: 'ranking', icon: BarChart3 },
  { text: 'Compare this month with last month', intent: 'comparison', icon: Layers },
  { text: 'Explain the biggest anomaly in data', intent: 'anomaly', icon: AlertTriangle },
  { text: 'What is total revenue and average order value?', intent: 'kpi', icon: Zap },
  { text: 'What does the forecast predict for next month?', intent: 'forecast', icon: Sparkles }
];

const INTENT_BADGES = {
  kpi: 'bg-blue-50 text-blue-700 border-blue-200',
  trend: 'bg-purple-50 text-purple-700 border-purple-200',
  growth: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ranking: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  breakdown: 'bg-amber-50 text-amber-700 border-amber-200',
  comparison: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  anomaly_explanation: 'bg-rose-50 text-rose-700 border-rose-200',
  forecast_explanation: 'bg-violet-50 text-violet-700 border-violet-200',
  dashboard_summary: 'bg-slate-100 text-slate-700 border-slate-200',
  metric_explanation: 'bg-teal-50 text-teal-700 border-teal-200',
  greeting: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  farewell: 'bg-slate-100 text-slate-700 border-slate-200',
  thanks: 'bg-blue-50 text-blue-700 border-blue-200',
  help: 'bg-amber-50 text-amber-700 border-amber-200',
  capabilities: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  non_analytics: 'bg-slate-100 text-slate-600 border-slate-200'
};

export default function AIAnalyticsAssistant() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load datasets and conversation history on mount
  const loadInitialData = useCallback(async () => {
    try {
      setLoadingHistory(true);
      setError(null);

      const [datasetsRes, convsRes] = await Promise.all([
        getDatasets().catch(() => ({ data: [] })),
        getAIConversations().catch(() => ({ data: [] }))
      ]);

      const dsList = datasetsRes.data || [];
      const convList = convsRes.data || [];

      setDatasets(dsList);
      if (dsList.length > 0) {
        setSelectedDatasetId(String(dsList[0].id));
      }

      setConversations(convList);

      if (convList.length > 0) {
        const latest = convList[0];
        setActiveConversationId(latest.id);
        loadConversationMessages(latest.id);
      }
    } catch (err) {
      console.error('Failed to load AI Assistant initial data:', err);
      setError('Could not load conversation history.');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load specific conversation messages
  const loadConversationMessages = async (convId) => {
    try {
      const res = await getAIConversationById(convId);
      if (res && res.data && Array.isArray(res.data.messages)) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    }
  };

  // Start a new conversation
  const handleNewChat = async () => {
    try {
      const newConv = await createAIConversation({
        title: 'New AI Analytics Conversation',
        datasetId: selectedDatasetId || null
      });

      if (newConv && newConv.data) {
        setConversations(prev => [newConv.data, ...prev]);
        setActiveConversationId(newConv.data.id);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error creating new conversation:', err);
      setActiveConversationId(null);
      setMessages([]);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (convId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this conversation thread?')) return;

    try {
      await deleteAIConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) {
        const remaining = conversations.filter(c => c.id !== convId);
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
          loadConversationMessages(remaining[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  // Submit Query
  const handleSendQuery = async (queryText = null) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || loading) return;

    setInputQuery('');
    setError(null);

    // Optimistically append user message
    const tempUserMsg = {
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const response = await queryAI({
        message: textToSend,
        datasetId: selectedDatasetId || null,
        conversationId: activeConversationId || null
      });

      if (response && response.success && response.data) {
        const aiData = response.data;
        const newAssistantMsg = {
          role: 'assistant',
          content: aiData.answer,
          intent: aiData.intent,
          query_plan: aiData.plan,
          data: aiData.data,
          visualization: aiData.visualization,
          sources: aiData.sources,
          confidence: aiData.confidence,
          created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, newAssistantMsg]);

        // Update active conversation ID if newly created
        if (response.conversationId && response.conversationId !== activeConversationId) {
          setActiveConversationId(response.conversationId);
          // Refresh conversation list
          const updatedConvs = await getAIConversations().catch(() => ({ data: [] }));
          setConversations(updatedConvs.data || []);
        }
      } else {
        throw new Error(response?.message || 'Assistant could not generate a response.');
      }
    } catch (err) {
      console.error('Query error:', err);
      const errMsg = {
        role: 'assistant',
        content: `I encountered an issue processing your request: ${err.message || 'Please check your dataset connection.'}`,
        isError: true,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Render Visualizations in Assistant Bubble
  const renderVisualization = (msg) => {
    const viz = msg.visualization;
    const data = msg.data;
    if (!viz || !viz.type) return null;

    switch (viz.type) {
      case 'kpi_card': {
        const val = typeof viz.value === 'number'
          ? viz.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : viz.value;
        const comparison = viz.comparison;

        return (
          <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                {viz.metric ? viz.metric.replace(/_/g, ' ') : 'Calculated KPI'}
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                {viz.unit ? `${viz.unit} ` : ''}{val}
              </div>
            </div>
            {comparison && (
              <div className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 ${
                comparison.isSalesPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {comparison.isSalesPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                <span>{comparison.salesChange}</span>
              </div>
            )}
          </div>
        );
      }

      case 'line': {
        const chartData = viz.data || (data?.trends) || [];
        if (!chartData || chartData.length === 0) return null;

        return (
          <div className="mt-3 p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-blue-600" />
              <span>{viz.title || 'Time-Series Trend'}</span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} minTickGap={20} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '11px' }}
                  />
                  <Line type="monotone" dataKey={viz.yAxis || 'revenue'} stroke="#2563EB" strokeWidth={2.5} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      case 'bar': {
        const barData = viz.data || (data?.ranking) || (data?.comparison_items) || [];
        if (!barData || barData.length === 0) return null;

        return (
          <div className="mt-3 p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <span>{viz.title || 'Ranking Breakdown'}</span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey={viz.xAxis || 'category'} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '11px' }}
                  />
                  <Bar dataKey={viz.yAxis || 'value'} fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      case 'pie': {
        const pieData = viz.data || (data?.breakdown) || [];
        if (!pieData || pieData.length === 0) return null;

        return (
          <div className="mt-3 p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-emerald-600" />
              <span>{viz.title || 'Categorical Distribution'}</span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey={viz.dataKey || 'value'}
                    nameKey={viz.nameKey || 'category'}
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '8px', color: '#FFF', fontSize: '11px' }}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">AI Analytics Assistant</h1>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                Gemini 1.5
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Query organizational data in plain English. Guaranteed tenant-safe calculations without raw SQL execution.
            </p>
          </div>
        </div>

        {/* Dataset Context Picker */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Database className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium">Context:</span>
          </div>
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 shadow-2xs focus:border-blue-500 focus:outline-none"
          >
            {datasets.map(ds => (
              <option key={ds.id} value={ds.id}>
                {ds.name} ({ds.row_count || 0} rows)
              </option>
            ))}
          </select>

          <button
            onClick={handleNewChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
        </div>
      </div>

      {/* Main Assistant Body */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left History Sidebar */}
        <div className="hidden lg:flex flex-col w-64 rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              History
            </span>
            <span className="text-[10px] font-mono text-slate-400 font-semibold">
              {conversations.length} threads
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No past conversations.
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                    loadConversationMessages(conv.id);
                  }}
                  className={`group w-full text-left p-2 rounded-lg text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                    activeConversationId === conv.id
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate flex-1">{conv.title || 'Analytics Conversation'}</span>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition"
                    title="Delete thread"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Chat Feed */}
        <div className="flex-1 flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          {/* Scrollable Message Canvas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {messages.length === 0 ? (
              <div className="py-8 max-w-xl mx-auto text-center space-y-5">
                <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 text-blue-600 border border-blue-100">
                  <Sparkles className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">What would you like to analyze today?</h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Ask questions about revenue velocity, categorical breakdowns, statistical anomalies, or ML forecast projections.
                  </p>
                </div>

                {/* Suggested Queries Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left pt-2">
                  {SUGGESTED_QUERIES.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendQuery(item.text)}
                        className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-blue-300 hover:shadow-sm text-slate-700 transition text-xs flex items-start gap-2.5 group"
                      >
                        <Icon className="h-4 w-4 text-blue-600 shrink-0 mt-0.5 group-hover:scale-110 transition" />
                        <span className="font-medium leading-tight">{item.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={idx}
                    className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
                  >
                    {!isUser && (
                      <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div className="space-y-1.5 max-w-[85%]">
                      {/* Message Bubble */}
                      <div
                        className={`p-4 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                            : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-xs shadow-2xs'
                        }`}
                      >
                        {!isUser && msg.intent && (
                          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/60">
                            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${INTENT_BADGES[String(msg.intent).toLowerCase()] || INTENT_BADGES.kpi}`}>
                              {msg.intent.replace(/_/g, ' ')}
                            </span>
                            {['greeting', 'farewell', 'thanks', 'help', 'capabilities', 'non_analytics'].includes(String(msg.intent).toLowerCase()) ? (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                                <span>Direct Response</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Verified Computation</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Narrative Content */}
                        <div className="whitespace-pre-line font-sans">
                          {msg.content}
                        </div>

                        {/* Visualization Component */}
                        {!isUser && renderVisualization(msg)}

                        {/* Sources / Evidence Tag */}
                        {!isUser && msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>Source: {msg.sources[0].dataset_name} ({msg.sources[0].row_count} rows)</span>
                            <button
                              onClick={() => handleCopy(msg.content, idx)}
                              className="hover:text-slate-700 transition flex items-center gap-1"
                            >
                              {copiedIndex === idx ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isUser && (
                      <div className="h-8 w-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {loading && (
              <div className="flex gap-3 max-w-3xl mr-auto">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 rounded-tl-xs text-xs text-slate-600 flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  <span>Planning analytical query and computing results...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Prompt Bar */}
          <div className="p-3 border-t border-slate-200 bg-white space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuery();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask a question about revenue, trends, anomalies, or forecasts..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50/60 focus:bg-white focus:border-blue-500 focus:outline-none transition placeholder:text-slate-400 shadow-2xs"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !inputQuery.trim()}
                className={`p-2.5 rounded-xl text-white shadow-xs transition ${
                  !inputQuery.trim() || loading
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
              <span>Security Guardrails: Verified Aggregation Pipeline • No Raw SQL Execution</span>
              <span>RicozAnalytics AI v12.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
