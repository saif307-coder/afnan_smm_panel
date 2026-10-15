import React from 'react';
import OrderForm from '@/components/OrderForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dynamic Order Form - Afnan SMM Panel',
  description: 'Stage and calculate Instagram Reel engagement orders with real-time mathematical ratios',
};

export default function OrderPage() {
  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 antialiased p-3 sm:p-6 lg:p-8 selection:bg-fuchsia-500/30 selection:text-white">
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/3 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-purple-700/15 via-fuchsia-600/15 to-transparent blur-[140px] pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[300px] bg-gradient-to-l from-blue-600/10 via-indigo-600/10 to-transparent blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-[1440px] mx-auto space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Reel Simulator</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/40 text-xs font-semibold text-emerald-300 hover:text-white transition shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Order Tracker</span>
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/40 text-xs font-semibold text-indigo-300 hover:text-white transition shadow-sm"
            >
              <span>Admin Panel</span>
            </Link>
          </div>
        </div>

        <OrderForm />
      </div>
    </div>
  );
}
