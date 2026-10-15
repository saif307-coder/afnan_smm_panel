'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ShoppingBag,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Layers,
  Heart,
  Bookmark,
  Share2,
  Repeat2,
  MessageCircle,
  UserPlus,
  Eye,
  AlertCircle,
  Code2,
  Wallet,
  Activity,
  Loader2,
  Zap,
} from 'lucide-react';

interface SubOrderItem {
  id: string;
  metricType: string;
  serviceId?: string | null;
  quantity: number;
  cost: number;
  providerOrderId?: string | null;
  status: string;
  startCount?: number | null;
  remains?: number | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface OrderItem {
  id: string;
  targetReelUrl: string | null;
  baseViews: number;
  likes: number;
  saves: number;
  shares: number;
  reposts: number;
  comments: number;
  followers: number;
  totalCost: number;
  status: string;
  providerId: string | null;
  providerResponsesJson: string | null;
  errorMessage: string | null;
  items?: SubOrderItem[];
  createdAt: string;
  updatedAt: string;
  provider?: {
    id: string;
    name: string;
    apiUrl?: string;
  } | null;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingLive, setSyncingLive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Live SMM Provider Balance state
  const [providerBalance, setProviderBalance] = useState<{
    loading: boolean;
    balance: string;
    currency: string;
    providerName?: string;
    error?: string;
  }>({
    loading: true,
    balance: '...',
    currency: 'USD',
  });

  const fetchLiveBalance = async () => {
    try {
      setProviderBalance((prev) => ({ ...prev, loading: true }));
      const res = await fetch('/api/admin/providers/balance');
      const data = await res.json();
      if ((data.connected || data.success) && data.balance !== undefined) {
        setProviderBalance({
          loading: false,
          balance: data.balance,
          currency: data.currency || 'USD',
          providerName: data.providerName,
        });
      } else {
        setProviderBalance({
          loading: false,
          balance: data.balance || '0.0000',
          currency: data.currency || 'USD',
          error: data.error,
        });
      }
    } catch {
      setProviderBalance((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch balance',
      }));
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?limit=100');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setOrders(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = () => {
    fetchOrders();
    fetchLiveBalance();
  };

  // Phase 7: Live Status Sync with SMM Provider API
  const handleSyncLiveStatus = async () => {
    setSyncingLive(true);
    setToast(null);

    try {
      const res = await fetch('/api/cron/sync-orders', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        setToast({
          show: true,
          type: 'success',
          message: `Live Sync Complete: ${data.itemsUpdated ?? 0} sub-orders updated across ${data.ordersEvaluated ?? 0} orders (${data.durationMs ?? 0}ms).`,
        });
        await fetchOrders();
      } else {
        throw new Error(data.error || 'Failed to synchronize live order statuses');
      }
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        message: err instanceof Error ? err.message : 'Live sync execution failed',
      });
    } finally {
      setSyncingLive(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchLiveBalance();
  }, []);

  // Summary Metrics KPIs
  const stats = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter((o) => o.status === 'COMPLETED').length;
    const partial = orders.filter((o) => o.status === 'PARTIAL').length;
    const failed = orders.filter((o) => o.status === 'FAILED').length;
    const totalViews = orders.reduce((acc, o) => acc + (o.baseViews || 0), 0);
    const totalCost = orders.reduce((acc, o) => acc + (o.totalCost || 0), 0);
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';

