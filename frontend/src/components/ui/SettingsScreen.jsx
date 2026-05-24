import React, { useEffect, useState } from 'react';
import { User, LogOut, Shield, Info, ChevronRight } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { api } from '../../utils/api';

export default function SettingsScreen() {
  const { state, actions } = useApp();

  async function handleLogout() {
    try { await api.logout(); } catch {}
    actions.logout();
  }

  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    // Also check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) setShowInstall(false);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
  }

    return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f2f2f7' }}>
      <div style={{ padding: '52px 16px 16px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1c1c1e', margin: '0 0 20px' }}>Settings</h1>
      </div>

      {/* Profile card */}
      {state.isLoggedIn && state.user ? (
        <div style={{ margin: '0 16px 20px', background: 'white', borderRadius: '16px',
                      padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px',
                        background: 'linear-gradient(135deg,#3478f6,#5856d6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: '700', fontSize: '20px' }}>
            {(state.user.name||'?')[0].toUpperCase()}
          </div>
          <div>
            <p style={{ fontWeight: '700', fontSize: '16px', color: '#1c1c1e', margin: 0 }}>{state.user.name}</p>
            {state.user.username && <p style={{ fontSize: '13px', color: '#8e8e93', margin: '3px 0 0' }}>@{state.user.username}</p>}
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#3478f6',
                           background: '#e8f0ff', borderRadius: '6px', padding: '2px 8px', display: 'inline-block', marginTop: '5px' }}>
              Connected
            </span>
          </div>
        </div>
      ) : (
        <div style={{ margin: '0 16px 20px', background: 'white', borderRadius: '16px',
                      padding: '20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <User size={32} color="#c7c7cc" style={{ margin: '0 auto 8px', display: 'block' }} />
          <p style={{ color: '#8e8e93', fontSize: '14px', margin: 0 }}>Not signed in</p>
        </div>
      )}

      {/* Menu */}
      <div style={{ margin: '0 16px', background: 'white', borderRadius: '16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {[
          { icon: Shield, label: 'Privacy & Security', sub: 'Manage your data', color: '#3478f6' },
          { icon: Info,   label: 'About AirBooks',     sub: 'Version 1.0',      color: '#8e8e93' },
        ].map((item, i, arr) => (
          <div key={item.label}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                             padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px',
                            background: item.color+'20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <item.icon size={16} color={item.color} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '500', fontSize: '15px', color: '#1c1c1e', margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: '12px', color: '#8e8e93', margin: '2px 0 0' }}>{item.sub}</p>
              </div>
              <ChevronRight size={15} color="#c7c7cc" />
            </button>
            {i < arr.length - 1 && <div style={{ height: '1px', background: '#f2f2f7', marginLeft: '60px' }} />}
          </div>
        ))}
      </div>

      {state.isLoggedIn && (
        <div style={{ margin: '16px 16px 100px' }}>
          <button onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                     background: 'white', borderRadius: '16px', padding: '14px 16px',
                     border: 'none', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ff3b3015',
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={16} color="#ff3b30" />
            </div>
            <span style={{ fontWeight: '500', fontSize: '15px', color: '#ff3b30' }}>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
