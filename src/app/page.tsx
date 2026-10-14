'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  Eye,
  Users,
  Clock,
  UserPlus,
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Bookmark,
  RefreshCw,
  Globe,
  Sliders,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Code2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

interface CampaignData {
  id: string;
  reelUrl: string | null;
  collaborationText: string;
  videoDurationSeconds: number;
  views: number;
  viewers: number;
  avgWatchTimeSeconds: number;
  follows: number;
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
  saves: number;
  followersPercentage: number;
  nonFollowersPercentage: number;
  countriesJson: string;
  graphDataJson: string;
  serviceStatus: string;
  updatedAt: string;
}

interface CountryMetric {
  country: string;
  percentage: number;
}

interface GraphPoint {
  time: string;
  step: number;
  all: number;
  followers: number;
  nonFollowers: number;
}

export default function DashboardPreview() {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, startUpdateTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  // Form state
  const [viewsInput, setViewsInput] = useState<number>(100000);
  const [durationInput, setDurationInput] = useState<number>(60);
  const [likesInput, setLikesInput] = useState<number>(1500);
  const [commentsInput, setCommentsInput] = useState<number>(0);
  const [repostsInput, setRepostsInput] = useState<number>(15);
  const [sharesInput, setSharesInput] = useState<number>(49);
  const [savesInput, setSavesInput] = useState<number>(144);
  const [collabText, setCollabText] = useState<string>(
    'Collaboration with cinematic.edits.fx and songs_movies.byte'
  );
  const [countryFormat, setCountryFormat] = useState<'USA' | 'United States'>('USA');

  const fetchCurrent = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/campaigns/current');
      const json = await res.json();
      if (json.success && json.data) {
        syncState(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const syncState = (data: CampaignData) => {
    setCampaign(data);
    setViewsInput(data.views);
    setDurationInput(data.videoDurationSeconds);
    setLikesInput(data.likes);
    setCommentsInput(data.comments);
    setRepostsInput(data.reposts);
    setSharesInput(data.shares);
    setSavesInput(data.saves);
    setCollabText(data.collaborationText);
  };

  useEffect(() => {
    fetchCurrent();
  }, []);

  const handleUpdate = () => {
    startUpdateTransition(async () => {
      try {
        const res = await fetch('/api/campaigns/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            views: viewsInput,
            videoDurationSeconds: durationInput,
            likes: likesInput,
            comments: commentsInput,
            reposts: repostsInput,
            shares: sharesInput,
            saves: savesInput,
            collaborationText: collabText,
            countryLabelFormat: countryFormat,
          }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          syncState(json.data);
          setNotice('Engine recalculation synced successfully!');
          setTimeout(() => setNotice(null), 3000);
        }
      } catch (err) {
        console.error('Update failed', err);
      }
    });
  };

  const countries: CountryMetric[] = campaign?.countriesJson
    ? JSON.parse(campaign.countriesJson)
    : [];

  const graphData: GraphPoint[] = campaign?.graphDataJson
    ? JSON.parse(campaign.graphDataJson)
    : [];

  const viewersRatio = campaign ? ((campaign.viewers / campaign.views) * 100).toFixed(1) : '68.6';
  const followsRatioPer100k = campaign
    ? ((campaign.follows / campaign.views) * 100000).toFixed(1)
    : '21.0';

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 antialiased p-4 md:p-8 selection:bg-purple-500/30 selection:text-white">
      {/* Glow background accent */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-blue-600/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Reel Insights Platform Engine
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-purple-500/10 border border-purple-500/20 text-purple-400">
                Phase 1 Live
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Deterministic Mathematical Engine, SQLite Local Persistence & CORS REST API
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>CORS: <strong className="text-emerald-400">*</strong></span>
            </div>
            <button
              onClick={fetchCurrent}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {notice && (
          <div className="flex items-center gap-2 p-3 text-sm bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl transition-all">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notice}</span>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Views */}
          <div className="p-5 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-xl hover:border-slate-700/80 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Total Views</span>
              <Eye className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl md:text-3xl font-bold mt-2 text-white">
              {campaign?.views.toLocaleString() ?? '100,000'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-blue-400">Target Scale</span>
            </div>
          </div>

          {/* Viewers */}
          <div className="p-5 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-xl hover:border-slate-700/80 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Unique Viewers</span>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl md:text-3xl font-bold mt-2 text-white">
              {campaign?.viewers.toLocaleString() ?? '68,639'}
            </div>
            <div className="text-[11px] text-purple-400/90 mt-1 flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 font-mono">
                {viewersRatio}%
              </span>
              <span className="text-slate-400">of views (65%-70% rule)</span>
            </div>
          </div>

          {/* Avg Watch Time */}
          <div className="p-5 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-xl hover:border-slate-700/80 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Avg. Watch Time</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl md:text-3xl font-bold mt-2 text-white">
              {campaign?.avgWatchTimeSeconds ?? 44}s
            </div>
            <div className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
              <span className="text-slate-400">Duration:</span>
              <span className="font-mono">{campaign?.videoDurationSeconds ?? 60}s</span>
              <span className="text-slate-400">(40s-45s per 60s)</span>
            </div>
          </div>

          {/* Follows */}
          <div className="p-5 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-xl hover:border-slate-700/80 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>New Follows</span>
              <UserPlus className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl md:text-3xl font-bold mt-2 text-white">
              +{campaign?.follows ?? 21}
            </div>
            <div className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-mono">
                {followsRatioPer100k}
              </span>
              <span className="text-slate-400">per 100k views (20-25)</span>
            </div>
          </div>
        </div>

        {/* Main Content: Chart + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Recharts Curve & Countries */}
          <div className="lg:col-span-2 space-y-6">
            {/* Velocity Curve Chart */}
            <div className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold text-white">Views Over Time (12-Point Velocity Curve)</h3>
                </div>
                <span className="text-xs text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/40">
                  Instagram Reel Plateau Dynamics
                </span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={graphData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="allColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="nonFollowersColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#A855F7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748B" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="#64748B"
                      fontSize={12}
                      tickLine={false}
                      tickFormatter={(val) => {
                        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                        if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
                        return val;
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: '#F8FAFC',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey="all"
                      name="Total Views"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#allColor)"
                    />
                    <Area
                      type="monotone"
                      dataKey="nonFollowers"
                      name="Non-Followers (99.6%)"
                      stroke="#A855F7"
                      strokeWidth={1.5}
                      fillOpacity={1}
                      fill="url(#nonFollowersColor)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Countries Breakdown */}
            <div className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold text-white">Top 5 Countries (Strict Descending Order)</h3>
                </div>
                <div className="text-xs text-slate-400">
                  Total Captured: ~{(countries.reduce((acc, c) => acc + c.percentage, 0)).toFixed(1)}%
                </div>
              </div>

              <div className="space-y-3.5">
                {countries.map((c, i) => (
                  <div key={c.country} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-2 text-slate-200">
                        <span className="text-slate-500 font-mono text-[10px]">#{i + 1}</span>
                        {c.country}
                      </span>
                      <span className="font-mono text-purple-300">{c.percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800/90 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, c.percentage * 2.8)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Col: Interactive Parameter Controls */}
          <div className="space-y-6">
            <div className="p-6 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold text-white">Engine Parameters</h3>
                </div>
                <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">
                  Live Sync
                </span>
              </div>

              {/* Views Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex justify-between">
                  <span>Views Target</span>
                  <span className="font-mono text-blue-400">{viewsInput.toLocaleString()}</span>
                </label>
                <input
                  type="number"
                  step="5000"
                  min="1000"
                  value={viewsInput}
                  onChange={(e) => setViewsInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Video Duration */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex justify-between">
                  <span>Video Duration (Seconds)</span>
                  <span className="font-mono text-amber-400">{durationInput}s</span>
                </label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  value={durationInput}
                  onChange={(e) => setDurationInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Country Label Format Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">USA Label Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCountryFormat('USA')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition ${
                      countryFormat === 'USA'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    "USA"
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountryFormat('United States')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition ${
                      countryFormat === 'United States'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    "United States"
                  </button>
                </div>
              </div>

              {/* Engagement Metrics Inputs */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Engagement Inputs
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <Heart className="w-3 h-3 text-red-400" /> Likes
                    </label>
                    <input
                      type="number"
                      value={likesInput}
                      onChange={(e) => setLikesInput(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <Bookmark className="w-3 h-3 text-amber-400" /> Saves
                    </label>
                    <input
                      type="number"
                      value={savesInput}
                      onChange={(e) => setSavesInput(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <Share2 className="w-3 h-3 text-blue-400" /> Shares
                    </label>
                    <input
                      type="number"
                      value={sharesInput}
                      onChange={(e) => setSharesInput(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <Repeat2 className="w-3 h-3 text-emerald-400" /> Reposts
                    </label>
                    <input
                      type="number"
                      value={repostsInput}
                      onChange={(e) => setRepostsInput(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                    <MessageCircle className="w-3 h-3 text-indigo-400" /> Comments
                  </label>
                  <input
                    type="number"
                    value={commentsInput}
                    onChange={(e) => setCommentsInput(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Collaboration Text</label>
                  <textarea
                    rows={2}
                    value={collabText}
                    onChange={(e) => setCollabText(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white resize-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] text-white rounded-xl text-sm font-semibold shadow-lg shadow-purple-600/25 transition flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Recalculating Engine...</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    <span>Recalculate & Update</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Extension Integration Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Code2 className="w-4 h-4 text-purple-400" />
                <span>Extension API Ready</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Browser extensions can inject or fetch directly via <code className="text-purple-300">GET /api/campaigns/current</code>.
              </p>
              <div className="p-2 bg-slate-950 rounded font-mono text-[10px] text-slate-400 overflow-x-auto">
                curl http://localhost:3000/api/campaigns/current
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