    return {
      total,
      completed,
      partial,
      failed,
      totalViews,
      totalCost,
      successRate,
    };
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === 'ALL' || order.status.toUpperCase() === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        order.id.toLowerCase().includes(q) ||
        (order.targetReelUrl && order.targetReelUrl.toLowerCase().includes(q)) ||
        (order.errorMessage && order.errorMessage.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedOrderId((prev) => (prev === id ? null : id));
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            COMPLETED
          </span>
        );
      case 'PROCESSING':
      case 'IN PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            PROCESSING
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono">
            <AlertTriangle className="w-3.5 h-3.5" />
            PARTIAL
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 font-mono">
            <Clock className="w-3.5 h-3.5" />
            PENDING
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono">
            <AlertCircle className="w-3.5 h-3.5" />
            {status.toUpperCase()}
          </span>
        );
    }
  };

  const getItemStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('complete')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          Completed
        </span>
      );
    }
    if (s.includes('progress') || s.includes('process')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          {s.includes('progress') ? 'In progress' : 'Processing'}
        </span>
      );
    }
    if (s.includes('cancel')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
          Canceled
        </span>
      );
    }
    if (s.includes('partial')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
          Partial
        </span>
      );
    }
    if (s.includes('skip')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-slate-400 border border-slate-700">
          Skipped
        </span>
      );
    }
    if (s.includes('fail')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
          Failed
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
        Pending
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Client Orders Management
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time tracking of bundled Instagram Reel dispatches, sub-orders & provider status sync
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live Balance Pill in Header */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {providerBalance.loading ? (
                'Syncing API Balance...'
              ) : (
                `API Balance: $${providerBalance.balance} ${providerBalance.currency}`
              )}
            </span>
          </div>

          {/* Sync Live Status Button */}
          <button
            onClick={handleSyncLiveStatus}
            disabled={syncingLive || loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white shadow-lg shadow-teal-600/20 transition disabled:opacity-50"
            title="Poll SMM Provider API for live start counts, remains, and completion statuses"
          >
            {syncingLive ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing Live Status...</span>
              </>
            ) : (
              <>
                <Activity className="w-3.5 h-3.5" />
                <span>Sync Live Status</span>
              </>
            )}
          </button>

          <button
            onClick={handleRefreshAll}
            disabled={loading || providerBalance.loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 transition shadow-sm w-fit"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || providerBalance.loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toast?.show && (
        <div
          className={`p-4 rounded-2xl border shadow-xl flex items-center justify-between gap-3 animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs opacity-70 hover:opacity-100 px-2 py-0.5 rounded bg-black/20"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <div className="p-5 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-white mt-1.5">
            {stats.total.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Logged in Prisma DB</div>
        </div>

        {/* Total Views Dispatched */}
        <div className="p-5 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Views Dispatched</span>
            <Eye className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-purple-300 mt-1.5">
            {stats.totalViews.toLocaleString()}
          </div>
          <div className="text-[11px] text-purple-400/80 mt-1">Combined Scale Volume</div>
        </div>

        {/* Live Provider Balance */}
        <div className="p-5 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <span>Live Provider Balance</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div
            className="text-2xl font-extrabold font-mono text-emerald-400 mt-1.5 truncate"
            title={`Live SMM API Balance: $${providerBalance.balance} ${providerBalance.currency}`}
          >
            {providerBalance.loading ? (
              <span className="text-slate-500 text-sm font-sans flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> Loading...
              </span>
            ) : (
              `$${providerBalance.balance} ${providerBalance.currency}`
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span className="truncate max-w-[130px]" title={providerBalance.providerName || 'SMM Provider'}>
              {providerBalance.providerName || 'Active Provider'}
            </span>
            <span className="text-slate-500 font-mono">Billed: ${stats.totalCost.toFixed(4)}</span>
          </div>
        </div>

        {/* Dispatch Health */}
        <div className="p-5 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Completed Orders</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-white mt-1.5">
            {stats.completed} <span className="text-xs text-slate-400 font-normal">/ {stats.total}</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-mono">
            {stats.failed} failed / pending
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order ID, Reel URL, or Error message..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-1 shrink-0" />
          {['ALL', 'COMPLETED', 'PROCESSING', 'PARTIAL', 'FAILED', 'PENDING'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl overflow-hidden backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-4 px-4">Order ID</th>
                <th className="py-4 px-4">Target URL</th>
                <th className="py-4 px-4">Base Views</th>
                <th className="py-4 px-4">Total Cost</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Sub-Orders</th>
                <th className="py-4 px-4">Date</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-sans">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                      <span>Loading orders from database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-sans">
                    No orders found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const dateStr = new Date(order.createdAt).toLocaleString();

                  // Sub-order items: prefer relational items array, fallback to parsed responses JSON
                  let subItems: SubOrderItem[] = order.items || [];
                  if (subItems.length === 0 && order.providerResponsesJson) {
                    try {
                      const parsed = JSON.parse(order.providerResponsesJson);
                      if (Array.isArray(parsed)) {
                        subItems = parsed.map((p, idx) => ({
                          id: `${order.id}-item-${idx}`,
                          metricType: p.metricType || 'UNKNOWN',
                          serviceId: p.serviceId,
                          quantity: p.quantity || 0,
                          cost: p.cost || 0,
                          providerOrderId: p.providerOrderId ? String(p.providerOrderId) : null,
                          status: p.externalStatus || (p.status === 'SUCCESS' ? 'Pending' : p.status || 'Failed'),
                          startCount: p.startCount,
                          remains: p.remains,
                          errorMessage: p.error,
                        }));
                      }
                    } catch {
                      subItems = [];
                    }
                  }

                  const activeProviderIds = subItems
                    .filter((i) => i.providerOrderId)
                    .map((i) => i.providerOrderId);

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isExpanded ? 'bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-200">
                          #{order.id.slice(-8)}
                        </td>
                        <td className="py-3.5 px-4 max-w-[200px]">
                          {order.targetReelUrl ? (
                            <a
                              href={order.targetReelUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300 truncate block items-center gap-1"
                              title={order.targetReelUrl}
                            >
                              <span className="truncate block font-sans">
                                {order.targetReelUrl.replace('https://www.instagram.com/reel/', '')}
                              </span>
                            </a>
                          ) : (
                            <span className="text-slate-500 font-sans italic">Default Session</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-white font-bold">
                          {order.baseViews.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-400 font-bold">
                          ${order.totalCost.toFixed(4)}
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(order.status)}</td>
                        <td className="py-3.5 px-4 font-sans">
                          {activeProviderIds.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/50">
                              <Zap className="w-3 h-3 text-amber-400" />
                              {activeProviderIds.length} sub-orders
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">No external IDs</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px] font-sans">
                          {dateStr}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => toggleExpand(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-sans font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                          >
                            <span>{isExpanded ? 'Collapse' : 'Tracking'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-y border-slate-800">
                          <td colSpan={8} className="p-4 sm:p-6 space-y-4 font-sans">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                              {/* Left: Calculated Quantities Breakdown (5 Cols) */}
                              <div className="lg:col-span-5 p-4 rounded-2xl bg-[#0e131f] border border-slate-800 space-y-3">
                                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                                  <span className="font-bold text-white flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-indigo-400" />
                                    <span>Calculated Metric Bundle</span>
                                  </span>
                                  <span className="text-slate-400 font-mono text-[11px]">
                                    Base: {order.baseViews.toLocaleString()} views
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
                                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                                    <span className="text-slate-400 text-[10px] flex items-center gap-1">
                                      <Heart className="w-3 h-3 text-rose-400" /> Likes
                                    </span>
                                    <span className="text-rose-300 font-bold text-sm block mt-0.5">
                                      {order.likes.toLocaleString()}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                                    <span className="text-slate-400 text-[10px] flex items-center gap-1">
                                      <Bookmark className="w-3 h-3 text-amber-400" /> Saves
                                    </span>
                                    <span className="text-amber-300 font-bold text-sm block mt-0.5">
                                      {order.saves.toLocaleString()}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                                    <span className="text-slate-400 text-[10px] flex items-center gap-1">
                                      <Share2 className="w-3 h-3 text-sky-400" /> Shares
                                    </span>
                                    <span className="text-sky-300 font-bold text-sm block mt-0.5">
                                      {order.shares.toLocaleString()}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                                    <span className="text-slate-400 text-[10px] flex items-center gap-1">
                                      <Repeat2 className="w-3 h-3 text-emerald-400" /> Reposts
                                    </span>
                                    <span className="text-emerald-300 font-bold text-sm block mt-0.5">
                                      {order.reposts.toLocaleString()}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                                    <span className="text-slate-400 text-[10px] flex items-center gap-1">
                                      <MessageCircle className="w-3 h-3 text-purple-400" /> Comments
                                    </span>
                                    <span className="text-purple-300 font-bold text-sm block mt-0.5">
                                      {order.comments.toLocaleString()}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                                    <span className="text-slate-400 text-[10px] flex items-center gap-1">
                                      <UserPlus className="w-3 h-3 text-fuchsia-400" /> Follows
                                    </span>
                                    <span className="text-fuchsia-300 font-bold text-sm block mt-0.5">
                                      {order.followers.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Live Sub-Order Tracking Items (7 Cols) */}
                              <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0e131f] border border-slate-800 space-y-3">
                                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                                  <span className="font-bold text-white flex items-center gap-2">
                                    <Code2 className="w-4 h-4 text-emerald-400" />
                                    <span>Live Sub-Order Delivery Tracking (Phase 7)</span>
                                  </span>
                                  <span className="text-slate-400 text-[11px]">
                                    Provider: {order.provider?.name || 'SMM Provider'}
                                  </span>
                                </div>

                                {order.errorMessage && (
                                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                                    <span className="font-mono text-[11px] leading-relaxed">
                                      {order.errorMessage}
                                    </span>
                                  </div>
                                )}

                                {subItems.length > 0 ? (
                                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {subItems.map((item, idx) => {
                                      const quantity = item.quantity || 0;
                                      const remains = item.remains !== undefined && item.remains !== null ? item.remains : quantity;
                                      const progressPct =
                                        quantity > 0
                                          ? Math.min(100, Math.max(0, Math.round(((quantity - remains) / quantity) * 100)))
                                          : 100;

                                      return (
                                        <div
                                          key={item.id || idx}
                                          className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2"
                                        >
                                          <div className="flex items-center justify-between font-mono">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-white text-xs">
                                                {item.metricType}
                                              </span>
                                              <span className="text-slate-500 text-[11px]">
                                                {quantity.toLocaleString()} qty
                                              </span>
                                              {item.serviceId && (
                                                <span className="text-[10px] text-slate-500">
                                                  (Svc #{item.serviceId})
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                              {getItemStatusBadge(item.status)}
                                              {item.providerOrderId ? (
                                                <span className="text-emerald-400 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                  Order #{item.providerOrderId}
                                                </span>
                                              ) : (
                                                <span className="text-slate-500 text-[10px]">No Order ID</span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Live Tracking Numbers: Start Count & Remains */}
                                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                                            <div>
                                              <span className="text-slate-500">Start Count: </span>
                                              <span className="font-bold text-slate-200">
                                                {item.startCount !== null && item.startCount !== undefined
                                                  ? item.startCount.toLocaleString()
                                                  : '—'}
                                              </span>
                                            </div>

                                            <div>
                                              <span className="text-slate-500">Remains: </span>
                                              <span className="font-bold text-amber-300">
                                                {item.remains !== null && item.remains !== undefined
                                                  ? `${item.remains.toLocaleString()} / ${quantity.toLocaleString()}`
                                                  : '—'}
                                              </span>
                                            </div>

                                            <div>
                                              <span className="text-slate-500">Progress: </span>
                                              <span className="font-bold text-emerald-400">
                                                {progressPct}%
                                              </span>
                                            </div>
                                          </div>

                                          {/* Mini Progress Bar */}
                                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                                            <div
                                              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                                              style={{ width: `${progressPct}%` }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500 italic p-4 text-center">
                                    No itemized provider tracking records attached to this order.
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
