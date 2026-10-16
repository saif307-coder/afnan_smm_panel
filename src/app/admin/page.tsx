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
  Pencil,
  Ban,
  Trash2,
  X,
  Save,
  Link2,
} from 'lucide-react';
import { calculateSubOrderDelivery } from '@/utils/orderDeliveryProgress';

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
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Edit Modal State
  const [editingOrder, setEditingOrder] = useState<{
    id: string;
    targetUrl: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  const handleRefreshAll = async () => {
    try {
      await fetch('/api/cron/sync-orders', { method: 'POST' });
    } catch {
      // non-blocking
    }
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

  // ─── ADMIN CRUD ACTIONS ───────────────────────────────────────────────────

  // 1. Edit Target URL Handler
  const handleOpenEdit = (order: OrderItem) => {
    setEditingOrder({
      id: order.id,
      targetUrl: order.targetReelUrl || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    setSavingEdit(true);
    const orderId = editingOrder.id;
    const newUrl = editingOrder.targetUrl.trim();

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: newUrl }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update target URL');
      }

      // Optimistically update order in local state
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, targetReelUrl: newUrl || null } : o))
      );

      setToast({
        show: true,
        type: 'success',
        message: `Target URL successfully updated for Order #${orderId.slice(-8)}.`,
      });
      setEditingOrder(null);
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        message: err instanceof Error ? err.message : 'Edit failed',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // 2. Stop Order (Change status to CANCELED, notify provider via action=cancel, and auto-refund)
  const handleStopOrder = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELED' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to stop order');
      }

      const refunded = typeof data.refundedAmount === 'number' ? data.refundedAmount : 0;

      // Optimistically update status to CANCELED and reflect refunded cost
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              status: 'CANCELED',
              totalCost: data.totalCost !== undefined ? data.totalCost : Math.max(0, o.totalCost - refunded),
              items: o.items?.map((item) =>
                item.status === 'Completed' ? item : { ...item, status: 'Canceled', cost: 0 }
              ),
            };
          }
          return o;
        })
      );

      setToast({
        show: true,
        type: 'success',
        message: `Order #${orderId.slice(-8)} stopped & canceled at provider. Refunded: $${refunded.toFixed(4)} credited back.`,
      });

      // Immediately refresh orders and live provider balance within 1 second
      setTimeout(() => {
        fetchOrders();
        fetchLiveBalance();
      }, 400);
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        message: err instanceof Error ? err.message : 'Stop order failed',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. Delete Order Handler
  const handleDeleteOrder = async (order: OrderItem) => {
    const confirmMessage = `Are you sure you want to permanently delete Order #${order.id.slice(-8)}?\n\nThis will completely delete the parent order and all child sub-orders. This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setActionLoadingId(order.id);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete order');
      }

      // Optimistically remove from state
      setOrders((prev) => prev.filter((o) => o.id !== order.id));

      setToast({
        show: true,
        type: 'success',
        message: `Order #${order.id.slice(-8)} was permanently deleted.`,
      });
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        message: err instanceof Error ? err.message : 'Delete order failed',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchLiveBalance();
  }, []);

  // 30s live auto-sync polling while any order is PROCESSING or PENDING
  useEffect(() => {
    const hasActiveOrders = orders.some(
      (o) => o.status === 'PROCESSING' || o.status === 'PENDING'
    );
    if (!hasActiveOrders) return;

    const interval = setInterval(async () => {
      try {
        await fetch('/api/cron/sync-orders', { method: 'POST' });
      } catch {
        // non-blocking
      }
      fetchOrders();
      fetchLiveBalance();
    }, 30000);

    return () => clearInterval(interval);
  }, [orders]);

  // Summary Metrics KPIs
  const stats = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter((o) => o.status === 'COMPLETED').length;
    const partial = orders.filter((o) => o.status === 'PARTIAL').length;
    const failed = orders.filter((o) => o.status === 'FAILED' || o.status === 'CANCELED').length;
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 font-mono">
            <AlertTriangle className="w-3.5 h-3.5" />
            PARTIAL
          </span>
        );
      case 'CANCELED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono">
            <Ban className="w-3.5 h-3.5" />
            CANCELED
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
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
          Canceled
        </span>
      );
    }
    if (s.includes('partial')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-500/15 text-purple-400 border border-purple-500/30">
          Partial
        </span>
      );
    }
    if (s.includes('skip')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-slate-400 border border-slate-700">
          SKIPPED (Below Min Qty)
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
      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/10 text-amber-300/90 border border-amber-500/25">
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
            CRUD control, live delivery tracking, sub-orders & automated provider synchronization
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
            {stats.failed} failed / canceled
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
          {['ALL', 'COMPLETED', 'PROCESSING', 'PARTIAL', 'CANCELED', 'FAILED', 'PENDING'].map((status) => (
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
                <th className="py-4 px-4 text-center">Actions</th>
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
                  const isRowLoading = actionLoadingId === order.id;
                  const dateStr = new Date(order.createdAt).toLocaleString();

                  // Sub-order items
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
                              className="text-blue-400 hover:text-blue-300 truncate block items-center gap-1 font-sans"
                              title={order.targetReelUrl}
                            >
                              <span className="truncate block">
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
                        <td className="py-3.5 px-4 font-bold">
                          {order.status === 'CANCELED' && order.totalCost === 0 ? (
                            <span className="text-amber-400 font-mono inline-flex items-center gap-1.5" title="Order stopped and fully refunded">
                              <span>$0.0000</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">Refunded</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-mono">${order.totalCost.toFixed(4)}</span>
                          )}
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

                        {/* UPGRADED ACTIONS COLUMN: Complete CRUD Controls */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 1. Edit (Pencil icon, color: blue): Opens edit target URL modal */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(order)}
                              disabled={isRowLoading}
                              title="Edit Target URL"
                              className="p-1.5 rounded-lg bg-blue-600/15 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 transition active:scale-95 disabled:opacity-40"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* 2. Stop (Ban icon, color: orange): Sets status to CANCELED */}
                            <button
                              type="button"
                              onClick={() => handleStopOrder(order.id)}
                              disabled={isRowLoading || order.status === 'CANCELED'}
                              title={order.status === 'CANCELED' ? 'Order Already Canceled' : 'Stop Order (Mark CANCELED)'}
                              className={`p-1.5 rounded-lg border transition active:scale-95 disabled:opacity-40 ${
                                order.status === 'CANCELED'
                                  ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                                  : 'bg-amber-600/15 text-amber-400 hover:bg-amber-600 hover:text-white border-amber-500/30'
                              }`}
                            >
                              {isRowLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Ban className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* 3. Delete (Trash icon, color: red): Confirmation dialog & delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(order)}
                              disabled={isRowLoading}
                              title="Delete Order Permanently"
                              className="p-1.5 rounded-lg bg-rose-600/15 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 transition active:scale-95 disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* 4. Details (ChevronDown icon, color: gray) for expanding sub-orders */}
                            <button
                              type="button"
                              onClick={() => toggleExpand(order.id)}
                              title={isExpanded ? 'Collapse sub-orders' : 'Details (Expand sub-orders)'}
                              className={`p-1.5 rounded-lg border transition active:scale-95 ${
                                isExpanded
                                  ? 'bg-slate-700 text-white border-slate-600'
                                  : 'bg-slate-800/80 text-gray-400 hover:text-white hover:bg-slate-700 border-slate-700'
                              }`}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-y border-slate-800">
                          <td colSpan={8} className="p-0 font-sans">
                            <div className="sticky left-0 w-full max-w-[calc(100vw-2rem)] sm:max-w-none mx-auto px-3 py-4 sm:p-6 overflow-x-hidden min-w-0 space-y-4">
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
                                {/* Left: Calculated Quantities Breakdown (Enforcing Viewers & Watch Time Standard) */}
                                <div className="lg:col-span-5 p-3.5 sm:p-4 rounded-2xl bg-[#0e131f] border border-slate-800 space-y-3 min-w-0">
                                  <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2 min-w-0 gap-2">
                                    <span className="font-bold text-white flex items-center gap-2 min-w-0 truncate">
                                      <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                                      <span className="truncate">Calculated Metric Bundle</span>
                                    </span>
                                    <span className="text-slate-400 font-mono text-[11px] shrink-0">
                                      Base: {order.baseViews.toLocaleString()} views
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                                    {/* 1. Viewers (Strict 67.5%) */}
                                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-blue-500/30 min-w-0">
                                      <span className="text-blue-400 text-xs flex items-center gap-1 font-medium min-w-0 truncate">
                                        <Layers className="w-3 h-3 text-blue-400 shrink-0" /> <span className="truncate">Viewers (67.5%)</span>
                                      </span>
                                      <span className="text-blue-300 font-bold text-sm block mt-1">
                                        {Math.round(order.baseViews * 0.675).toLocaleString()}
                                      </span>
                                    </div>

                                    {/* 2. Avg Watch Time (Strict 42s / 0.7x) */}
                                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-teal-500/30 min-w-0">
                                      <span className="text-teal-400 text-xs flex items-center gap-1 font-medium min-w-0 truncate">
                                        <Clock className="w-3 h-3 text-teal-400 shrink-0" /> <span className="truncate">Watch Time</span>
                                      </span>
                                      <span className="text-teal-300 font-bold text-sm block mt-1">
                                        42s (0.7x)
                                      </span>
                                    </div>

                                    {/* 3. Likes */}
                                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 min-w-0">
                                      <span className="text-slate-400 text-xs flex items-center gap-1.5 font-medium min-w-0">
                                        <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" /> <span>Likes</span>
                                      </span>
                                      <span className="text-rose-300 font-bold text-sm block mt-1">
                                        {order.likes.toLocaleString()}
                                      </span>
                                    </div>

                                    {/* 4. Saves */}
                                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 min-w-0">
                                      <span className="text-slate-400 text-xs flex items-center gap-1.5 font-medium min-w-0">
                                        <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" /> <span>Saves</span>
                                      </span>
                                      <span className="text-amber-300 font-bold text-sm block mt-1">
                                        {order.saves.toLocaleString()}
                                      </span>
                                    </div>

                                    {/* 5. Shares */}
                                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 min-w-0">
                                      <span className="text-slate-400 text-xs flex items-center gap-1.5 font-medium min-w-0">
                                        <Share2 className="w-3.5 h-3.5 text-sky-400 shrink-0" /> <span>Shares</span>
                                      </span>
                                      <span className="text-sky-300 font-bold text-sm block mt-1">
                                        {order.shares.toLocaleString()}
                                      </span>
                                    </div>

                                    {/* 6. Reposts */}
                                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 min-w-0">
                                      <span className="text-slate-400 text-xs flex items-center gap-1.5 font-medium min-w-0">
                                        <Repeat2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> <span>Reposts</span>
                                      </span>
                                      <span className="text-emerald-300 font-bold text-sm block mt-1">
                                        {order.reposts.toLocaleString()}
                                      </span>
                                    </div>

                                    {/* 7. Comments */}
                                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 min-w-0">
                                      <span className="text-slate-400 text-xs flex items-center gap-1.5 font-medium min-w-0">
                                        <MessageCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" /> <span>Comments</span>
                                      </span>
                                      <span className="text-purple-300 font-bold text-sm block mt-1">
                                        {order.comments.toLocaleString()}
                                      </span>
                                    </div>

                                    {/* 8. Follows */}
                                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 min-w-0">
                                      <span className="text-slate-400 text-xs flex items-center gap-1.5 font-medium min-w-0">
                                        <UserPlus className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" /> <span>Follows</span>
                                      </span>
                                      <span className="text-fuchsia-300 font-bold text-sm block mt-1">
                                        {order.followers.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Live Sub-Order Tracking Items */}
                                <div className="lg:col-span-7 p-3.5 sm:p-4 rounded-2xl bg-[#0e131f] border border-slate-800 space-y-3 min-w-0">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs border-b border-slate-800 pb-2 min-w-0 gap-1">
                                    <span className="font-bold text-white flex items-center gap-2 min-w-0 truncate">
                                      <Code2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                      <span className="truncate">Live Sub-Order Delivery Tracking (Phase 7)</span>
                                    </span>
                                    <span className="text-slate-400 text-[11px] truncate shrink-0">
                                      Provider: {order.provider?.name || 'SMM Provider'}
                                    </span>
                                  </div>

                                  {order.errorMessage && subItems.some((i) => String(i.status).toLowerCase().includes('fail')) && (
                                    <div className="p-2.5 sm:p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 min-w-0">
                                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                                      <span className="font-mono text-[11px] leading-relaxed break-words min-w-0 flex-1">
                                        {order.errorMessage}
                                      </span>
                                    </div>
                                  )}

                                  {subItems.length > 0 ? (
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                      {subItems.map((item, idx) => {
                                        const quantity = item.quantity || 0;
                                        const { effectiveRemains, delivered, progress: progressPct } = calculateSubOrderDelivery(item);

                                        return (
                                          <div
                                            key={item.id || idx}
                                            className="p-3 sm:p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2 min-w-0"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2 font-mono min-w-0">
                                              <div className="flex flex-wrap items-center gap-2 min-w-0">
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

                                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                <div className="break-words min-w-0">
                                                  {getItemStatusBadge(item.status)}
                                                </div>
                                                {item.providerOrderId ? (
                                                  <span className="text-emerald-400 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 whitespace-nowrap">
                                                    Order #{item.providerOrderId}
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-500 text-[10px] whitespace-nowrap">No Order ID</span>
                                                )}
                                              </div>
                                            </div>

                                            {/* Live Tracking Numbers: Start Count & Remains */}
                                            <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 pt-1 gap-1 min-w-0">
                                              <div className="min-w-0">
                                                <span className="text-slate-500">Start Count: </span>
                                                <span className="font-bold text-slate-200">
                                                  {item.startCount !== null && item.startCount !== undefined
                                                    ? item.startCount.toLocaleString()
                                                    : '—'}
                                                </span>
                                              </div>

                                              <div className="min-w-0">
                                                <span className="text-slate-500">Remains: </span>
                                                <span className="font-bold text-amber-300">
                                                  {`${effectiveRemains.toLocaleString()} / ${quantity.toLocaleString()}`}
                                                </span>
                                              </div>

                                              <div className="min-w-0">
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

      {/* EDIT TARGET URL MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-[#0e131f] border border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Target Reel URL</h3>
                  <p className="text-xs text-slate-400 font-mono">Order #{editingOrder.id.slice(-8)}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                disabled={savingEdit}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Target Instagram Media URL</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingOrder.targetUrl}
                  onChange={(e) =>
                    setEditingOrder((prev) => (prev ? { ...prev, targetUrl: e.target.value } : null))
                  }
                  placeholder="https://www.instagram.com/reel/C7xY9z0A1b2/"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-blue-500 transition"
                />
                <p className="text-[11px] text-slate-500">
                  Fix typographical errors or update the destination link for this order.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
