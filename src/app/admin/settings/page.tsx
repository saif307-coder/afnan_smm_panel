'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Sliders,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Heart,
  Bookmark,
  Share2,
  Repeat2,
  MessageCircle,
  UserPlus,
  Eye,
  Clock,
  Zap,
  Activity,
  Play,
  RefreshCw,
  Power,
  ShieldCheck,
  ShieldAlert,
  Server,
  Terminal,
} from 'lucide-react';
import { calculateQuantities } from '@/utils/calculator';

interface AdminSettingsData {
  id?: string;
  likesPercentage: number;
  savesPercentage: number;
  sharesPercentage: number;
  repostsPercentage: number;
  commentsPercentage: number;
  followsPercentage: number;
  viewersPercentage: number;
  avgWatchTimeRatio: number;
  CRON_STATUS_SYNC_ACTIVE: boolean;
  updatedAt?: string;
}

interface SyncResponseData {
  success: boolean;
  message: string;
  active?: boolean;
  timestamp?: string;
  durationMs?: number;
  syncedOrdersCount?: number;
  updatedOrdersCount?: number;
  error?: string;
  details?: Array<{
    orderId: string;
    previousStatus: string;
    newStatus: string;
    updatedItems: number;
  }>;
}

const RECOMMENDED_DEFAULTS: AdminSettingsData = {
  likesPercentage: 3.4,
  savesPercentage: 2.8,
  sharesPercentage: 0.95,
  repostsPercentage: 0.35,
  commentsPercentage: 0.12,
  followsPercentage: 0.025,
  viewersPercentage: 67.5,
  avgWatchTimeRatio: 0.7,
  CRON_STATUS_SYNC_ACTIVE: true,
};

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'ratios' | 'cron'>('ratios');
  const [settings, setSettings] = useState<AdminSettingsData>(RECOMMENDED_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingCron, setTogglingCron] = useState(false);
  const [runningSync, setRunningSync] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResponseData | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.data) {
        setSettings({
          likesPercentage: Number(data.data.likesPercentage) || RECOMMENDED_DEFAULTS.likesPercentage,
          savesPercentage: Number(data.data.savesPercentage) || RECOMMENDED_DEFAULTS.savesPercentage,
          sharesPercentage: Number(data.data.sharesPercentage) || RECOMMENDED_DEFAULTS.sharesPercentage,
          repostsPercentage: Number(data.data.repostsPercentage) || RECOMMENDED_DEFAULTS.repostsPercentage,
          commentsPercentage: Number(data.data.commentsPercentage) || RECOMMENDED_DEFAULTS.commentsPercentage,
          followsPercentage: Number(data.data.followsPercentage) || RECOMMENDED_DEFAULTS.followsPercentage,
          viewersPercentage: Number(data.data.viewersPercentage) || RECOMMENDED_DEFAULTS.viewersPercentage,
          avgWatchTimeRatio: Number(data.data.avgWatchTimeRatio) || RECOMMENDED_DEFAULTS.avgWatchTimeRatio,
          CRON_STATUS_SYNC_ACTIVE:
            data.data.CRON_STATUS_SYNC_ACTIVE !== undefined
              ? Boolean(data.data.CRON_STATUS_SYNC_ACTIVE)
              : true,
          updatedAt: data.data.updatedAt,
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleFieldChange = (field: keyof AdminSettingsData, val: number) => {
    setSettings((prev) => ({
      ...prev,
      [field]: Math.max(0, val),
    }));
  };

  const handleReset = () => {
    setSettings((prev) => ({
      ...RECOMMENDED_DEFAULTS,
      CRON_STATUS_SYNC_ACTIVE: prev.CRON_STATUS_SYNC_ACTIVE,
    }));
    setToast({
      show: true,
      type: 'success',
      message: 'Reset form to recommended Instagram engagement baselines.',
    });
  };

  const handleSaveRatios = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToast(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setSettings((prev) => ({
        ...prev,
        ...data.data,
      }));

      setToast({
        show: true,
        type: 'success',
        message: 'Global default engagement settings saved and deployed to live Order Form!',
      });
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      });
    } finally {
      setSaving(false);
    }
  };

  // Instant Kill-Switch Toggle Handler
  const handleToggleCron = async (newVal: boolean) => {
    setTogglingCron(true);
    setToast(null);

    // Optimistic UI update
    setSettings((prev) => ({ ...prev, CRON_STATUS_SYNC_ACTIVE: newVal }));

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ CRON_STATUS_SYNC_ACTIVE: newVal }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update cron status in database');
      }

      setToast({
        show: true,
        type: 'success',
        message: newVal
          ? 'Background Cron Job ENABLED: Vercel triggers will now sync order states.'
          : 'Kill Switch ACTIVE: Background Cron is now PAUSED (all incoming cron triggers will be safely ignored).',
      });
    } catch (err) {
      // Revert on failure
      setSettings((prev) => ({ ...prev, CRON_STATUS_SYNC_ACTIVE: !newVal }));
      setToast({
        show: true,
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update cron kill switch',
      });
    } finally {
      setTogglingCron(false);
    }
  };

  // Run Sync Now Manual Trigger
  const handleRunSyncNow = async () => {
    setRunningSync(true);
    setSyncResult(null);
    setToast(null);

    try {
      const res = await fetch('/api/cron/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data: SyncResponseData = await res.json();
      setSyncResult(data);

      if (data.message === 'Cron is paused by Admin' || data.active === false) {
        setToast({
          show: true,
          type: 'error',
          message: 'Cron is paused by Admin! Kill Switch successfully intercepted the trigger.',
        });
      } else if (data.success) {
        setToast({
          show: true,
          type: 'success',
          message: `Manual sync completed: ${data.syncedOrdersCount ?? 0} orders processed (${data.updatedOrdersCount ?? 0} updated).`,
        });
      } else {
        throw new Error(data.error || 'Sync returned an unexpected status');
      }
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        message: err instanceof Error ? err.message : 'Sync execution failed',
      });
    } finally {
      setRunningSync(false);
    }
  };

  // Sample 100K view simulation based on current settings
  const sampleCalc = useMemo(() => {
    return calculateQuantities(100000, settings);
  }, [settings]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white shadow-md shadow-fuchsia-600/20">
              <Sliders className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              System Settings & Automation
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Configure global metric baselines and manage automated background cron jobs
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'ratios' && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Recommended</span>
            </button>
          )}

          {activeTab === 'cron' && (
            <button
              type="button"
              onClick={handleRunSyncNow}
              disabled={runningSync}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {runningSync ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Sync Now</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800/80 gap-2">
        <button
          onClick={() => setActiveTab('ratios')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'ratios'
              ? 'border-indigo-500 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span>Engagement Ratios</span>
        </button>

        <button
          onClick={() => setActiveTab('cron')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'cron'
              ? 'border-fuchsia-500 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <Activity className="w-4 h-4 text-fuchsia-400" />
          <span>Cron Management & Kill Switch</span>
          <span
            className={`w-2 h-2 rounded-full ${
              settings.CRON_STATUS_SYNC_ACTIVE
                ? 'bg-emerald-400 animate-pulse'
                : 'bg-rose-500'
            }`}
          />
        </button>
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

      {/* TAB 1: ENGAGEMENT RATIOS */}
      {activeTab === 'ratios' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form Settings (7 Cols) */}
          <div className="lg:col-span-7">
            <form
              onSubmit={handleSaveRatios}
              className="p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white">Engagement Ratio Baseline</h2>
                  <p className="text-xs text-slate-400">Ratios apply proportionally to incoming base views</p>
                </div>
                <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  Prisma Synchronized
                </span>
              </div>

              <div className="space-y-4">
                {/* Likes % */}
                <SettingInputRow
                  icon={<Heart className="w-4 h-4 text-rose-400" />}
                  label="Default Likes Ratio"
                  subLabel="Recommended: 3.0% – 4.5%"
                  value={settings.likesPercentage}
                  step={0.1}
                  min={0}
                  max={25}
                  colorClass="accent-rose-500"
                  onChange={(val) => handleFieldChange('likesPercentage', val)}
                />

                {/* Saves % */}
                <SettingInputRow
                  icon={<Bookmark className="w-4 h-4 text-amber-400" />}
                  label="Default Saves Ratio"
                  subLabel="Recommended: 2.0% – 3.5%"
                  value={settings.savesPercentage}
                  step={0.1}
                  min={0}
                  max={20}
                  colorClass="accent-amber-500"
                  onChange={(val) => handleFieldChange('savesPercentage', val)}
                />

                {/* Shares % */}
                <SettingInputRow
                  icon={<Share2 className="w-4 h-4 text-sky-400" />}
                  label="Default Shares Ratio"
                  subLabel="Recommended: 0.5% – 1.5%"
                  value={settings.sharesPercentage}
                  step={0.05}
                  min={0}
                  max={10}
                  colorClass="accent-sky-500"
                  onChange={(val) => handleFieldChange('sharesPercentage', val)}
                />

                {/* Reposts % */}
                <SettingInputRow
                  icon={<Repeat2 className="w-4 h-4 text-emerald-400" />}
                  label="Default Reposts Ratio"
                  subLabel="Recommended: 0.2% – 0.6%"
                  value={settings.repostsPercentage}
                  step={0.01}
                  min={0}
                  max={5}
                  colorClass="accent-emerald-500"
                  onChange={(val) => handleFieldChange('repostsPercentage', val)}
                />

                {/* Comments % */}
                <SettingInputRow
                  icon={<MessageCircle className="w-4 h-4 text-purple-400" />}
                  label="Default Comments Ratio"
                  subLabel="Recommended: 0.08% – 0.25%"
                  value={settings.commentsPercentage}
                  step={0.01}
                  min={0}
                  max={3}
                  colorClass="accent-purple-500"
                  onChange={(val) => handleFieldChange('commentsPercentage', val)}
                />

                {/* Followers % */}
                <SettingInputRow
                  icon={<UserPlus className="w-4 h-4 text-fuchsia-400" />}
                  label="Default Followers Ratio"
                  subLabel="Recommended: 0.02% – 0.03% (20-30 per 100K)"
                  value={settings.followsPercentage}
                  step={0.005}
                  min={0}
                  max={1}
                  colorClass="accent-fuchsia-500"
                  onChange={(val) => handleFieldChange('followsPercentage', val)}
                />

                {/* Viewers % */}
                <SettingInputRow
                  icon={<Eye className="w-4 h-4 text-blue-400" />}
                  label="Default Unique Viewers Ratio"
                  subLabel="Natural Instagram baseline: 65% – 70%"
                  value={settings.viewersPercentage}
                  step={0.5}
                  min={10}
                  max={100}
                  colorClass="accent-blue-500"
                  onChange={(val) => handleFieldChange('viewersPercentage', val)}
                />

                {/* Watch Time Ratio */}
                <SettingInputRow
                  icon={<Clock className="w-4 h-4 text-amber-400" />}
                  label="Average Watch Time Ratio"
                  subLabel="Relative to video duration (0.7 = 42s per 60s)"
                  value={settings.avgWatchTimeRatio}
                  step={0.05}
                  min={0.1}
                  max={1.0}
                  isRatio
                  colorClass="accent-amber-500"
                  onChange={(val) => handleFieldChange('avgWatchTimeRatio', val)}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 hover:from-blue-500 hover:via-indigo-500 hover:to-fuchsia-500 active:scale-[0.98] disabled:opacity-60 transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Global Settings...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Global Settings</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Simulation Card + Cron Status Pill */}
          <div className="lg:col-span-5 space-y-6">
            {/* Quick Cron Status Snapshot Card */}
            <div className="p-5 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-2xl ${
                    settings.CRON_STATUS_SYNC_ACTIVE
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Cron Sync Engine</div>
                  <div className="text-[11px] text-slate-400">
                    Status:{' '}
                    <span
                      className={`font-semibold ${
                        settings.CRON_STATUS_SYNC_ACTIVE ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {settings.CRON_STATUS_SYNC_ACTIVE ? 'Active' : 'Paused (Kill Switch)'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('cron')}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
              >
                Manage Cron →
              </button>
            </div>

            {/* Simulation Preview */}
            <div className="p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
                <h3 className="font-bold text-white text-sm">Simulation Preview (100,000 Views)</h3>
              </div>
              <p className="text-xs text-slate-400">
                Shows the exact quantities that will be auto-generated for a standard 100K order using your settings.
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400 text-[10px] flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-400" /> Likes ({settings.likesPercentage}%)
                  </span>
                  <span className="text-rose-400 font-extrabold text-base block mt-0.5">
                    {sampleCalc.likes.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400 text-[10px] flex items-center gap-1">
                    <Bookmark className="w-3 h-3 text-amber-400" /> Saves ({settings.savesPercentage}%)
                  </span>
                  <span className="text-amber-400 font-extrabold text-base block mt-0.5">
                    {sampleCalc.saves.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400 text-[10px] flex items-center gap-1">
                    <Share2 className="w-3 h-3 text-sky-400" /> Shares ({settings.sharesPercentage}%)
                  </span>
                  <span className="text-sky-400 font-extrabold text-base block mt-0.5">
                    {sampleCalc.shares.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400 text-[10px] flex items-center gap-1">
                    <Repeat2 className="w-3 h-3 text-emerald-400" /> Reposts ({settings.repostsPercentage}%)
                  </span>
                  <span className="text-emerald-400 font-extrabold text-base block mt-0.5">
                    {sampleCalc.reposts.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400 text-[10px] flex items-center gap-1">
                    <MessageCircle className="w-3 h-3 text-purple-400" /> Comments ({settings.commentsPercentage}%)
                  </span>
                  <span className="text-purple-400 font-extrabold text-base block mt-0.5">
                    {sampleCalc.comments.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400 text-[10px] flex items-center gap-1">
                    <UserPlus className="w-3 h-3 text-fuchsia-400" /> Follows ({settings.followsPercentage}%)
                  </span>
                  <span className="text-fuchsia-400 font-extrabold text-base block mt-0.5">
                    {sampleCalc.followers.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950/30 to-purple-950/30 border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Engagement</span>
                  <div className="text-lg font-bold text-white font-mono">{sampleCalc.totalEngagement.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Engagement Rate</span>
                  <div className="text-lg font-bold text-emerald-400 font-mono">{sampleCalc.engagementRate}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CRON MANAGEMENT & KILL SWITCH */}
      {activeTab === 'cron' && (
        <div className="space-y-6">
          {/* Main Control Card: Toggle Switch + Manual Run */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-2xl ${
                      settings.CRON_STATUS_SYNC_ACTIVE
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    <Power className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      <span>Background Cron Kill-Switch</span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                          settings.CRON_STATUS_SYNC_ACTIVE
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {settings.CRON_STATUS_SYNC_ACTIVE ? 'RUNNING' : 'PAUSED'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Instantly pause or resume automated background polling from the database
                    </p>
                  </div>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center gap-3 bg-slate-950/80 p-2 rounded-2xl border border-slate-800 self-start sm:self-auto">
                <span className="text-xs font-semibold text-slate-300 pl-2">
                  {settings.CRON_STATUS_SYNC_ACTIVE ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.CRON_STATUS_SYNC_ACTIVE}
                  disabled={togglingCron}
                  onClick={() => handleToggleCron(!settings.CRON_STATUS_SYNC_ACTIVE)}
                  className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    settings.CRON_STATUS_SYNC_ACTIVE ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <span className="sr-only">Toggle Background Cron Job</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      settings.CRON_STATUS_SYNC_ACTIVE ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Status Details / Notice */}
            {settings.CRON_STATUS_SYNC_ACTIVE ? (
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-200 space-y-1">
                  <div className="font-bold">Automated Sync is Active</div>
                  <div className="text-emerald-300/80">
                    Vercel Cron triggers the synchronization endpoint every 10 minutes. Orders in{' '}
                    <code className="text-emerald-300 bg-emerald-900/40 px-1 py-0.5 rounded">PENDING</code> or{' '}
                    <code className="text-emerald-300 bg-emerald-900/40 px-1 py-0.5 rounded">PROCESSING</code>{' '}
                    status are checked with external SMM providers and updated automatically.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-200 space-y-1">
                  <div className="font-bold">Kill-Switch is Active (Cron Paused)</div>
                  <div className="text-rose-300/80">
                    All incoming triggers from Vercel are intercepted immediately at the top of{' '}
                    <code className="text-rose-300 bg-rose-900/40 px-1 py-0.5 rounded">/api/cron/sync</code> and return{' '}
                    <code className="text-rose-300 bg-rose-900/40 px-1 py-0.5 rounded">200 OK: Cron is paused by Admin</code>. No
                    external provider requests or database modifications will occur until re-enabled.
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions & Trigger Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>On-Demand Manual Synchronization</span>
                </div>
                <div className="text-xs text-slate-400">
                  Trigger an immediate synchronization cycle without waiting for Vercel’s schedule.
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunSyncNow}
                disabled={runningSync}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 hover:from-blue-500 hover:via-indigo-500 hover:to-fuchsia-500 active:scale-95 disabled:opacity-50 transition shadow-lg shadow-indigo-600/30 shrink-0"
              >
                {runningSync ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing Sync Engine...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Run Sync Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Architecture Details & Console Output Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Configuration Metadata (5 Cols) */}
            <div className="lg:col-span-5 p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                <Server className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Cron Architecture Details</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Target Endpoint</span>
                  <code className="text-indigo-400 font-mono font-bold">/api/cron/sync</code>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Vercel Trigger Schedule</span>
                  <code className="text-fuchsia-400 font-mono font-bold">*/10 * * * * (10m)</code>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Trigger Source</span>
                  <span className="text-white font-medium">vercel.json Config</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Kill-Switch Storage</span>
                  <code className="text-emerald-400 font-mono font-bold">AdminSetting.CRON_STATUS_SYNC_ACTIVE</code>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Current Status</span>
                  <span
                    className={`font-mono font-bold ${
                      settings.CRON_STATUS_SYNC_ACTIVE ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {settings.CRON_STATUS_SYNC_ACTIVE ? 'ACTIVE (200 RUN)' : 'PAUSED (200 NOOP)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Live Execution Console Output (7 Cols) */}
            <div className="lg:col-span-7 p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Live Execution Console</h3>
                </div>
                {syncResult?.timestamp && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Last execution: {new Date(syncResult.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {syncResult ? (
                <div className="space-y-3 font-mono text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Response Status</span>
                      <span
                        className={`font-bold ${
                          syncResult.active === false || syncResult.message === 'Cron is paused by Admin'
                            ? 'text-amber-400'
                            : syncResult.success
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {syncResult.message === 'Cron is paused by Admin'
                          ? 'PAUSED'
                          : syncResult.success
                          ? 'SUCCESS'
                          : 'FAILED'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Orders Processed</span>
                      <span className="font-bold text-white">
                        {syncResult.syncedOrdersCount ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Execution Time</span>
                      <span className="font-bold text-sky-400">
                        {syncResult.durationMs !== undefined ? `${syncResult.durationMs}ms` : 'Immediate'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-2 overflow-x-auto">
                    <div className="text-[11px] text-slate-400 font-sans font-semibold">
                      Endpoint Response Payload:
                    </div>
                    <pre className="text-[11px] text-emerald-300 leading-relaxed">
                      {JSON.stringify(syncResult, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-slate-500 text-xs">
                  <Terminal className="w-8 h-8 text-slate-600 mb-1" />
                  <p className="font-medium text-slate-400">No sync execution recorded yet this session</p>
                  <p className="text-[11px] max-w-sm">
                    Click <span className="text-indigo-400 font-semibold">Run Sync Now</span> above to test the endpoint and see live response details.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SettingInputRowProps {
  icon: React.ReactNode;
  label: string;
  subLabel: string;
  value: number;
  step: number;
  min: number;
  max: number;
  isRatio?: boolean;
  colorClass: string;
  onChange: (val: number) => void;
}

function SettingInputRow({
  icon,
  label,
  subLabel,
  value,
  step,
  min,
  max,
  isRatio = false,
  colorClass,
  onChange,
}: SettingInputRowProps) {
  return (
    <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2 hover:border-slate-700/80 transition">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <div className="text-xs font-semibold text-white">{label}</div>
            <div className="text-[10px] text-slate-500">{subLabel}</div>
          </div>
        </div>

        <div className="relative">
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-24 px-2 py-1 text-right text-xs font-mono font-bold rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
          />
          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none pr-1">
            {isRatio ? 'x' : '%'}
          </span>
        </div>
      </div>

      <input
        type="range"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer ${colorClass}`}
      />
    </div>
  );
}
