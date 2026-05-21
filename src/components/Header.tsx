import React, { useEffect, useState } from 'react';
import { Activity, Clock, ShieldAlert, LogOut, ChevronRight, HeartPulse } from 'lucide-react';

interface HeaderProps {
  userEmail?: string;
  onLogout?: () => void;
  activeTab: 'evaluate' | 'history';
  setActiveTab: (tab: 'evaluate' | 'history') => void;
}

export default function Header({ 
  userEmail = 'dispatch.coordinator@medptc.ems', 
  onLogout,
  activeTab,
  setActiveTab
}: HeaderProps) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      let tz = 'Local';
      try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(now);
        tz = parts.find(p => p.type === 'timeZoneName')?.value || 'Local';
      } catch (e) {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
      }

      setTimeStr(`${year}-${month}-${day} ${hours}:${minutes}:${seconds} [${tz}]`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="w-full h-14 bg-slate-950 border-b border-slate-800 px-5 flex items-center justify-between shrink-0 select-none">
      {/* Brand & Systems Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-emerald-600 rounded flex items-center justify-center border border-emerald-500/30">
            <HeartPulse className="h-5 w-5 text-zinc-950" />
          </div>
          <span className="font-display text-[17px] font-semibold text-slate-100 tracking-tight">MedPTC</span>
          <span className="bg-emerald-950/40 border border-emerald-900 text-[9px] font-mono font-medium text-emerald-400 px-1.5 py-0.5 rounded tracking-wide uppercase">
            MVP PROTOTYPE
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 pl-4 border-l border-slate-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono text-slate-450 uppercase tracking-widest">
            Telemetry Feed: ACTIVE
          </span>
        </div>
      </div>

      {/* Tabs / Navigation inside the dashboard */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('evaluate')}
          className={`px-3 py-1 text-xs font-medium rounded transition duration-150 ${
            activeTab === 'evaluate'
              ? 'bg-emerald-600 text-zinc-950 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Dispatch Console
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1 text-xs font-medium rounded transition duration-150 ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-zinc-950 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Historical Assessments
        </button>
      </div>

      {/* Clock & Dispatcher Profile info */}
      <div className="flex items-center gap-4">
        {/* Dynamic Local Clock */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded font-mono text-xs text-slate-300">
          <Clock className="h-3.5 w-3.5 text-zinc-400" />
          <span>{timeStr || 'Loading...'}</span>
        </div>

        {/* Dispatcher profile */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden lg:block">
            <span className="text-[10.5px] font-mono text-slate-500 block uppercase">EMS Operator</span>
            <span className="text-xs text-slate-250 font-medium font-mono">{userEmail}</span>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 hover:bg-slate-800 rounded border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-red-400 transition"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
