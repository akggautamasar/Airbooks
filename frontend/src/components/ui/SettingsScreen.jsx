import React from 'react';
import { motion } from 'framer-motion';
import { User, LogOut, Settings, ChevronRight, Shield, Info } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { api } from '../../utils/api';

export default function SettingsScreen() {
  const { state, actions } = useApp();

  async function handleLogout() {
    try { await api.logout(); } catch {}
    actions.logout();
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <div className="px-5 pt-14 pb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
      </div>

      {/* Profile */}
      {state.isLoggedIn && state.user ? (
        <div className="mx-5 mb-5 bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-xl">
            {(state.user.name || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white">{state.user.name}</p>
            {state.user.username && <p className="text-sm text-white/40">@{state.user.username}</p>}
            <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full mt-1 inline-block">
              Telegram Connected
            </span>
          </div>
        </div>
      ) : (
        <div className="mx-5 mb-5 bg-white/[0.04] border border-white/[0.07] rounded-2xl p-5 text-center">
          <User size={28} className="text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/50 mb-1">Not signed in</p>
          <p className="text-xs text-white/30">Go to Chats tab to login with Telegram</p>
        </div>
      )}

      {/* Menu items */}
      <div className="px-5 space-y-2">
        {[
          { icon: Shield, label: 'Privacy & Security', sub: 'Manage your data' },
          { icon: Info, label: 'About AirBooks', sub: 'Version 1.0' },
        ].map((item) => (
          <button key={item.label}
            className="w-full flex items-center gap-3 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
              <item.icon size={16} className="text-white/60" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-white/35">{item.sub}</p>
            </div>
            <ChevronRight size={15} className="text-white/25" />
          </button>
        ))}

        {state.isLoggedIn && (
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 mt-4">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <LogOut size={16} className="text-red-400" />
            </div>
            <p className="text-sm font-medium text-red-400">Sign Out</p>
          </button>
        )}
      </div>
    </div>
  );
}
