import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../utils/api';

/**
 * Shows live scan progress via SSE.
 * When done, calls onDone(files) — but files come from the /files endpoint.
 * This component just tracks the scanning state visually.
 */
export default function ScanProgress({ chatId, source, forceRefresh, onDone, color = '#3478f6' }) {
  const [state, setState] = useState({
    msg: 0, scanned: 0, rate: 0, elapsed: 0,
    done: false, fromCache: false, channelName: '', scannedAt: '',
  });
  const esRef = useRef(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!chatId) return;

    // For discover source, no SSE — just show spinner
    if (source === 'discover') {
      onDone && onDone();
      return;
    }

    startRef.current = Date.now();
    const es = api.scanProgress(chatId, forceRefresh);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        setState(prev => ({ ...prev, ...d }));
        if (d.done || d.from_cache) {
          es.close();
          // Small delay then notify parent to fetch files
          setTimeout(() => onDone && onDone(d), 300);
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      // On SSE error, just proceed to load files normally
      onDone && onDone({ done: true, error: true });
    };

    return () => es.close();
  }, [chatId, forceRefresh]);

  if (state.done || state.fromCache) return null;

  const elapsed = state.elapsed || Math.round((Date.now() - startRef.current) / 1000);
  const rate = state.rate || 0;

  function fmt(secs) {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }

  return (
    <div style={{
      margin: '8px 0 4px',
      background: 'white',
      borderRadius: '14px',
      padding: '14px 16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: color, animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1c1c1e' }}>
            Scanning messages
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#8e8e93', fontWeight: '500' }}>
          {fmt(elapsed)}
        </span>
      </div>

      {/* Animated progress bar (indeterminate since we don't know total) */}
      <div style={{ height: '4px', background: '#f2f2f7', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
        <div style={{
          height: '100%', width: '40%',
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          borderRadius: '2px',
          animation: 'scan-slide 1.5s ease-in-out infinite',
        }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '16px', fontWeight: '800', color: '#1c1c1e' }}>
            {state.scanned.toLocaleString()}
          </span>
          <span style={{ fontSize: '11px', color: '#8e8e93', marginLeft: '4px' }}>files found</span>
        </div>
        <div>
          <span style={{ fontSize: '16px', fontWeight: '800', color: '#1c1c1e' }}>
            {state.msg.toLocaleString()}
          </span>
          <span style={{ fontSize: '11px', color: '#8e8e93', marginLeft: '4px' }}>msgs scanned</span>
        </div>
        {rate > 0 && (
          <div>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#1c1c1e' }}>
              {Math.round(rate)}
            </span>
            <span style={{ fontSize: '11px', color: '#8e8e93', marginLeft: '4px' }}>msg/s</span>
          </div>
        )}
      </div>

      <p style={{ fontSize: '11px', color: '#8e8e93', margin: '8px 0 0', lineHeight: '1.5' }}>
        First visit only — results will be cached permanently after this.
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes scan-slide {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
