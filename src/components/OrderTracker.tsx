'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Heart,
  Bookmark,
  Share2,
  Repeat2,
  MessageCircle,
  UserPlus,
  Eye,
  Activity,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { calculateSubOrderDelivery } from '@/utils/orderDeliveryProgress';

export interface SubOrderItem {
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
}

export interface OrderData {
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
  providerResponsesJson?: string | null;
  items?: SubOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export default function OrderTracker() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const [syncing, setSyncing] = useState(false);

  const syncAndFetchOrders = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setSyncing(true);
    try {
      // 1. Trigger live provider sync first
      try {
        await fetch('/api/cron/sync-orders', { method: 'POST' });
      } catch {
        // non-blocking
      }
      // 2. Load fresh orders from database
      const res = await fetch('/api/orders?limit=50');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setOrders(data.data);
        if (data.data.length > 0) {
          setExpandedOrders((prev) => ({
            ...prev,
            [data.data[0].id]: true,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load orders for tracker:', err);
    } finally {
      setSyncing(false);
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    syncAndFetchOrders();
  }, []);

  // 30s live auto-sync polling while any order is PROCESSING or PENDING
  useEffect(() => {
    const hasActiveOrders = orders.some(
      (o) => o.status === 'PROCESSING' || o.status === 'PENDING'
    );
    if (!hasActiveOrders) return;

    const interval = setInterval(() => {
      syncAndFetchOrders(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [orders]);

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const getSubOrders = (order: OrderData): SubOrderItem[] => {
    if (order.items && order.items.length > 0) {
      return order.items;
    }
    if (order.providerResponsesJson) {
      try {
        const parsed = JSON.parse(order.providerResponsesJson);
        if (Array.isArray(parsed)) {
          return parsed.map((p, idx) => ({
            id: `${order.id}-item-${idx}`,
            metricType: p.metricType || 'METRIC',
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
        // failed parse
      }
    }
    const list: SubOrderItem[] = [
      { id: `${order.id}-v`, metricType: 'VIEWS', quantity: order.baseViews, cost: 0, status: order.status, remains: order.status === 'COMPLETED' ? 0 : order.baseViews },
      { id: `${order.id}-l`, metricType: 'LIKES', quantity: order.likes, cost: 0, status: order.status, remains: order.status === 'COMPLETED' ? 0 : order.likes },
      { id: `${order.id}-s`, metricType: 'SAVES', quantity: order.saves, cost: 0, status: order.status, remains: order.status === 'COMPLETED' ? 0 : order.saves },
      { id: `${order.id}-sh`, metricType: 'SHARES', quantity: order.shares, cost: 0, status: order.status, remains: order.status === 'COMPLETED' ? 0 : order.shares },
      { id: `${order.id}-r`, metricType: 'REPOSTS', quantity: order.reposts, cost: 0, status: order.status, remains: order.status === 'COMPLETED' ? 0 : order.reposts },
      { id: `${order.id}-c`, metricType: 'COMMENTS', quantity: order.comments, cost: 0, status: order.status, remains: order.status === 'COMPLETED' ? 0 : order.comments },
      { id: `${order.id}-f`, metricType: 'FOLLOWERS', quantity: order.followers, cost: 0, status: order.status, remains: order.status === 'COMPLETED' ? 0 : order.followers },
    ];
    return list.filter((i) => i.quantity > 0);
  };

  const stats = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter((o) => o.status === 'COMPLETED').length;
    const inProgress = orders.filter((o) => o.status === 'PROCESSING' || o.status === 'PENDING').length;
    const totalDeliveredViews = orders
      .filter((o) => o.status === 'COMPLETED')
      .reduce((acc, o) => acc + (o.baseViews || 0), 0);

    return {
      total,
      completed,
      inProgress,
      totalDeliveredViews,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusMatch =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE'
          ? order.status === 'PENDING' || order.status === 'PROCESSING'
          : order.status.toUpperCase() === statusFilter);

      const q = searchQuery.toLowerCase().trim();
      const searchMatch =
        !q ||
        order.id.toLowerCase().includes(q) ||
        (order.targetReelUrl && order.targetReelUrl.toLowerCase().includes(q));

      return statusMatch && searchMatch;
    });
  }, [orders, statusFilter, searchQuery]);

  const getOrderStatusBadge = (status: string) => {
    const s = String(status || '').toUpperCase().trim();
    switch (s) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            COMPLETED
          </span>
        );
      case 'PROCESSING':
      case 'IN_PROGRESS':
      case 'IN PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-mono">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            PROCESSING
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono">
            PARTIAL
          </span>
        );
      case 'CANCELED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono">
            CANCELED
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 font-mono">
            <Clock className="w-3.5 h-3.5" />
            PENDING
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono">
            <AlertCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  const getSubOrderItemBadge = (status: string) => {
    const s = String(status || '').toUpperCase().trim();
    if (s === 'COMPLETED') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          Completed
        </span>
      );
    }
    if (s === 'PROCESSING' || s === 'IN_PROGRESS' || s === 'IN PROGRESS') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Processing
        </span>
      );
    }
    if (s === 'PARTIAL') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
          Partial
        </span>
      );
    }
    if (s === 'SKIPPED') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-slate-400 border border-slate-700">
          SKIPPED (Below Min Qty)
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
          Failed
        </span>
      );
    }
    if (s === 'CANCELED') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
          Canceled
        </span>
      );
    }
    // Default PENDING: amber/slate (never green)
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/10 text-amber-300/90 border border-amber-500/25">
        Pending
      </span>
    );
  };

  const getMetricIcon = (metricType: string) => {
    switch (metricType.toUpperCase()) {
      case 'LIKES':
        return <Heart className="w-4 h-4 text-rose-400" />;
      case 'SAVES':
        return <Bookmark className="w-4 h-4 text-amber-400" />;
      case 'SHARES':
        return <Share2 className="w-4 h-4 text-sky-400" />;
      case 'REPOSTS':
        return <Repeat2 className="w-4 h-4 text-emerald-400" />;
      case 'COMMENTS':
        return <MessageCircle className="w-4 h-4 text-purple-400" />;
      case 'FOLLOWERS':
      case 'FOLLOWS':
        return <UserPlus className="w-4 h-4 text-fuchsia-400" />;
      case 'VIEWERS':
      case 'REACH':
        return <Layers className="w-4 h-4 text-blue-400" />;
      case 'VIEWS':
      default:
        return <Eye className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-fuchsia-600 text-white shadow-md shadow-indigo-600/30">
              <Activity className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Live Order Tracking Dashboard
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time delivery progress, start counts, remaining quantities, and completion states
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => syncAndFetchOrders(true)}
            disabled={loading || syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Refresh Status'}</span>
          </button>

          <Link
            href="/order"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white shadow-lg shadow-indigo-600/30 transition"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Place New Order</span>
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-lg">
          <span className="text-[11px] text-slate-400 flex items-center justify-between">
            Total Campaigns
            <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
            {stats.total.toLocaleString()}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-lg">
          <span className="text-[11px] text-slate-400 flex items-center justify-between">
            Live Delivering
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-indigo-400 mt-1">
            {stats.inProgress.toLocaleString()}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-lg">
          <span className="text-[11px] text-slate-400 flex items-center justify-between">
            Completed
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1">
            {stats.completed.toLocaleString()}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-lg">
          <span className="text-[11px] text-slate-400 flex items-center justify-between">
            Delivered Views
            <TrendingUp className="w-3.5 h-3.5 text-fuchsia-400" />
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-fuchsia-300 mt-1 truncate">
            {stats.totalDeliveredViews.toLocaleString()}
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
            placeholder="Search by Order ID or Reel URL..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-1 shrink-0" />
          {['ALL', 'ACTIVE', 'COMPLETED', 'PENDING'].map((status) => (
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

      {/* Orders Progress Tracking List */}
      {loading && orders.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#0e131f]/90 border border-slate-800/80">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium">Loading your campaigns from database...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 space-y-3">
          <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Orders Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            You haven’t placed any orders matching this criteria yet. Configure a campaign on our interactive order form to start tracking.
          </p>
          <div className="pt-2">
            <Link
              href="/order"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition"
            >
              <span>Create First Order</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const subItems = getSubOrders(order);
            const isExpanded = !!expandedOrders[order.id];

            const subItemDeliveries = subItems.map((item) => ({
              item,
              metrics: calculateSubOrderDelivery(item),
            }));

            const totalQuantity = subItems.reduce((acc, i) => acc + (i.quantity || 0), 0);
            const totalDelivered = subItemDeliveries.reduce((acc, d) => acc + d.metrics.delivered, 0);
            const totalRemains = subItemDeliveries.reduce((acc, d) => acc + d.metrics.effectiveRemains, 0);

            const rawOverall =
              totalQuantity > 0 ? Math.round((totalDelivered / totalQuantity) * 100) : 0;
            const overallProgress =
              order.status === 'COMPLETED'
                ? 100
                : Math.min(99, Math.max(0, rawOverall));

            const dateStr = new Date(order.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={order.id}
                className="rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl overflow-hidden transition hover:border-slate-700/80"
              >
                {/* Card Header & Overarching Summary */}
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white font-mono">
                            #{order.id.slice(-8)}
                          </span>
                          {getOrderStatusBadge(order.status)}
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Created on {dateStr}
                        </span>
                      </div>
                    </div>

                    {/* Target Reel Link */}
                    {order.targetReelUrl ? (
                      <a
                        href={order.targetReelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-blue-400 hover:text-blue-300 hover:border-slate-700 transition max-w-xs truncate"
                        title={order.targetReelUrl}
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{order.targetReelUrl}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No Target Reel URL attached</span>
                    )}
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Overall Campaign Delivery Progress</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {overallProgress}% Delivered
                      </span>
                    </div>

                    {/* The Progress Bar */}
                    <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-400 h-full rounded-full transition-all duration-700 shadow-md shadow-emerald-500/20"
                        style={{ width: `${overallProgress}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap justify-between items-center text-[10px] font-mono text-slate-400 pt-0.5 gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>Base Views: <strong className="text-white">{order.baseViews.toLocaleString()}</strong></span>
                        <span className="text-blue-400">Viewers (67.5%): <strong className="text-blue-300">{Math.round(order.baseViews * 0.675).toLocaleString()}</strong></span>
                        <span className="text-teal-400">Avg Watch Time: <strong className="text-teal-300">42s (0.7x)</strong></span>
                      </div>
                      <span>
                        {order.status === 'COMPLETED'
                          ? 'All items delivered successfully'
                          : `Estimated Remaining: ${totalRemains.toLocaleString()} metrics`}
                      </span>
                    </div>
                  </div>

                  {/* Expand/Collapse Toggle Button */}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs text-slate-400 font-mono">
                      {subItems.length} Dispatched Sub-Metrics (Views, Likes, Saves...)
                    </span>

                    <button
                      onClick={() => toggleExpand(order.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                    >
                      <span>{isExpanded ? 'Hide Metric Breakdown' : 'View Live Breakdown & Remains'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Sub-Orders Breakdown Section */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 bg-slate-950/90 border-t border-slate-800/80 space-y-3">
                    <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2">
                      <span>Live Metric Breakdown</span>
                      <span className="text-[11px] text-slate-500 font-normal font-mono">
                        Formula: ((Quantity - Remains) / Quantity) * 100
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {subItemDeliveries.map(({ item, metrics }, idx) => {
                        const quantity = item.quantity || 0;
                        const { effectiveRemains, delivered, progress: itemProgress } = metrics;

                        return (
                          <div
                            key={item.id || idx}
                            className="p-3.5 rounded-2xl bg-[#0e131f] border border-slate-800/90 space-y-2 hover:border-slate-700 transition"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getMetricIcon(item.metricType)}
                                <span className="font-bold text-xs text-white">
                                  {item.metricType}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  {quantity.toLocaleString()}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {getSubOrderItemBadge(item.status)}

                                {item.providerOrderId && (
                                  <span className="text-[10px] font-mono text-slate-500">
                                    #{item.providerOrderId}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Live Metric Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                                <span>
                                  Delivered: <strong className="text-slate-200">{delivered.toLocaleString()}</strong>
                                </span>
                                <span className="font-bold text-emerald-400">
                                  {itemProgress}%
                                </span>
                              </div>

                              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${itemProgress}%` }}
                                />
                              </div>
                            </div>

                            {/* Start Count & Remains Numbers */}
                            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-0.5 border-t border-slate-900">
                              <span>
                                Start Count: {item.startCount !== null && item.startCount !== undefined ? item.startCount.toLocaleString() : '—'}
                              </span>
                              <span className="text-amber-400/90 font-medium">
                                Remains: {effectiveRemains.toLocaleString()} / {quantity.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
