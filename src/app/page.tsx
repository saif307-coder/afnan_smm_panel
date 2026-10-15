'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, ShoppingBag, Activity, ArrowRight, Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return (
    <main className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-indigo-500 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/10 blur-[140px] rounded-full" />
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-600/10 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center text-center space-y-8">
        {/* Brand / Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-800/40 text-indigo-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Platform Online & Operational</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Afnan SMM Panel
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            High-velocity distribution & automated social growth orchestration engine.
          </p>
        </div>

        {/* Redirect Notice */}
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg text-xs text-slate-300">
          <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
          <span>Navigating to Admin Console automatically...</span>
        </div>

        {/* Navigation Fallback Hub */}
        <div className="w-full space-y-3 pt-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Quick Navigation Hub
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Admin Console */}
            <Link
              href="/admin"
              className="group flex items-center justify-between p-4 rounded-2xl bg-[#0e131f]/90 border border-slate-800 hover:border-indigo-500/50 hover:bg-[#121827] transition shadow-md"
            >
              <div className="flex items-center gap-3.5 text-left">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
                    Admin Console
                  </div>
                  <div className="text-xs text-slate-400">
                    Live orders, metric balances, sync engine & controls
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition" />
            </Link>

            {/* Client Order Form */}
            <Link
              href="/order"
              className="group flex items-center justify-between p-4 rounded-2xl bg-[#0e131f]/90 border border-slate-800 hover:border-emerald-500/50 hover:bg-[#121827] transition shadow-md"
            >
              <div className="flex items-center gap-3.5 text-left">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                    Client Order Form
                  </div>
                  <div className="text-xs text-slate-400">
                    Configure base views, ratio multipliers & dispatch campaigns
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition" />
            </Link>

            {/* Live Order Tracker */}
            <Link
              href="/dashboard"
              className="group flex items-center justify-between p-4 rounded-2xl bg-[#0e131f]/90 border border-slate-800 hover:border-sky-500/50 hover:bg-[#121827] transition shadow-md"
            >
              <div className="flex items-center gap-3.5 text-left">
                <div className="w-10 h-10 rounded-xl bg-sky-600/15 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-sky-300 transition">
                    Live Order Tracker
                  </div>
                  <div className="text-xs text-slate-400">
                    Track live fulfillment, sub-order breakdown & metrics
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition" />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-[11px] text-slate-600 font-mono">
          © {new Date().getFullYear()} Afnan SMM Panel • High Availability Distribution
        </div>
      </div>
    </main>
  );
}

