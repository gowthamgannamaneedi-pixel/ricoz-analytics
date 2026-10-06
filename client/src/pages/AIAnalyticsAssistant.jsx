import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ChevronDown,
  Database,
  Layers,
  HelpCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  ShieldCheck,
  LineChart as LineChartIcon,
  Info,
  Search,
  MessageSquare,
  MoreVertical,
  ShoppingBag,
  MapPin,
  X,
  ThumbsUp,
  ThumbsDown,
  Menu,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
  getDatasets
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const PIE_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DB2777', '#0891B2', '#4B5563'];

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

// 4 Categorized Suggestions matching the design reference
const QUESTION_CATEGORIES = [
  {
    category: 'Revenue Analysis',
    icon: TrendingUp,
    headerColor: 'text-emerald-700',
    iconBg: 'bg-emerald-50 text-emerald-600',
    borderColor: 'border-emerald-100',
    hoverBorder: 'hover:border-emerald-300',
    questions: [
      'What is total revenue?',
      'Show revenue trend for last 6 months',
      'Compare this month with last month'
    ]
  },
  {
    category: 'Sales Analysis',
    icon: ShoppingBag,
    headerColor: 'text-blue-700',
    iconBg: 'bg-blue-50 text-blue-600',
    borderColor: 'border-blue-100',
    hoverBorder: 'hover:border-blue-300',
    questions: [
      'Which product has the highest sales?',
      'Show top 5 products by revenue',
      'How are sales performing this quarter?'
    ]
  },
  {
    category: 'Regional Analysis',
    icon: MapPin,
    headerColor: 'text-purple-700',
    iconBg: 'bg-purple-50 text-purple-600',
    borderColor: 'border-purple-100',
    hoverBorder: 'hover:border-purple-300',
    questions: [
      'Which region has the highest revenue?',
      'Compare sales across different regions',
      'Show state-wise sales distribution'
    ]
  },
  {
    category: 'Anomalies & Insights',
    icon: AlertTriangle,
    headerColor: 'text-amber-700',
    iconBg: 'bg-amber-50 text-amber-600',
    borderColor: 'border-amber-100',
    hoverBorder: 'hover:border-amber-300',
    questions: [
      'Are there any unusual patterns?',
      'Explain the biggest anomaly in data',
      'Why did sales suddenly increase?'
    ]
  }
];

// Quick query chips displayed beneath the input box
const QUICK_CHIPS = [
  'What is total revenue?',
  'Show sales by region',
  'Top products this quarter',
  'Any anomalies in data?'
];

