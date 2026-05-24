import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa_dismissed') === 'true'
  );

  useEffect(() => {
    // Capture the install prompt
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      // Show after 30 seconds if not dismissed
      setTimeout(() => setShown(true), 30000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setShown(false);
    setPrompt(null);
  }

  function dismiss() {
    setShown(false);
    setDismissed(true);
    localStorage.setItem('pwa_dismissed', 'true');
  }

  if (!prompt || !shown || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '90px', left: '16px', right: '16px', zIndex: 500,
      background: 'white', borderRadius: '18px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      padding: '16px', display: 'flex', alignItems: 'center', gap: '12px',
      animation: 'slideUp 0.3s ease',
    }}>
      {/* Icon */}
      <div style={{
        width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
        background: 'linear-gradient(135deg,#3478f6,#5856d6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: 'white', fontWeight: '800', fontSize: '16px' }}>AB</span>
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: '700', fontSize: '14px', color: '#1c1c1e', margin: '0 0 2px' }}>
          Install AirBooks
        </p>
        <p style={{ fontSize: '12px', color: '#8e8e93', margin: 0 }}>
          Add to home screen for the full app experience
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={dismiss} style={{
          width: '32px', height: '32px', borderRadius: '50%', background: '#f2f2f7',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={14} color="#8e8e93" />
        </button>
        <button onClick={install} style={{
          padding: '8px 14px', borderRadius: '10px', background: '#3478f6',
          border: 'none', cursor: 'pointer', color: 'white',
          fontWeight: '700', fontSize: '13px',
          display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          <Download size={13} /> Install
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
