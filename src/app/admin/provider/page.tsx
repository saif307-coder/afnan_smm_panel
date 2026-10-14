'use client';

import React, { useEffect, useState } from 'react';
import {
  Server,
  Key,
  Globe,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Activity,
  Layers,
  Heart,
  Bookmark,
  Share2,
  Repeat2,
  MessageCircle,
  UserPlus,
  Zap,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';

interface SmmProviderData {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  isActive: boolean;
  mappings?: ServiceMappingItem[];
}

interface ServiceMappingItem {
  id?: string;
  providerId?: string;
  metricType: string;
  serviceId: string;
  costPer1000: number;
  isActive: boolean;
}

const ALL_METRIC_TYPES = [
  { type: 'VIEWS', label: 'Views (Video / Reel)', icon: <Eye className="w-4 h-4 text-blue-400" /> },
  { type: 'LIKES', label: 'Likes (Real HQ)', icon: <Heart className="w-4 h-4 text-rose-400" /> },
  { type: 'SAVES', label: 'Saves (Bookmark)', icon: <Bookmark className="w-4 h-4 text-amber-400" /> },
  { type: 'SHARES', label: 'Shares (Post Link)', icon: <Share2 className="w-4 h-4 text-sky-400" /> },
  { type: 'REPOSTS', label: 'Reposts', icon: <Repeat2 className="w-4 h-4 text-emerald-400" /> },
  { type: 'COMMENTS', label: 'Comments (Random Real)', icon: <MessageCircle className="w-4 h-4 text-purple-400" /> },
  { type: 'FOLLOWERS', label: 'Followers (Account)', icon: <UserPlus className="w-4 h-4 text-fuchsia-400" /> },
];

export default function AdminProviderPage() {
  const [provider, setProvider] = useState<SmmProviderData | null>(null);
  const [mappings, setMappings] = useState<Record<string, { serviceId: string; costPer1000: number; isActive: boolean }>>({
    VIEWS: { serviceId: '3299', costPer1000: 0.0032, isActive: true },
    LIKES: { serviceId: '2688', costPer1000: 0.0469, isActive: true },
    SAVES: { serviceId: '2740', costPer1000: 0.1563, isActive: true },
    SHARES: { serviceId: '2741', costPer1000: 0.0016, isActive: true },
    REPOSTS: { serviceId: '2738', costPer1000: 1.107, isActive: true },
    COMMENTS: { serviceId: '2717', costPer1000: 0.8044, isActive: true },
    FOLLOWERS: { serviceId: '2635', costPer1000: 1.5966, isActive: true },
  });

  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingMapping, setSavingMapping] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    balance?: string;
    currency?: string;
    error?: string;
  } | null>(null);

  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadProviderData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Providers
      const res = await fetch('/api/admin/providers');
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const activeProv = data.data.find((p: SmmProviderData) => p.isActive) || data.data[0];
        setProvider(activeProv);

        // 2. Fetch Mappings for this provider
        const mapRes = await fetch(`/api/admin/mappings?providerId=${activeProv.id}`);
        const mapData = await mapRes.json();
        if (mapData.success && Array.isArray(mapData.data)) {
          const newMapState = { ...mappings };
          for (const item of mapData.data) {
            newMapState[item.metricType] = {
              serviceId: item.serviceId,
              costPer1000: item.costPer1000,
              isActive: item.isActive,
            };
          }
          setMappings(newMapState);
        }

        // 3. Auto-load live balance on page load
        try {
          const balRes = await fetch('/api/admin/providers/balance');
          const balData = await balRes.json();
          if (balData.connected && balData.balance !== undefined) {
            setTestResult({
              success: true,
              balance: balData.balance,
              currency: balData.currency || 'USD',
            });
          }
        } catch {
          // ignore auto-fetch error on mount
        }
      }
    } catch (err) {
      console.error('Failed to load provider:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviderData();
  }, []);

  const handleProviderSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider) return;

    setSavingProvider(true);
    setToast(null);

    try {
      const res = await fetch('/api/admin/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: provider.id,
          name: provider.name,
          apiUrl: provider.apiUrl,
          apiKey: provider.apiKey,
          isActive: provider.isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update provider');
      }

      setProvider(data.data);
      setToast({
        show: true,
        type: 'success',
        message: 'Provider credentials updated successfully!',
      });
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      });
    } finally {
      setSavingProvider(false);
    }
  };

  const handleTestConnection = async () => {
    if (!provider) return;
    setTestingConnection(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: provider.apiUrl,
          apiKey: provider.apiKey,
        }),
      });

      const data = await res.json();
      if (data.connected) {
        setTestResult({
          success: true,
          balance: data.balance,
          currency: data.currency,
        });
      } else {
        setTestResult({
          success: false,
          error: data.error || 'Provider rejected credentials',
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Connection timeout',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveMapping = async (metricType: string) => {
    if (!provider) return;
    const mapping = mappings[metricType];
    if (!mapping) return;

    setSavingMapping(metricType);
    setToast(null);

    try {
      const res = await fetch('/api/admin/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider.id,
          metricType,
          serviceId: mapping.serviceId,
          costPer1000: mapping.costPer1000,
          isActive: mapping.isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save mapping');
      }

      setToast({
        show: true,
        type: 'success',
        message: `Mapping for ${metricType} updated to Service ID #${mapping.serviceId}!`,
      });
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update mapping',
      });
    } finally {
      setSavingMapping(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white">
              <Server className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              SMM Provider & Service Mappings
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Configure 3rd-party SMM credentials and map internal metrics to provider service IDs
          </p>
        </div>

        {testResult && (
          <div
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold border ${
              testResult.success
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" />
            {testResult.success ? (
              <span>Balance: ${testResult.balance} {testResult.currency}</span>
            ) : (
              <span className="truncate max-w-[200px]" title={testResult.error}>
                {testResult.error}
              </span>
            )}
          </div>
        )}
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
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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

      {/* SECTION A: SMM Provider Credentials */}
      <div className="p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Section A: Active SMM Provider Credentials</span>
            </h2>
            <p className="text-xs text-slate-400">Endpoint & API key used for automated order dispatch</p>
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingConnection || !provider}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 transition w-fit disabled:opacity-50"
          >
            {testingConnection ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ping Live Balance</span>
              </>
            )}
          </button>
        </div>

        {provider ? (
          <form onSubmit={handleProviderSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Provider Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Provider Label</label>
                <input
                  type="text"
                  value={provider.name}
                  onChange={(e) => setProvider({ ...provider, name: e.target.value })}
                  placeholder="e.g. SMM Pro Provider (Official Production)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-xs text-white outline-none transition"
                />
              </div>

              {/* API URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>API Base URL</span>
                </label>
                <input
                  type="url"
                  value={provider.apiUrl}
                  onChange={(e) => setProvider({ ...provider, apiUrl: e.target.value })}
                  placeholder="https://smmproprovider.online/api/v2"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-xs font-mono text-white outline-none transition"
                />
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>API Secret Key</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={provider.apiKey}
                  onChange={(e) => setProvider({ ...provider, apiKey: e.target.value })}
                  placeholder="Enter 32-character provider key"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-xs font-mono text-white outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={provider.isActive}
                  onChange={(e) => setProvider({ ...provider, isActive: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Set as Default Active Dispatcher</span>
              </label>

              <button
                type="submit"
                disabled={savingProvider}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50 transition flex items-center gap-2"
              >
                {savingProvider ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Update Provider Credentials</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">
            {loading ? 'Loading provider configuration...' : 'No active SMM provider found.'}
          </div>
        )}
      </div>

      {/* SECTION B: Service Mappings Management */}
      <div className="p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-fuchsia-400" />
              <span>Section B: Service ID Mappings</span>
            </h2>
            <p className="text-xs text-slate-400">
              Maps internal metrics to provider service IDs on smmproprovider.online
            </p>
          </div>
          <span className="text-[11px] font-mono font-semibold text-fuchsia-400 bg-fuchsia-500/10 px-2.5 py-1 rounded-lg border border-fuchsia-500/20">
            7 Metrics Verified
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Metric Target</th>
                <th className="py-3 px-4">Provider Service ID</th>
                <th className="py-3 px-4">Cost / 1,000 ($)</th>
                <th className="py-3 px-4">Active</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {ALL_METRIC_TYPES.map((m) => {
                const current = mappings[m.type] || { serviceId: '', costPer1000: 0, isActive: true };
                const isSaving = savingMapping === m.type;

                return (
                  <tr key={m.type} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-bold text-white font-sans">
                      <div className="flex items-center gap-2">
                        {m.icon}
                        <div>
                          <div className="text-xs">{m.type}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{m.label}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={current.serviceId}
                        onChange={(e) =>
                          setMappings({
                            ...mappings,
                            [m.type]: { ...current, serviceId: e.target.value },
                          })
                        }
                        placeholder="e.g. 3299"
                        className="w-28 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white font-mono"
                      />
                    </td>

                    <td className="py-3 px-4">
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.0001"
                          value={current.costPer1000}
                          onChange={(e) =>
                            setMappings({
                              ...mappings,
                              [m.type]: {
                                ...current,
                                costPer1000: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full pl-5 pr-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white font-mono"
                        />
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300 font-sans">
                        <input
                          type="checkbox"
                          checked={current.isActive}
                          onChange={(e) =>
                            setMappings({
                              ...mappings,
                              [m.type]: { ...current, isActive: e.target.checked },
                            })
                          }
                          className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span className="text-[11px] text-emerald-400">Enabled</span>
                      </label>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSaveMapping(m.type)}
                        disabled={isSaving || !provider}
                        className="px-3 py-1.5 rounded-lg text-xs font-sans font-semibold bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white transition disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Save</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
