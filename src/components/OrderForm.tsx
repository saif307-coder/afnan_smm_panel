'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Heart,
  Bookmark,
  Share2,
  Repeat2,
  MessageCircle,
  UserPlus,
  Eye,
  Sliders,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Link2,
  Send,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Loader2,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import {
  calculateQuantities,
  DEFAULT_PERCENTAGES,
  MetricPercentages,
  CalculatedQuantities,
} from '@/utils/calculator';

interface AdminSettingsResponse {
  success: boolean;
  data?: {
    likesPercentage: number;
    savesPercentage: number;
    sharesPercentage: number;
    repostsPercentage: number;
    commentsPercentage: number;
    followsPercentage: number;
    viewersPercentage?: number;
    avgWatchTimeRatio?: number;
  };
}

const PRESET_VIEWS = [10000, 25000, 50000, 100000, 250000, 500000, 1000000];

export default function OrderForm() {
  // Base views state
  const [baseViews, setBaseViews] = useState<number>(100000);
  const [baseViewsInput, setBaseViewsInput] = useState<string>('100000');

  // Reel target URL
  const [reelUrl, setReelUrl] = useState<string>('');

  // Dynamic percentage state
  const [percentages, setPercentages] = useState<MetricPercentages>(DEFAULT_PERCENTAGES);
  
  // Track default percentages loaded from Phase 2 Admin API
  const [adminDefaults, setAdminDefaults] = useState<MetricPercentages>(DEFAULT_PERCENTAGES);
  const [isLoadedFromApi, setIsLoadedFromApi] = useState<boolean>(false);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);

  // Loading & Submission state (Phase 4)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderResult, setOrderResult] = useState<{
    success: boolean;
    message: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dispatch?: any;
  } | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (toast?.show) {
      const timer = setTimeout(() => {
        setToast((prev) => (prev ? { ...prev, show: false } : null));
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toast?.show]);

  // 1. Fetch default percentage ratios from Phase 2 Admin API (/api/admin/settings)
  useEffect(() => {
    let isMounted = true;
    async function fetchAdminSettings() {
      try {
        setLoadingSettings(true);
        const res = await fetch('/api/admin/settings');
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data: AdminSettingsResponse = await res.json();
        
        if (data.success && data.data && isMounted) {
          const loaded: MetricPercentages = {
            likesPercentage: Number(data.data.likesPercentage) || DEFAULT_PERCENTAGES.likesPercentage,
            savesPercentage: Number(data.data.savesPercentage) || DEFAULT_PERCENTAGES.savesPercentage,
            sharesPercentage: Number(data.data.sharesPercentage) || DEFAULT_PERCENTAGES.sharesPercentage,
            repostsPercentage: Number(data.data.repostsPercentage) || DEFAULT_PERCENTAGES.repostsPercentage,
            commentsPercentage: Number(data.data.commentsPercentage) || DEFAULT_PERCENTAGES.commentsPercentage,
            followsPercentage: Number(data.data.followsPercentage) || DEFAULT_PERCENTAGES.followsPercentage,
            viewersPercentage: Number(data.data.viewersPercentage) || DEFAULT_PERCENTAGES.viewersPercentage,
          };
          setAdminDefaults(loaded);
          setPercentages(loaded);
          setIsLoadedFromApi(true);
        }
      } catch (err) {
        console.warn('Could not load admin settings, using built-in defaults:', err);
      } finally {
        if (isMounted) setLoadingSettings(false);
      }
    }

    fetchAdminSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Highly Optimized Real-Time Calculations (useMemo)
  // Computes in < 0.05ms on any input change without UI lag
  const calculated: CalculatedQuantities = useMemo(() => {
    return calculateQuantities(baseViews, percentages);
  }, [baseViews, percentages]);

  // Handle Base Views Input changes
  const handleViewsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    setBaseViewsInput(rawVal);
    const num = parseInt(rawVal, 10);
    setBaseViews(Number.isNaN(num) ? 0 : Math.max(0, num));
  }, []);

  // Handle preset clicks
  const handlePresetClick = useCallback((preset: number) => {
    setBaseViews(preset);
    setBaseViewsInput(preset.toString());
  }, []);

  // Handle individual percentage change
  const handlePercentageChange = useCallback((field: keyof MetricPercentages, value: number) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    setPercentages((prev) => ({
      ...prev,
      [field]: clamped,
    }));
  }, []);

  // Reset to Admin Defaults
  const handleResetToDefaults = useCallback(() => {
    setPercentages(adminDefaults);
  }, [adminDefaults]);

  // Phase 4: Submit Bundled Order to POST /api/orders with Automated Provider Dispatch
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (baseViews <= 0) {
      setToast({
        show: true,
        type: 'error',
        title: 'Invalid Base Views',
        message: 'Please enter a valid base view count greater than 0.',
      });
      return;
    }

    setIsSubmitting(true);
    setOrderResult(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetReelUrl: reelUrl.trim() || undefined,
          baseViews,
          percentages,
          autoDispatch: true,
        }),
      });

      const json = await res.json();

      if (!res.ok && !json.data) {
        throw new Error(json.error || 'Failed to submit order');
      }

      setOrderResult(json);

      const status = json.dispatch?.overallStatus;
      if (status === 'COMPLETED') {
        setToast({
          show: true,
          type: 'success',
          title: 'Order Dispatched Successfully!',
          message: `All services placed with provider. Total Cost: $${Number(json.dispatch.totalCost || 0).toFixed(4)}`,
        });
      } else if (status === 'PARTIAL') {
        setToast({
          show: true,
          type: 'info',
          title: 'Order Partially Dispatched',
          message: `${json.dispatch.successfulItems} services succeeded, ${json.dispatch.failedItems} failed. Check dispatch logs below.`,
        });
      } else {
        // Logged in DB, provider rejected (e.g. balance 0)
        setToast({
          show: true,
          type: 'info',
          title: 'Order Recorded in Database',
          message: json.data?.errorMessage
            ? `Provider status: ${json.data.errorMessage}`
            : 'Order saved in DB. Provider dispatch failed (see report below).',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({
        show: true,
        type: 'error',
        title: 'Order Submission Error',
        message: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-fuchsia-600/10 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-blue-600/10 via-indigo-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                Dynamic Order Dispatcher
              </h1>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300">
                Phase 3 Real-Time Engine
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              Real-time mathematical breakdown synced with Admin settings. Adjust base views and dynamic engagement ratios with instant DOM reactivity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/40 text-xs font-semibold text-emerald-300 hover:text-white transition shadow-sm"
              title="Track live progress of all dispatched orders"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Tracker</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                {loadingSettings
                  ? 'Loading Admin Ratios...'
                  : isLoadedFromApi
                  ? 'Admin Ratios Synced'
                  : 'Built-in Ratios'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 shadow-sm"
              title="Reset percentages to Admin settings"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Controls (Left) + Real-Time DOM Metric Cards (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: Controls & Dynamic Percentages (7 Cols)           */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. Base Views Input Card */}
            <div className="p-6 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">1. Base Value (Views)</h2>
                    <p className="text-xs text-slate-400">Target baseline views for dynamic metric distribution</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Formatted: </span>
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {baseViews.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Input & Formatted Counter */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    id="base-views-input"
                    value={baseViewsInput}
                    onChange={handleViewsChange}
                    placeholder="Enter views, e.g. 100000"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white font-mono text-lg transition outline-none"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Views
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 font-medium">Quick Presets:</span>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_VIEWS.map((preset) => {
                      const isSelected = baseViews === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handlePresetClick(preset)}
                          className={`px-3 py-1 text-xs font-mono font-medium rounded-lg transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                              : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                          }`}
                        >
                          {preset >= 1000000
                            ? `${preset / 1000000}M`
                            : `${preset / 1000}K`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Adjustable Dynamic Percentage Ratios Card */}
            <div className="p-6 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">2. Adjustable Ratios (%)</h2>
                    <p className="text-xs text-slate-400">Tuned dynamically per campaign — Real-time recalculation</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Instant Reactive</span>
                </div>
              </div>

              {/* Sliders and Numerical Inputs for all 6 core metrics */}
              <div className="space-y-4">
                {/* Likes % */}
                <PercentageControlRow
                  icon={<Heart className="w-4 h-4 text-rose-400" />}
                  label="Likes Percentage"
                  value={percentages.likesPercentage}
                  defaultValue={adminDefaults.likesPercentage}
                  min={0.1}
                  max={20}
                  step={0.1}
                  colorClass="accent-rose-500"
                  badgeColor="bg-rose-500/10 text-rose-300 border-rose-500/20"
                  onChange={(val) => handlePercentageChange('likesPercentage', val)}
                  calculatedQuantity={calculated.likes}
                />

                {/* Saves % */}
                <PercentageControlRow
                  icon={<Bookmark className="w-4 h-4 text-amber-400" />}
                  label="Saves Percentage"
                  value={percentages.savesPercentage}
                  defaultValue={adminDefaults.savesPercentage}
                  min={0.1}
                  max={15}
                  step={0.1}
                  colorClass="accent-amber-500"
                  badgeColor="bg-amber-500/10 text-amber-300 border-amber-500/20"
                  onChange={(val) => handlePercentageChange('savesPercentage', val)}
                  calculatedQuantity={calculated.saves}
                />

                {/* Shares % */}
                <PercentageControlRow
                  icon={<Share2 className="w-4 h-4 text-sky-400" />}
                  label="Shares Percentage"
                  value={percentages.sharesPercentage}
                  defaultValue={adminDefaults.sharesPercentage}
                  min={0.05}
                  max={10}
                  step={0.05}
                  colorClass="accent-sky-500"
                  badgeColor="bg-sky-500/10 text-sky-300 border-sky-500/20"
                  onChange={(val) => handlePercentageChange('sharesPercentage', val)}
                  calculatedQuantity={calculated.shares}
                />

                {/* Reposts % */}
                <PercentageControlRow
                  icon={<Repeat2 className="w-4 h-4 text-emerald-400" />}
                  label="Reposts Percentage"
                  value={percentages.repostsPercentage}
                  defaultValue={adminDefaults.repostsPercentage}
                  min={0.01}
                  max={5}
                  step={0.01}
                  colorClass="accent-emerald-500"
                  badgeColor="bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                  onChange={(val) => handlePercentageChange('repostsPercentage', val)}
                  calculatedQuantity={calculated.reposts}
                />

                {/* Comments % */}
                <PercentageControlRow
                  icon={<MessageCircle className="w-4 h-4 text-purple-400" />}
                  label="Comments Percentage"
                  value={percentages.commentsPercentage}
                  defaultValue={adminDefaults.commentsPercentage}
                  min={0.01}
                  max={3}
                  step={0.01}
                  colorClass="accent-purple-500"
                  badgeColor="bg-purple-500/10 text-purple-300 border-purple-500/20"
                  onChange={(val) => handlePercentageChange('commentsPercentage', val)}
                  calculatedQuantity={calculated.comments}
                />

                {/* Followers % */}
                <PercentageControlRow
                  icon={<UserPlus className="w-4 h-4 text-fuchsia-400" />}
                  label="Followers Percentage"
                  value={percentages.followsPercentage}
                  defaultValue={adminDefaults.followsPercentage}
                  min={0.005}
                  max={1}
                  step={0.005}
                  colorClass="accent-fuchsia-500"
                  badgeColor="bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20"
                  onChange={(val) => handlePercentageChange('followsPercentage', val)}
                  calculatedQuantity={calculated.followers}
                />
              </div>
            </div>

            {/* 3. Target Reel URL & Submit Action */}
            <div className="p-6 rounded-2xl bg-[#0e131f]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">3. Instagram Reel URL</h2>
                  <p className="text-xs text-slate-400">Target media link for batch order generation</p>
                </div>
              </div>

              <input
                type="url"
                value={reelUrl}
                onChange={(e) => setReelUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/C7xY9z0A1b2/"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm transition outline-none"
              />

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 hover:from-blue-500 hover:via-indigo-500 hover:to-fuchsia-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition shadow-lg shadow-indigo-600/30"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Dispatching to SMM Provider...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Place & Dispatch Order</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Real-Time DOM Calculated Quantities (5 Cols)     */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Real-time Order Summary Card */}
          <div className="p-6 rounded-2xl bg-[#0e131f]/90 border border-slate-800/90 shadow-2xl backdrop-blur-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Live Calculated Quantities</h2>
                  <p className="text-xs text-slate-400">Updates instantly on keystroke</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                DOM Synced
              </span>
            </div>

            {/* Overall Engagement Rate Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900/90 via-indigo-950/30 to-purple-950/30 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Total Engagement
                </div>
                <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
                  {calculated.totalEngagement.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Across all interactive actions
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Engagement Rate
                </div>
                <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-0.5">
                  {calculated.engagementRate}%
                </div>
                <div className="text-[11px] text-emerald-400/80 mt-0.5 flex items-center justify-end gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>High Authenticity</span>
                </div>
              </div>
            </div>

            {/* 6 Metric Output Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Likes Card */}
              <MetricDisplayCard
                icon={<Heart className="w-4 h-4 text-rose-400" />}
                label="Likes"
                value={calculated.likes}
                percentage={percentages.likesPercentage}
                colorBorder="border-rose-500/30 hover:border-rose-500/60"
                glowColor="from-rose-500/10"
                textColor="text-rose-400"
              />

              {/* Saves Card */}
              <MetricDisplayCard
                icon={<Bookmark className="w-4 h-4 text-amber-400" />}
                label="Saves"
                value={calculated.saves}
                percentage={percentages.savesPercentage}
                colorBorder="border-amber-500/30 hover:border-amber-500/60"
                glowColor="from-amber-500/10"
                textColor="text-amber-400"
              />

              {/* Shares Card */}
              <MetricDisplayCard
                icon={<Share2 className="w-4 h-4 text-sky-400" />}
                label="Shares"
                value={calculated.shares}
                percentage={percentages.sharesPercentage}
                colorBorder="border-sky-500/30 hover:border-sky-500/60"
                glowColor="from-sky-500/10"
                textColor="text-sky-400"
              />

              {/* Reposts Card */}
              <MetricDisplayCard
                icon={<Repeat2 className="w-4 h-4 text-emerald-400" />}
                label="Reposts"
                value={calculated.reposts}
                percentage={percentages.repostsPercentage}
                colorBorder="border-emerald-500/30 hover:border-emerald-500/60"
                glowColor="from-emerald-500/10"
                textColor="text-emerald-400"
              />

              {/* Comments Card */}
              <MetricDisplayCard
                icon={<MessageCircle className="w-4 h-4 text-purple-400" />}
                label="Comments"
                value={calculated.comments}
                percentage={percentages.commentsPercentage}
                colorBorder="border-purple-500/30 hover:border-purple-500/60"
                glowColor="from-purple-500/10"
                textColor="text-purple-400"
              />

              {/* Followers Card */}
              <MetricDisplayCard
                icon={<UserPlus className="w-4 h-4 text-fuchsia-400" />}
                label="Followers"
                value={calculated.followers}
                percentage={percentages.followsPercentage}
                colorBorder="border-fuchsia-500/30 hover:border-fuchsia-500/60"
                glowColor="from-fuchsia-500/10"
                textColor="text-fuchsia-400"
              />
            </div>

            {/* Estimated Reach & Viewers Insight */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Estimated Unique Viewers</span>
                </span>
                <span className="font-mono font-bold text-white">
                  {(calculated.viewers ?? Math.round(baseViews * 0.675)).toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, percentages.viewersPercentage ?? 67.5)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Natural ratio: ~67.5% of total views count as unique accounts reached.
              </p>
            </div>
          </div>

          {/* Toast Notification Alert */}
          {toast?.show && (
            <div
              className={`p-4 rounded-2xl border shadow-2xl flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-300 ${
                toast.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                  : toast.type === 'error'
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                  : 'bg-indigo-950/80 border-indigo-500/50 text-indigo-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-white/10 shrink-0 mt-0.5">
                  {toast.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : toast.type === 'error' ? (
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Info className="w-5 h-5 text-indigo-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{toast.title}</h4>
                  <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{toast.message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToast((prev) => (prev ? { ...prev, show: false } : null))}
                className="text-xs opacity-70 hover:opacity-100 px-2 py-1 rounded bg-black/20"
              >
                ✕
              </button>
            </div>
          )}

          {/* Detailed SMM Provider Dispatch Report (Phase 4) */}
          {orderResult?.data && (
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-xl ${
                      orderResult.data.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : orderResult.data.status === 'PARTIAL'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {orderResult.data.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : orderResult.data.status === 'PARTIAL' ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <Info className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      Order #{orderResult.data.id.slice(-8)}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Target Reel: {orderResult.data.targetReelUrl || 'Default Session Reel'}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold uppercase tracking-wider ${
                    orderResult.data.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : orderResult.data.status === 'PARTIAL'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {orderResult.data.status}
                </span>
              </div>

              {/* Provider Info Banner */}
              <div className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-slate-400">
                  Provider:{' '}
                  <strong className="text-slate-200">
                    {orderResult.dispatch?.providerName || 'smmproprovider.online'}
                  </strong>
                </div>
                <div className="text-slate-400">
                  Total Billed:{' '}
                  <strong className="text-emerald-400 font-mono">
                    ${Number(orderResult.data.totalCost || 0).toFixed(4)}
                  </strong>
                </div>
              </div>

              {/* Dispatch Items Breakdown */}
              {orderResult.dispatch?.items && orderResult.dispatch.items.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Bundle Dispatch Splitting Breakdown:
                  </div>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {orderResult.dispatch.items.map(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (item: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                item.status === 'SUCCESS'
                                  ? 'bg-emerald-400'
                                  : item.status === 'SKIPPED'
                                  ? 'bg-slate-500'
                                  : 'bg-rose-400'
                              }`}
                            />
                            <span className="font-bold text-white">{item.metricType}</span>
                            <span className="text-slate-400">
                              (Qty: {item.quantity.toLocaleString()} | Svc #{item.serviceId})
                            </span>
                          </div>

                          <div className="text-right">
                            {item.status === 'SUCCESS' ? (
                              <span className="text-emerald-400 font-bold">
                                Order #{item.providerOrderId}
                              </span>
                            ) : item.status === 'SKIPPED' ? (
                              <span className="text-amber-400/90 text-[11px] font-medium max-w-[180px] truncate block font-sans" title={item.error}>
                                {item.error || 'Skipped (Below Min)'}
                              </span>
                            ) : (
                              <span className="text-rose-400 text-[11px] max-w-[180px] truncate block" title={item.error}>
                                {item.error || 'Failed'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Direct Live Tracker Link CTA */}
              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 text-white font-semibold text-xs tracking-wide uppercase transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
                >
                  <Activity className="w-4 h-4 text-emerald-200 animate-pulse" />
                  <span>Open Live Order Tracking Dashboard (Phase 7) →</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-Components ────────────────────────────────────────────────────────────

interface PercentageControlRowProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  colorClass: string;
  badgeColor: string;
  onChange: (val: number) => void;
  calculatedQuantity: number;
}

function PercentageControlRow({
  icon,
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  colorClass,
  badgeColor,
  onChange,
  calculatedQuantity,
}: PercentageControlRowProps) {
  const isModified = Math.abs(value - defaultValue) > 0.001;

  return (
    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-slate-200">{label}</span>
          {isModified && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">
              Custom
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">
            = <strong className="text-white">{calculatedQuantity.toLocaleString()}</strong>
          </span>
          <div className="relative">
            <input
              type="number"
              step={step}
              min={min}
              max={max}
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-right text-xs font-mono font-bold rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
            />
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none pr-1">
              %
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer ${colorClass}`}
        />
      </div>
    </div>
  );
}

interface MetricDisplayCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  percentage: number;
  colorBorder: string;
  glowColor: string;
  textColor: string;
}

function MetricDisplayCard({
  icon,
  label,
  value,
  percentage,
  colorBorder,
  glowColor,
  textColor,
}: MetricDisplayCardProps) {
  return (
    <div
      className={`relative p-3.5 rounded-xl bg-gradient-to-b ${glowColor} to-slate-950/90 border ${colorBorder} transition-all duration-200 shadow-sm`}
    >
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium text-slate-300">{label}</span>
        {icon}
      </div>
      <div className={`text-xl font-extrabold font-mono mt-1 ${textColor}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
        {percentage}% of views
      </div>
    </div>
  );
}
