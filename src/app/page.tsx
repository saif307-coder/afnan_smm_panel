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
  Code2,
  ArrowLeft,
  MoreVertical,
  Wifi,
  Smartphone,
  Sparkles,
  PieChart
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { formatMetricNumber, calculateReelMetrics } from '@/lib/metricsEngine';

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

  // Form input state
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

  // Mobile Simulator Interactive State
  const [mobileTab, setMobileTab] = useState<'overview' | 'engagement' | 'audience'>('overview');
  const [graphFilter, setGraphFilter] = useState<'all' | 'followers' | 'nonFollowers'>('all');
  const [audienceFilter, setAudienceFilter] = useState<'country' | 'age' | 'gender'>('country');
  const [showAndroidNavBar, setShowAndroidNavBar] = useState<boolean>(true);

  const fetchCurrent = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/campaigns/current');
      const json = await res.json();
      if (json.success && json.data) {
        syncState(json.data);
      }
    } catch (err) {
      console.error('Error fetching current campaign:', err);
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

  const handleUpdate = (customViews?: number) => {
    startUpdateTransition(async () => {
      try {
        const payloadViews = typeof customViews === 'number' ? customViews : viewsInput;
        const res = await fetch('/api/campaigns/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            views: payloadViews,
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
        console.error('Update failed:', err);
      }
    });
  };

  const currentViews = campaign?.views ?? viewsInput;
  const currentDuration = campaign?.videoDurationSeconds ?? durationInput;

  // Calculate live dynamic metrics using the mathematical engine
  const computedMetrics = calculateReelMetrics(
    currentViews,
    currentDuration,
    undefined,
    countryFormat
  );

  const countries: CountryMetric[] = campaign?.countriesJson
    ? JSON.parse(campaign.countriesJson)
    : computedMetrics.countries;

  const graphData: GraphPoint[] = campaign?.graphDataJson
    ? JSON.parse(campaign.graphDataJson)
    : computedMetrics.graphData;

  const viewersCount = campaign?.viewers ?? computedMetrics.viewers;
  const viewersRatio = ((viewersCount / currentViews) * 100).toFixed(1);
  const avgWatchSeconds = campaign?.avgWatchTimeSeconds ?? computedMetrics.avgWatchTimeSeconds;
  const followsCount = campaign?.follows ?? computedMetrics.follows;

  // Format chart data based on active mobile filter pill
  const mobileChartData = graphData.map((d) => ({
    time: d.time,
    value:
      graphFilter === 'all'
        ? d.all
        : graphFilter === 'followers'
        ? d.followers
        : d.nonFollowers,
  }));

  // Dynamic Y-axis scale based on current filter
  const filterScaleMultiplier =
    graphFilter === 'all' ? 1.0 : graphFilter === 'followers' ? 0.004 : 0.996;
  const mobileTopTickValue = Math.round(computedMetrics.ticks.topTickValue * filterScaleMultiplier);
  const mobileMidTickValue = Math.round(computedMetrics.ticks.midTickValue * filterScaleMultiplier);

  // Mock Age and Gender breakdowns adhering to realistic Reel demographics
  const ageDemographics = [
    { label: '18–24', percentage: 43.2 },
    { label: '25–34', percentage: 37.8 },
    { label: '35–44', percentage: 12.4 },
    { label: '45+', percentage: 6.6 },
  ];

  const genderDemographics = [
    { label: 'Men', percentage: 58.4 },
    { label: 'Women', percentage: 41.6 },
  ];

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 antialiased p-3 sm:p-6 lg:p-8 selection:bg-fuchsia-500/30 selection:text-white">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/4 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-purple-700/15 via-fuchsia-600/15 to-transparent blur-[140px] pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[300px] bg-gradient-to-l from-blue-600/10 via-indigo-600/10 to-transparent blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-[1440px] mx-auto space-y-6 relative z-10">
        {/* Top Header Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#0e131f]/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Reel Insights Platform Engine
              </h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300">
                Phase 2 Mobile Simulator Live
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Deterministic Invariant Engine + Pixel-Perfect Instagram Android Mobile Frame
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>CORS: <strong className="text-emerald-400">*</strong></span>
            </div>
            <button
              onClick={fetchCurrent}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-95 border border-slate-700 transition shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {notice && (
          <div className="flex items-center gap-2 p-3 text-sm bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-xl animate-in fade-in transition-all">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Main 2-Column Split View: Desktop Engine Controls + Instagram Mobile Simulator */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* ============================================================== */}
          {/* LEFT COLUMN: Engine Dashboard Controls & Deep Analytics (7 Cols) */}
          {/* ============================================================== */}
          <div className="xl:col-span-7 space-y-6">
            
            {/* 4 Summary Ratio Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* Views */}
              <div className="p-4 bg-[#0e131f]/70 border border-slate-800/80 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Views</span>
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold mt-1 text-white">
                  {currentViews.toLocaleString()}
                </div>
                <div className="text-[10px] text-blue-400 mt-1">Scale Baseline</div>
              </div>

              {/* Viewers */}
              <div className="p-4 bg-[#0e131f]/70 border border-slate-800/80 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Viewers</span>
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold mt-1 text-white">
                  {viewersCount.toLocaleString()}
                </div>
                <div className="text-[10px] text-purple-400 mt-1 font-mono">
                  {viewersRatio}% (65%–70%)
                </div>
              </div>

              {/* Avg Watch Time */}
              <div className="p-4 bg-[#0e131f]/70 border border-slate-800/80 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Avg Watch Time</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold mt-1 text-white">
                  {avgWatchSeconds}s
                </div>
                <div className="text-[10px] text-amber-400 mt-1">
                  Duration: {currentDuration}s (40–45s)
                </div>
              </div>

              {/* Follows */}
              <div className="p-4 bg-[#0e131f]/70 border border-slate-800/80 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Follows</span>
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold mt-1 text-white">
                  +{followsCount}
                </div>
                <div className="text-[10px] text-emerald-400 mt-1">
                  20–25 per 100k
                </div>
              </div>
            </div>

            {/* Engine Parameters Card */}
            <div className="p-6 bg-[#0e131f]/90 border border-slate-800/90 rounded-2xl shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-fuchsia-400" />
                  <h2 className="font-semibold text-white text-base">Mathematical Engine Controls</h2>
                </div>
                <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                  Deterministic Sync
                </span>
              </div>

              {/* Quick View Presets */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Quick Presets</span>
                  <span className="text-[11px] text-fuchsia-400">Click to Recalculate Instantly</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[25000, 50000, 100000, 250000, 500000, 1000000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setViewsInput(preset);
                        handleUpdate(preset);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-medium border transition ${
                        viewsInput === preset
                          ? 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-md shadow-fuchsia-600/30'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {formatMetricNumber(preset)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Views Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex justify-between">
                    <span>Views Target</span>
                    <span className="font-mono text-fuchsia-400">{viewsInput.toLocaleString()}</span>
                  </label>
                  <input
                    type="number"
                    step="5000"
                    min="1000"
                    value={viewsInput}
                    onChange={(e) => setViewsInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-fuchsia-500 transition"
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
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-fuchsia-500 transition"
                  />
                </div>
              </div>

              {/* USA Label Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">USA Country Label Display</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCountryFormat('USA')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition ${
                      countryFormat === 'USA'
                        ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/25 border border-fuchsia-500'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    "USA" (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountryFormat('United States')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition ${
                      countryFormat === 'United States'
                        ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/25 border border-fuchsia-500'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    "United States"
                  </button>
                </div>
              </div>

              {/* Engagement Metrics Inputs */}
              <div className="pt-2 border-t border-slate-800/80 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Engagement Action Counts
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-white max-w-xs"
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

              {/* Recalculate & Sync Button */}
              <button
                onClick={() => handleUpdate()}
                disabled={isUpdating}
                className="w-full py-3 px-4 bg-gradient-to-r from-fuchsia-600 via-pink-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 active:scale-[0.99] text-white rounded-xl text-sm font-semibold shadow-lg shadow-fuchsia-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Recalculating Mathematical Engine...</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    <span>Recalculate & Sync Live Preview</span>
                  </>
                )}
              </button>
            </div>

            {/* Extension API Card */}
            <div className="p-5 bg-[#0e131f]/70 border border-slate-800/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Code2 className="w-4 h-4 text-fuchsia-400" />
                  <span>CORS REST API Override Ready</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Access-Control-Allow-Origin: *
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Browser extensions and external scripts can fetch or push updates directly in real-time.
              </p>
              <div className="p-3 bg-slate-950/90 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto space-y-1 border border-slate-900">
                <div className="text-fuchsia-400"># Fetch current active campaign:</div>
                <div>GET https://afnan-smm-panel.vercel.app/api/campaigns/current</div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT COLUMN: Pixel-Perfect Instagram Android Mobile Simulator (5 Cols) */}
          {/* ============================================================== */}
          <div className="xl:col-span-5 flex flex-col items-center justify-start space-y-4">
            
            {/* Simulator Controls & Status Pill */}
            <div className="flex items-center justify-between w-full max-w-[390px] px-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <Smartphone className="w-4 h-4 text-fuchsia-400" />
                <span>Instagram Android Frame</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAndroidNavBar(!showAndroidNavBar)}
                className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700/60 transition"
              >
                {showAndroidNavBar ? 'Hide 3-Button Nav' : 'Show 3-Button Nav'}
              </button>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* SMARTPHONE HARDWARE CHASSIS (Fixed 390px Width, #000000 Theme) */}
            {/* ------------------------------------------------------------- */}
            <div className="w-[390px] max-w-[390px] bg-black text-white rounded-[44px] border-[9px] border-[#20232a] shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(217,70,239,0.12)] overflow-hidden flex flex-col font-sans select-none relative">
              
              {/* Hardware Punch-Hole Camera */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#0a0a0c] border border-white/5 rounded-full z-30 pointer-events-none" />

              {/* 1. Android Status Bar (9:17, VoLTE, 25% battery) */}
              <div className="pt-2 px-5 pb-1 flex items-center justify-between text-white text-[12px] bg-black shrink-0 relative z-20">
                {/* Left: Clock */}
                <span className="font-semibold tracking-tight text-[13px] pl-1">9:17</span>
                
                {/* Right: Network & Battery */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold tracking-tight px-1 py-0.2 border border-white/40 rounded text-slate-200">
                    VoLTE
                  </span>
                  {/* Signal 4-bars */}
                  <div className="flex items-end gap-0.5 h-2.5">
                    <span className="w-0.5 h-1 bg-white rounded-xs" />
                    <span className="w-0.5 h-1.5 bg-white rounded-xs" />
                    <span className="w-0.5 h-2 bg-white rounded-xs" />
                    <span className="w-0.5 h-2.5 bg-white rounded-xs" />
                  </div>
                  {/* WiFi Icon */}
                  <Wifi className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                  {/* Battery 25% */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-medium">25%</span>
                    <div className="w-5 h-2.5 border border-white/80 rounded-xs p-0.5 flex items-center relative">
                      <div className="h-full bg-white rounded-xs" style={{ width: '25%' }} />
                      <div className="w-0.5 h-1 bg-white/80 absolute -right-1 top-0.5 rounded-r-xs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Instagram Top App Header (<- Reel insights, trend icon, 3-dots) */}
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#1c1f26] bg-black shrink-0">
                <div className="flex items-center gap-3.5">
                  <button className="text-white hover:opacity-80 active:scale-95 transition">
                    <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
                  </button>
                  <h2 className="text-[17px] font-bold tracking-tight text-white">Reel insights</h2>
                </div>
                <div className="flex items-center gap-4 text-white">
                  <TrendingUp className="w-5 h-5 stroke-[2.2]" />
                  <MoreVertical className="w-5 h-5 stroke-[2.2]" />
                </div>
              </div>

              {/* Scrollable Mobile Body Container */}
              <div className="overflow-y-auto h-[610px] bg-black scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                
                {/* 3. 5-Icon Engagement Row */}
                <div className="px-4 py-3 border-b border-[#16181c] flex items-center justify-between bg-black">
                  <div className="flex flex-col items-center gap-1">
                    <Heart className="w-5 h-5 text-white stroke-[2]" />
                    <span className="text-[11px] font-medium text-neutral-300">
                      {formatMetricNumber(campaign?.likes ?? likesInput)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <MessageCircle className="w-5 h-5 text-white stroke-[2]" />
                    <span className="text-[11px] font-medium text-neutral-300">
                      {formatMetricNumber(campaign?.comments ?? commentsInput)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Repeat2 className="w-5 h-5 text-white stroke-[2]" />
                    <span className="text-[11px] font-medium text-neutral-300">
                      {formatMetricNumber(campaign?.reposts ?? repostsInput)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Share2 className="w-5 h-5 text-white stroke-[2]" />
                    <span className="text-[11px] font-medium text-neutral-300">
                      {formatMetricNumber(campaign?.shares ?? sharesInput)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Bookmark className="w-5 h-5 text-white stroke-[2]" />
                    <span className="text-[11px] font-medium text-neutral-300">
                      {formatMetricNumber(campaign?.saves ?? savesInput)}
                    </span>
                  </div>
                </div>

                {/* 4. Interactive Tabs (Overview, Engagement, Audience) with White Active Underline */}
                <div className="flex border-b border-[#1c1f26] bg-black sticky top-0 z-10">
                  {(['overview', 'engagement', 'audience'] as const).map((tab) => {
                    const isActive = mobileTab === tab;
                    const tabLabels = {
                      overview: 'Overview',
                      engagement: 'Engagement',
                      audience: 'Audience',
                    };
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setMobileTab(tab)}
                        className={`flex-1 py-3 text-[13px] font-semibold text-center transition relative cursor-pointer ${
                          isActive ? 'text-white' : 'text-[#8e8e93] hover:text-neutral-300'
                        }`}
                      >
                        {tabLabels[tab]}
                        {/* White active indicator line */}
                        {isActive && (
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-t-full shadow-sm" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* TAB 1: OVERVIEW TAB CONTENT */}
                {mobileTab === 'overview' && (
                  <div className="p-4 space-y-5 animate-in fade-in duration-200">
                    {/* Summary Header + Collaboration subtext */}
                    <div className="space-y-1">
                      <h3 className="text-[16px] font-bold text-white">Summary</h3>
                      <p className="text-[12px] text-neutral-400 leading-snug">
                        {campaign?.collaborationText || collabText}
                      </p>
                    </div>

                    {/* 2x2 Dark Cards (#16181c) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Views Card */}
                      <div className="bg-[#16181c] p-3.5 rounded-xl border border-white/[0.04]">
                        <div className="text-[12px] text-neutral-400 font-medium">Views</div>
                        <div className="text-[20px] font-bold text-white mt-1">
                          {formatMetricNumber(currentViews)}
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">Total Plays</div>
                      </div>

                      {/* Viewers Card (65%-70%) */}
                      <div className="bg-[#16181c] p-3.5 rounded-xl border border-white/[0.04]">
                        <div className="text-[12px] text-neutral-400 font-medium">Viewers</div>
                        <div className="text-[20px] font-bold text-white mt-1">
                          {formatMetricNumber(viewersCount)}
                        </div>
                        <div className="text-[10px] text-fuchsia-400 font-medium mt-0.5">
                          {viewersRatio}% of views
                        </div>
                      </div>

                      {/* Average watch time Card (40s-45s) */}
                      <div className="bg-[#16181c] p-3.5 rounded-xl border border-white/[0.04]">
                        <div className="text-[12px] text-neutral-400 font-medium leading-tight">
                          Average watch time
                        </div>
                        <div className="text-[20px] font-bold text-white mt-1">
                          {avgWatchSeconds}s
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">Initial {currentDuration}s</div>
                      </div>

                      {/* Follows Card (20-25 per 100k) */}
                      <div className="bg-[#16181c] p-3.5 rounded-xl border border-white/[0.04]">
                        <div className="text-[12px] text-neutral-400 font-medium">Follows</div>
                        <div className="text-[20px] font-bold text-white mt-1">
                          +{followsCount}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-medium mt-0.5">
                          {((followsCount / currentViews) * 100000).toFixed(0)} per 100K
                        </div>
                      </div>
                    </div>

                    {/* Views over time Section */}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[15px] font-bold text-white">Views over time</h4>
                        <span className="text-[10px] text-neutral-400">7 Days</span>
                      </div>

                      {/* Filter Pills (All, Followers, Non-followers) */}
                      <div className="flex items-center gap-1.5">
                        {[
                          { id: 'all', label: 'All' },
                          { id: 'followers', label: 'Followers' },
                          { id: 'nonFollowers', label: 'Non-followers' },
                        ].map((pill) => {
                          const isPillActive = graphFilter === pill.id;
                          return (
                            <button
                              key={pill.id}
                              type="button"
                              onClick={() => setGraphFilter(pill.id as 'all' | 'followers' | 'nonFollowers')}
                              className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                                isPillActive
                                  ? 'bg-white text-black font-semibold'
                                  : 'bg-[#262626] text-neutral-300 hover:bg-[#333]'
                              }`}
                            >
                              {pill.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Magenta Plateau Line Graph (#d946ef) */}
                      <div className="bg-[#16181c] p-3 rounded-xl border border-white/[0.04] space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-neutral-400 px-1">
                          <span>Steep Surge & Plateau</span>
                          <span className="font-mono text-fuchsia-400">
                            Peak: {formatMetricNumber(mobileTopTickValue)}
                          </span>
                        </div>

                        <div className="h-44 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mobileChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="mobileMagentaGlow" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#d946ef" stopOpacity={0.35} />
                                  <stop offset="95%" stopColor="#d946ef" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="2 2" stroke="#262626" vertical={false} />
                              <XAxis
                                dataKey="time"
                                stroke="#71717a"
                                fontSize={9}
                                tickLine={false}
                                interval={1}
                              />
                              <YAxis
                                stroke="#71717a"
                                fontSize={9}
                                tickLine={false}
                                domain={[0, mobileTopTickValue || 'auto']}
                                ticks={[0, mobileMidTickValue, mobileTopTickValue]}
                                tickFormatter={(v) => formatMetricNumber(v)}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#16181c',
                                  borderColor: '#262626',
                                  borderRadius: '0.5rem',
                                  fontSize: '11px',
                                  color: '#fff',
                                }}
                                formatter={(val) => [Number(val).toLocaleString(), 'Views']}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#d946ef"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#mobileMagentaGlow)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-neutral-500 pt-1 border-t border-[#262626]">
                          <span>Dynamic Ticks: 0 — {formatMetricNumber(mobileMidTickValue)} — {formatMetricNumber(mobileTopTickValue)}</span>
                          <span className="text-fuchsia-400 font-mono">#d946ef</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ENGAGEMENT TAB CONTENT */}
                {mobileTab === 'engagement' && (
                  <div className="p-4 space-y-4 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <h3 className="text-[16px] font-bold text-white">Interactions</h3>
                      <p className="text-[12px] text-neutral-400">
                        Total engagement based on active campaign stats
                      </p>
                    </div>

                    <div className="bg-[#16181c] p-4 rounded-xl border border-white/[0.04] space-y-3">
                      {[
                        {
                          icon: Heart,
                          color: 'text-red-400',
                          label: 'Likes',
                          count: campaign?.likes ?? likesInput,
                        },
                        {
                          icon: Bookmark,
                          color: 'text-amber-400',
                          label: 'Saves',
                          count: campaign?.saves ?? savesInput,
                        },
                        {
                          icon: Share2,
                          color: 'text-blue-400',
                          label: 'Shares',
                          count: campaign?.shares ?? sharesInput,
                        },
                        {
                          icon: Repeat2,
                          color: 'text-emerald-400',
                          label: 'Reposts',
                          count: campaign?.reposts ?? repostsInput,
                        },
                        {
                          icon: MessageCircle,
                          color: 'text-indigo-400',
                          label: 'Comments',
                          count: campaign?.comments ?? commentsInput,
                        },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-xs py-1">
                          <div className="flex items-center gap-2">
                            <item.icon className={`w-4 h-4 ${item.color}`} />
                            <span className="text-neutral-300 font-medium">{item.label}</span>
                          </div>
                          <span className="font-mono text-white font-semibold">
                            {item.count.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: AUDIENCE TAB CONTENT */}
                {mobileTab === 'audience' && (
                  <div className="p-4 space-y-5 animate-in fade-in duration-200">
                    
                    {/* Who viewed your reel (Followers 0.4%, Non-followers 99.6%) */}
                    <div className="space-y-2.5">
                      <h3 className="text-[16px] font-bold text-white">Who viewed your reel</h3>
                      
                      <div className="bg-[#16181c] p-4 rounded-xl border border-white/[0.04] space-y-3">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-neutral-300">Non-followers</span>
                          <span className="font-bold text-fuchsia-400 font-mono">99.6%</span>
                        </div>

                        {/* Purple Split Progress Bar */}
                        <div className="h-3 w-full bg-[#262626] rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-l-full"
                            style={{ width: '99.6%' }}
                          />
                          <div
                            className="h-full bg-slate-400 rounded-r-full"
                            style={{ width: '0.4%' }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-fuchsia-500 inline-block" />
                            <span>Non-followers (99.6%)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                            <span>Followers (0.4%)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Audience Details Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[15px] font-bold text-white">Audience details</h4>
                        <span className="text-[10px] text-neutral-400">Demographics</span>
                      </div>

                      {/* Filter Pills: Age, Country, Gender */}
                      <div className="flex items-center gap-1.5">
                        {[
                          { id: 'country', label: 'Country' },
                          { id: 'age', label: 'Age' },
                          { id: 'gender', label: 'Gender' },
                        ].map((pill) => {
                          const isAudiencePillActive = audienceFilter === pill.id;
                          return (
                            <button
                              key={pill.id}
                              type="button"
                              onClick={() => setAudienceFilter(pill.id as 'country' | 'age' | 'gender')}
                              className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                                isAudiencePillActive
                                  ? 'bg-white text-black font-semibold'
                                  : 'bg-[#262626] text-neutral-300 hover:bg-[#333]'
                              }`}
                            >
                              {pill.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Pill View: Countries (Strict Order: USA, UK, Canada, Australia, Germany) */}
                      {audienceFilter === 'country' && (
                        <div className="bg-[#16181c] p-4 rounded-xl border border-white/[0.04] space-y-3.5">
                          <div className="text-[11px] text-neutral-400 font-medium">
                            Top Countries (Strict Descending Order)
                          </div>
                          {countries.map((c) => (
                            <div key={c.country} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-white">{c.country}</span>
                                <span className="font-mono text-fuchsia-400 font-semibold">{c.percentage}%</span>
                              </div>
                              <div className="h-2 w-full bg-[#262626] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#e040fb] rounded-full transition-all duration-500 shadow-sm shadow-[#e040fb]/30"
                                  style={{ width: `${Math.min(100, c.percentage * 3.1)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Pill View: Age */}
                      {audienceFilter === 'age' && (
                        <div className="bg-[#16181c] p-4 rounded-xl border border-white/[0.04] space-y-3.5">
                          <div className="text-[11px] text-neutral-400 font-medium">Age Distribution</div>
                          {ageDemographics.map((a) => (
                            <div key={a.label} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-white">{a.label}</span>
                                <span className="font-mono text-fuchsia-400 font-semibold">{a.percentage}%</span>
                              </div>
                              <div className="h-2 w-full bg-[#262626] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#e040fb] rounded-full transition-all duration-500 shadow-sm shadow-[#e040fb]/30"
                                  style={{ width: `${a.percentage * 2.2}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Pill View: Gender */}
                      {audienceFilter === 'gender' && (
                        <div className="bg-[#16181c] p-4 rounded-xl border border-white/[0.04] space-y-3.5">
                          <div className="text-[11px] text-neutral-400 font-medium">Gender Ratio</div>
                          {genderDemographics.map((g) => (
                            <div key={g.label} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-white">{g.label}</span>
                                <span className="font-mono text-fuchsia-400 font-semibold">{g.percentage}%</span>
                              </div>
                              <div className="h-2 w-full bg-[#262626] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#e040fb] rounded-full transition-all duration-500 shadow-sm shadow-[#e040fb]/30"
                                  style={{ width: `${g.percentage * 1.6}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Bottom Android Navigation Bar (3-Button or Modern Gesture Indicator) */}
              {showAndroidNavBar ? (
                <div className="h-11 bg-black border-t border-[#1c1f26] flex items-center justify-around px-8 shrink-0 relative z-20">
                  {/* Recents (|||) */}
                  <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition cursor-pointer">
                    <span className="w-0.5 h-3.5 bg-white rounded-full" />
                    <span className="w-0.5 h-3.5 bg-white rounded-full" />
                    <span className="w-0.5 h-3.5 bg-white rounded-full" />
                  </div>
                  {/* Home (Circle) */}
                  <div className="w-4 h-4 border-2 border-white rounded-full opacity-70 hover:opacity-100 transition cursor-pointer" />
                  {/* Back (< Triangle/Chevron) */}
                  <div className="opacity-70 hover:opacity-100 transition cursor-pointer">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </div>
                </div>
              ) : (
                <div className="h-5 bg-black flex items-center justify-center shrink-0">
                  <div className="w-28 h-1 bg-white/40 rounded-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