function formatTimestamp(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch (_) {
    return '';
  }
}

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
  const [searchHistoryQuery, setSearchHistoryQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [feedbackState, setFeedbackState] = useState({});
  const [datasetDropdownOpen, setDatasetDropdownOpen] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const datasetDropdownRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3000);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (datasetDropdownRef.current && !datasetDropdownRef.current.contains(e.target)) {
        setDatasetDropdownOpen(false);
      }
      if (!e.target.closest('.conversation-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load datasets and conversation history
  const loadInitialData = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const [datasetsRes, convsRes] = await Promise.all([
        getDatasets().catch(() => ({ data: [] })),
        getAIConversations().catch(() => ({ data: [] }))
      ]);

      const dsList = datasetsRes.datasets || datasetsRes.data || [];
      const convList = convsRes.data || convsRes.conversations || [];

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
      console.error('Failed to load initial data:', err);
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
      setLoading(true);
      const res = await getAIConversationById(convId);
      if (res && res.data && Array.isArray(res.data.messages)) {
        setMessages(res.data.messages);
        if (res.data.dataset_id) {
          setSelectedDatasetId(String(res.data.dataset_id));
        }
      }
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Start a new conversation
  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputQuery('');
    setMobileHistoryOpen(false);
    showToast('New conversation ready.');
  };

  // Delete conversation
  const handleDeleteConversation = async (convId, e) => {
    if (e) e.stopPropagation();
    try {
      await deleteAIConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      setActiveMenuId(null);
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
      showToast('Conversation deleted.');
    } catch (err) {
      console.error('Error deleting conversation:', err);
      showToast('Failed to delete conversation.');
    }
  };

  // Submit Query
  const handleSendQuery = async (queryText = null) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || loading) return;

    setInputQuery('');
    setMobileHistoryOpen(false);

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

        // Refresh conversation history to show newly created or updated thread
        const updatedConvs = await getAIConversations().catch(() => ({ data: [] }));
        const list = updatedConvs.data || updatedConvs.conversations || [];
        setConversations(list);

        if (response.conversationId) {
          setActiveConversationId(response.conversationId);
        }
      } else {
        throw new Error(response?.message || 'Assistant could not compute response.');
      }
    } catch (err) {
      console.error('Query error:', err);
      const errMsg = {
        role: 'assistant',
        content: `I encountered an issue processing your analytical query: ${err.message || 'Please check dataset connectivity.'}`,
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
    showToast('Response copied to clipboard.');
  };

  // Group conversations by date timeline
  const groupedConversations = useMemo(() => {
    const filtered = conversations.filter(c => {
      if (!searchHistoryQuery.trim()) return true;
      const q = searchHistoryQuery.toLowerCase();
      return (
        (c.title || '').toLowerCase().includes(q) ||
        (c.dataset_name || '').toLowerCase().includes(q) ||
        (c.last_message || '').toLowerCase().includes(q)
      );
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const last7DaysStart = todayStart - 6 * 86400000;

    const groups = {
      today: [],
      yesterday: [],
      last7Days: [],
      older: []
    };

    filtered.forEach(c => {
      const t = new Date(c.updated_at || c.created_at).getTime();
      if (t >= todayStart) {
        groups.today.push(c);
      } else if (t >= yesterdayStart) {
        groups.yesterday.push(c);
      } else if (t >= last7DaysStart) {
        groups.last7Days.push(c);
      } else {
        groups.older.push(c);
      }
    });

    return groups;
  }, [conversations, searchHistoryQuery]);

  // Selected dataset object
  const currentDataset = datasets.find(d => String(d.id) === String(selectedDatasetId)) || datasets[0] || null;

  // Render Visualizations in Assistant Message Bubble
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
          <div className="mt-3.5 p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                {viz.metric ? viz.metric.replace(/_/g, ' ') : 'Calculated Aggregate'}
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5 tracking-tight">
                {viz.unit ? `${viz.unit} ` : '₹ '}{val}
              </div>
            </div>
            {comparison && comparison.hasComparison && (
              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border ${
                comparison.isSalesPositive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {comparison.isSalesPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                <span>{comparison.salesChange || '0%'}</span>
              </div>
            )}
          </div>
        );
      }

      case 'line': {
        const chartData = viz.data || (data?.trends) || [];
        if (!chartData || chartData.length === 0) return null;

        return (
          <div className="mt-3.5 p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-blue-600" />
              <span>{viz.title || 'Observed Time-Series Trend'}</span>
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
                  <Line type="monotone" dataKey={viz.yAxis || 'revenue'} stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} />
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
          <div className="mt-3.5 p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
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
          <div className="mt-3.5 p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold animate-fade-in border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TOP HEADER BAR                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Left Title & Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileHistoryOpen(prev => !prev)}
            className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            aria-label="Toggle conversation history"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
            <Bot className="h-6 w-6 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Analytics Assistant</h1>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Your AI analyst for business data. Ask questions in plain English and get instant insights, visualizations, and recommendations.
            </p>
          </div>
        </div>

        {/* Right Dataset Context Card Selector */}
        <div className="relative" ref={datasetDropdownRef}>
          <div
            onClick={() => setDatasetDropdownOpen(prev => !prev)}
            className="border border-slate-200 bg-white rounded-xl px-4 py-2 flex items-center gap-3 shadow-2xs hover:border-slate-300 transition cursor-pointer"
          >
            <Database className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="text-left">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block leading-none">
                Dataset Context
              </span>
              <span className="text-xs font-bold text-slate-800 truncate block max-w-[200px] mt-0.5">
                {currentDataset ? currentDataset.name : 'No Dataset Selected'}
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                {currentDataset ? `${currentDataset.row_count || 0} rows • ${currentDataset.column_count || 10} columns` : 'Connect a dataset'}
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${datasetDropdownOpen ? 'rotate-180' : ''}`} />
          </div>

          {/* Dataset Dropdown Menu */}
          {datasetDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-fade-in text-xs">
              <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                Select Active Dataset
              </div>
              <div className="max-h-60 overflow-y-auto p-1 space-y-1">
                {datasets.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-xs">
                    No datasets available.
                  </div>
                ) : (
                  datasets.map(ds => {
                    const isSelected = String(ds.id) === String(selectedDatasetId);
                    return (
                      <div
                        key={ds.id}
                        onClick={() => {
                          setSelectedDatasetId(String(ds.id));
                          setDatasetDropdownOpen(false);
                          showToast(`Dataset context switched to "${ds.name}"`);
                        }}
                        className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="truncate block font-bold text-slate-900 text-xs">{ds.name}</span>
                          <span className="text-[11px] text-slate-500 block">
                            {ds.row_count || 0} rows • {ds.column_count || 10} columns
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN ASSISTANT WORKSPACE                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex gap-4 min-h-0 relative">
        {/* LEFT PANEL: Conversation History Sidebar */}
        <div
          className={`${
            mobileHistoryOpen ? 'flex absolute inset-0 z-40 bg-white' : 'hidden'
          } lg:flex flex-col w-72 shrink-0 rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden`}
        >
          {/* Header & Primary New Chat Button */}
          <div className="p-3 border-b border-slate-100 space-y-2.5 bg-slate-50/50">
            <button
              onClick={handleNewChat}
              id="new-chat-btn"
              className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>

            {/* Search History Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchHistoryQuery}
                onChange={(e) => setSearchHistoryQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
              />
              {searchHistoryQuery && (
                <button
                  onClick={() => setSearchHistoryQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Grouped Conversation History Stream */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {loadingHistory ? (
              <div className="p-4 text-center text-xs text-slate-400 space-y-2">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto text-slate-400" />
                <span>Loading conversation history...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-12 text-center px-4 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="text-xs font-bold text-slate-700">No conversations yet</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Start a conversation with your data to see your history organized here.
                </p>
              </div>
            ) : (
              ['today', 'yesterday', 'last7Days', 'older'].map(groupKey => {
                const list = groupedConversations[groupKey];
                if (!list || list.length === 0) return null;

                const labelMap = {
                  today: 'Today',
                  yesterday: 'Yesterday',
                  last7Days: 'Last 7 days',
                  older: 'Older'
                };

                return (
                  <div key={groupKey} className="space-y-1">
                    <div className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {labelMap[groupKey]}
                    </div>

                    {list.map(conv => {
                      const isActive = activeConversationId === conv.id;
                      const isMenuOpen = activeMenuId === conv.id;

                      return (
                        <div
                          key={conv.id}
                          onClick={() => {
                            setActiveConversationId(conv.id);
                            loadConversationMessages(conv.id);
                            setMobileHistoryOpen(false);
                          }}
                          className={`group w-full text-left p-2.5 rounded-xl text-xs cursor-pointer transition flex items-center justify-between gap-2 relative ${
                            isActive
                              ? 'bg-blue-50/80 text-blue-900 font-semibold border-l-4 border-blue-600'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2 flex-1">
                            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                            <div className="min-w-0 flex-1">
                              <span className="truncate block font-bold leading-tight">
                                {conv.title || 'Analytics Conversation'}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate block mt-0.5 font-normal">
                                {conv.dataset_name || 'Indian Enterprise Sales Telemetry (Q4)'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 conversation-menu-container">
                            <span className="text-[10px] text-slate-400 font-medium group-hover:hidden">
                              {formatTimestamp(conv.updated_at || conv.created_at)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(prev => (prev === conv.id ? null : conv.id));
                              }}
                              className="hidden group-hover:flex p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                              title="Conversation options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Conversation Options Menu */}
                            {isMenuOpen && (
                              <div className="absolute right-2 top-8 w-36 rounded-xl bg-white border border-slate-200 shadow-lg py-1 z-30 animate-fade-in text-xs">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(conv.title || '');
                                    setActiveMenuId(null);
                                    showToast('Title copied.');
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>Copy Title</span>
                                </button>
                                <button
                                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                                  className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-500" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Main AI Conversation Area */}
        <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          {/* Scrollable Message & Canvas Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.length === 0 ? (
              /* EMPTY / HERO STATE */
              <div className="space-y-6 max-w-4xl mx-auto">
                {/* Hero Banner: "Ask your data anything" */}
                <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-6 sm:p-8 relative overflow-hidden shadow-2xs">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div className="space-y-2.5 max-w-xl">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100/90 text-blue-800 text-[10px] font-bold tracking-wider uppercase font-mono">
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        <span>AI Analytics Assistant</span>
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Ask your data <span className="text-blue-600">anything</span>
                      </h2>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                        Get answers, discover insights, visualize trends, and make better business decisions using natural language.
                      </p>

                      {/* Capabilities Pills */}
                      <div className="flex flex-wrap items-center gap-2 pt-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-2xs">
                          📈 Trends &amp; Analysis
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-2xs">
                          💬 Comparisons
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-2xs">
                          ⚠️ Anomalies
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-2xs">
                          🔮 Forecasts
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-2xs">
                          📊 Visual Charts
                        </span>
                      </div>
                    </div>

                    {/* Decorative Visual Illustration Preview */}
                    <div className="hidden sm:block shrink-0">
                      <div className="rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-md w-56 space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-800 bg-slate-50 px-2 py-1 rounded-md">
                          <Bot className="w-3.5 h-3.5 text-blue-600" />
                          <span>Show me revenue trend</span>
                        </div>
                        <div className="h-16 flex items-end gap-1.5 px-2 pt-2 bg-gradient-to-t from-blue-50/50 to-transparent rounded">
                          {[30, 45, 35, 60, 50, 75, 90].map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-blue-600 rounded-t-xs"
                              style={{ height: `${h}%`, opacity: 0.4 + (i / 7) * 0.6 }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* "Try asking these questions" Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Try asking these questions</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Click a question to get started. These are examples of what you can ask.
                      </p>
                    </div>
                  </div>

                  {/* 4 Categorized Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {QUESTION_CATEGORIES.map((cat, idx) => {
                      const Icon = cat.icon;
                      return (
                        <div
                          key={idx}
                          className={`rounded-2xl border ${cat.borderColor} bg-white p-4 shadow-2xs transition space-y-3`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${cat.iconBg}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className={`text-xs font-bold ${cat.headerColor}`}>
                              {cat.category}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {cat.questions.map((q, qIdx) => (
                              <button
                                key={qIdx}
                                onClick={() => handleSendQuery(q)}
                                className="w-full text-left p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-blue-50/60 hover:border-blue-200 hover:text-blue-700 active:scale-[0.98] text-[11px] font-medium transition-all flex items-center gap-2 group cursor-pointer shadow-2xs hover:shadow-xs"
                              >
                                <ChevronRight className="w-3.5 h-3.5 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                <span className="leading-snug flex-1 text-slate-700 group-hover:text-blue-700">{q}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* "Start a conversation" divider/hint */}
                <div className="text-center pt-2 pb-1 space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Bot className="w-4 h-4 text-blue-600" />
                    <span>Start a conversation</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Select a suggested question or type your own question below.
                  </p>
                  <ChevronDown className="w-4 h-4 text-slate-300 mx-auto animate-bounce mt-1" />
                </div>
              </div>
            ) : (
              /* ACTIVE CONVERSATION MESSAGES */
              <div className="space-y-5 max-w-4xl mx-auto">
                {messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';

                  return (
                    <div
                      key={idx}
                      className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
                    >
                      {!isUser && (
                        <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}

                      <div className="space-y-1.5 max-w-[90%] sm:max-w-[85%]">
                        <div
                          className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            isUser
                              ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                              : 'bg-slate-50 border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-2xs'
                          }`}
                        >
                          {!isUser && msg.intent && (
                            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/70 text-[10px]">
                              <span className={`font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${INTENT_BADGES[String(msg.intent).toLowerCase()] || INTENT_BADGES.kpi}`}>
                                {msg.intent.replace(/_/g, ' ')}
                              </span>
                              <div className="flex items-center gap-1 text-slate-500 font-mono">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Verified Computation</span>
                              </div>
                            </div>
                          )}

                          {/* Message Content */}
                          <div className="whitespace-pre-line font-sans text-xs sm:text-sm leading-relaxed">
                            {msg.content}
                          </div>

                          {/* Embedded Visualizations */}
                          {!isUser && renderVisualization(msg)}

                          {/* Source & Actions Footer */}
                          {!isUser && (
                            <div className="mt-3.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-400">
                              <span>
                                {msg.sources && msg.sources.length > 0
                                  ? `Source: ${msg.sources[0].dataset_name} (${msg.sources[0].row_count} rows)`
                                  : 'Grounded in dataset telemetry'}
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleCopy(msg.content, idx)}
                                  className="hover:text-slate-700 transition flex items-center gap-1 p-1 rounded hover:bg-slate-200/50"
                                  title="Copy response"
                                >
                                  {copiedIndex === idx ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                  <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                                </button>
                                <button
                                  onClick={() => setFeedbackState(prev => ({ ...prev, [idx]: 'up' }))}
                                  className={`p-1 rounded hover:bg-slate-200/50 ${feedbackState[idx] === 'up' ? 'text-emerald-600' : 'hover:text-slate-700'}`}
                                  title="Helpful"
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setFeedbackState(prev => ({ ...prev, [idx]: 'down' }))}
                                  className={`p-1 rounded hover:bg-slate-200/50 ${feedbackState[idx] === 'down' ? 'text-rose-600' : 'hover:text-slate-700'}`}
                                  title="Not helpful"
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {isUser && (
                        <div className="h-8 w-8 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex gap-3 max-w-3xl mr-auto">
                    <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 rounded-tl-xs text-xs text-slate-600 flex items-center gap-2.5">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Planning analytical query and computing aggregations...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* CHAT INPUT AREA                                                    */}
          {/* ------------------------------------------------------------------ */}
          <div className="p-4 border-t border-slate-200 bg-white space-y-2.5">
            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuery();
              }}
              className="relative flex items-center rounded-2xl border border-slate-300 bg-white p-1.5 shadow-2xs hover:border-slate-400 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 transition"
            >
              <div className="pl-3 text-slate-400">
                <Sparkles className="w-4 h-4 text-blue-500" />
              </div>

              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask a question about revenue, trends, anomalies, or forecasts..."
                className="flex-1 h-10 px-3 text-xs sm:text-sm font-medium bg-transparent focus:outline-none placeholder:text-slate-400"
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading || !inputQuery.trim()}
                className={`h-9 w-9 rounded-xl flex items-center justify-center text-white transition shadow-2xs ${
                  !inputQuery.trim() || loading
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95 cursor-pointer'
                }`}
                title="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Query Suggestion Chips */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {QUICK_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendQuery(chip)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100/80 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200/70 transition cursor-pointer flex items-center gap-1 font-medium"
                  >
                    <span>{chip}</span>
                  </button>
                ))}
              </div>

              {/* Security Guardrail Tag */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tenant-safe analysis • No raw SQL execution</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
