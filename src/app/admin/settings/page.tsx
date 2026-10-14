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
  updatedAt?: string;
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
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettingsData>(RECOMMENDED_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    setSettings(RECOMMENDED_DEFAULTS);
    setToast({
      show: true,
      type: 'success',
      message: 'Reset form to recommended Instagram engagement baselines.',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
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
            <div className="p-2 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white">
              <Sliders className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Global Ratio Settings
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Define default engagement percentages auto-loaded into client order forms
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Recommended</span>
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
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
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

      {/* Main Grid: Form Controls (Left) + Live Simulation (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Settings (7 Cols) */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSave} className="p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl space-y-6">
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

        {/* Right Column: Live Simulation Card (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              <h3 className="font-bold text-white text-sm">Simulation Preview (100,000 Views)</h3>
            </div>
            <p className="text-xs text-slate-400">
              Shows the exact quantities that will be auto-generated for a standard 100K order using your settings above.
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
