import React from 'react';
import OrderTracker from '@/components/OrderTracker';

export const metadata = {
  title: 'Live Order Tracking Dashboard - Afnan SMM Panel',
  description: 'Real-time delivery progress, start counts, remaining quantities, and completion states',
};

export default function ClientDashboardPage() {
  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 antialiased p-4 sm:p-6 lg:p-8 selection:bg-fuchsia-500/30 selection:text-white">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/4 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-700/10 via-indigo-600/10 to-transparent blur-[140px] pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[300px] bg-gradient-to-l from-fuchsia-600/10 via-purple-600/10 to-transparent blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        <OrderTracker />
      </div>
    </div>
  );
}
