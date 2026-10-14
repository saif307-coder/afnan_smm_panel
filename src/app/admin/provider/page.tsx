'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
  Search,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  RefreshCw,
  Sparkles,
  Tag,
  Filter,
} from 'lucide-react';

interface SmmProviderData {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  isActive: boolean;
  mappings?: ServiceMappingItem[];
}

export interface ProviderService {
  service: number | string;
  name: string;
  type?: string;
  category?: string;
  rate: string | number;
  min: number | string;
  max: number | string;
  dripfeed?: boolean | string;
  refill?: boolean | string;
  cancel?: boolean | string;
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

  // Live SMM Services Explorer states
  const [services, setServices] = useState<ProviderService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesFetched, setServicesFetched] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedServiceId, setCopiedServiceId] = useState<string | null>(null);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const itemsPerPage = 25;

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

  // --- Live Services Explorer Logic ---
  const fetchLiveServices = async (forceRefresh = false) => {
    if (!provider) return;
    setLoadingServices(true);
    setServicesError(null);

    try {
      const url = `/api/admin/provider-services?providerId=${provider.id}${
        forceRefresh ? '&refresh=true' : ''
      }`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch services list from provider');
      }

      setServices(Array.isArray(data.data) ? data.data : []);
      setServicesFetched(true);
      setCurrentPage(1);
      setToast({
        show: true,
        type: 'success',
        message: `Successfully loaded ${data.count} live services from ${data.providerName || 'provider'}!`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch services';
      setServicesError(msg);
      setToast({
        show: true,
        type: 'error',
        message: msg,
      });
    } finally {
      setLoadingServices(false);
    }
  };

  const handleApplyToMetric = (service: ProviderService, metricType: string) => {
    const sId = String(service.service);
    const rateNum =
      typeof service.rate === 'number'
        ? service.rate
        : parseFloat(String(service.rate)) || 0;

    setMappings((prev) => ({
      ...prev,
      [metricType]: {
        ...(prev[metricType] || { isActive: true }),
        serviceId: sId,
        costPer1000: rateNum,
        isActive: true,
      },
    }));

    setToast({
      show: true,
      type: 'success',
      message: `Applied ${metricType} -> ID #${sId} ($${rateNum}/1k). Click 'Save' in Section B to store in database.`,
    });

    const el = document.getElementById('section-mappings');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCopyId = (id: string | number) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(String(id));
      setCopiedServiceId(String(id));
      setTimeout(() => setCopiedServiceId(null), 2000);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    services.forEach((s) => {
      if (s.category) cats.add(s.category);
    });
    return Array.from(cats).sort();
  }, [services]);

  const filteredServices = useMemo(() => {
    let result = services;
    if (selectedCategory !== 'ALL') {
      result = result.filter((s) => s.category === selectedCategory);
    }
    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase().trim();
      result = result.filter(
        (s) =>
          String(s.service).includes(q) ||
          s.name?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [services, selectedCategory, serviceSearch]);

  const totalPages = Math.ceil(filteredServices.length / itemsPerPage) || 1;
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredServices.slice(start, start + itemsPerPage);
  }, [filteredServices, currentPage]);

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
      <div id="section-mappings" className="p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-fuchsia-400" />
              <span>Section B: Service ID Mappings</span>
            </h2>
            <p className="text-xs text-slate-400">
              Maps internal metrics to active provider service IDs for automated order dispatch
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
                        placeholder="e.g. 2676"
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

      {/* SECTION C: Live SMM Services Explorer */}
      <div className="p-6 rounded-3xl bg-[#0e131f]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-400" />
              <span>Section C: Live SMM Services Explorer</span>
            </h2>
            <p className="text-xs text-slate-400">
              Query the live service catalog from your provider, find exact IDs & rates, and 1-click assign to metrics
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchLiveServices(true)}
            disabled={loadingServices || !provider}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition disabled:opacity-50 w-fit"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingServices ? 'animate-spin' : ''}`} />
            <span>{servicesFetched ? 'Refresh Provider Services' : 'Fetch Live Services from Provider'}</span>
          </button>
        </div>

        {/* State: Not fetched yet */}
        {!servicesFetched && !loadingServices && (
          <div className="p-8 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <Compass className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Live Provider Services Catalog</h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                Click the button below to fetch all active service IDs, categories, rates, and limits directly from{' '}
                <span className="text-slate-200 font-mono">{provider?.apiUrl || 'your SMM provider'}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchLiveServices(false)}
              disabled={!provider}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Fetch Live Services from Provider</span>
            </button>
          </div>
        )}

        {/* State: Loading */}
        {loadingServices && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
            <p className="text-xs font-medium text-slate-300">
              Connecting to SMM Provider and downloading live service catalog...
            </p>
            <p className="text-[11px] text-slate-500">
              Executing action=services on {provider?.apiUrl}
            </p>
          </div>
        )}

        {/* State: Error */}
        {servicesError && !loadingServices && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{servicesError}</span>
            </div>
            <button
              onClick={() => fetchLiveServices(true)}
              className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 text-rose-200 rounded-lg text-[11px] font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* State: Fetched & Ready */}
        {servicesFetched && !loadingServices && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={(e) => {
                    setServiceSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search services by name, ID, or category (e.g. 'Views', 'Likes', 'Reel', '2676')..."
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 outline-none transition"
                />
                {serviceSearch && (
                  <button
                    onClick={() => {
                      setServiceSearch('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Dropdown */}
              <div className="w-full md:w-72">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-xs text-slate-200 outline-none transition"
                >
                  <option value="ALL">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[11px] text-slate-500 flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" /> Quick Filter:
              </span>
              {[
                { label: 'All', query: '' },
                { label: 'Views', query: 'view' },
                { label: 'Likes', query: 'like' },
                { label: 'Saves', query: 'save' },
                { label: 'Shares', query: 'share' },
                { label: 'Reposts', query: 'repost' },
                { label: 'Comments', query: 'comment' },
                { label: 'Followers', query: 'follower' },
                { label: 'Reels', query: 'reel' },
              ].map((chip) => {
                const isSelected =
                  (chip.query === '' && serviceSearch === '' && selectedCategory === 'ALL') ||
                  (chip.query !== '' && serviceSearch.toLowerCase() === chip.query);

                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      setServiceSearch(chip.query);
                      setSelectedCategory('ALL');
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Results Count Summary */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
              <div>
                Showing{' '}
                <span className="font-bold text-white">
                  {filteredServices.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, filteredServices.length)}
                </span>{' '}
                of <span className="font-bold text-indigo-400">{filteredServices.length}</span> matching services
                {services.length > 0 && (
                  <span className="text-slate-500 ml-1">({services.length} total from provider)</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Page {currentPage} of {totalPages}
              </div>
            </div>

            {/* Services Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-3 px-3 w-28">Service ID</th>
                    <th className="py-3 px-3">Service Name & Category</th>
                    <th className="py-3 px-3 w-28">Rate / 1k</th>
                    <th className="py-3 px-3 w-32">Min - Max</th>
                    <th className="py-3 px-3 text-right w-44">Map To Metric</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {paginatedServices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        No services match your search query &quot;{serviceSearch}&quot;.
                      </td>
                    </tr>
                  ) : (
                    paginatedServices.map((s) => {
                      const isCopied = copiedServiceId === String(s.service);
                      return (
                        <tr key={s.service} className="hover:bg-slate-800/30 transition group">
                          {/* Service ID */}
                          <td className="py-3 px-3 font-mono">
                            <button
                              type="button"
                              onClick={() => handleCopyId(s.service)}
                              title="Click to copy Service ID"
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 font-bold border border-indigo-500/30 text-xs transition"
                            >
                              <span>#{s.service}</span>
                              {isCopied ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-indigo-400/70 group-hover:text-indigo-300" />
                              )}
                            </button>
                          </td>

                          {/* Service Name & Category */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-100 text-xs leading-snug">
                              {s.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {s.category && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-fuchsia-400 bg-fuchsia-500/10 px-2 py-0.5 rounded border border-fuchsia-500/20 font-medium">
                                  <Tag className="w-2.5 h-2.5" />
                                  <span>{s.category}</span>
                                </span>
                              )}
                              {s.type && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  [{s.type}]
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Rate */}
                          <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                            ${typeof s.rate === 'number' ? s.rate.toFixed(4) : s.rate}
                          </td>

                          {/* Min - Max */}
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                            {Number(s.min).toLocaleString()} - {Number(s.max).toLocaleString()}
                          </td>

                          {/* 1-Click Map To Metric Dropdown */}
                          <td className="py-3 px-3 text-right">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleApplyToMetric(s, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 hover:text-white hover:bg-indigo-900/80 text-xs font-semibold focus:ring-0 outline-none cursor-pointer transition shadow-sm"
                            >
                              <option value="" disabled>
                                Map To Metric ▼
                              </option>
                              {ALL_METRIC_TYPES.map((m) => (
                                <option key={m.type} value={m.type}>
                                  ➔ Map to {m.type}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-medium text-slate-300 border border-slate-800 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="text-xs text-slate-400 font-mono">
                  Page <span className="text-white font-bold">{currentPage}</span> of{' '}
                  <span className="text-white font-bold">{totalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-medium text-slate-300 border border-slate-800 transition"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
