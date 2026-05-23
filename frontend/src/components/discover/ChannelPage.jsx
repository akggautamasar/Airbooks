import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Film, Music, Image, FileText, BookOpen, Search, Play, Download, ExternalLink } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';

const TABS = [
  { key: 'video', label: 'Videos', icon: Film },
  { key: 'audio', label: 'Music',  icon: Music },
  { key: 'image', label: 'Images', icon: Image },
  { key: 'pdf',   label: 'PDFs',   icon: FileText },
  { key: 'epub',  label: 'EPUBs',  icon: BookOpen },
];

function formatSize(b) {
  if (!b) return '';
  if (b > 1e9) return (b/1e9).toFixed(1)+' GB';
  if (b > 1e6) return (b/1e6).toFixed(1)+' MB';
  return (b/1e3).toFixed(0)+' KB';
}

export default function ChannelPage({ channel, source, onBack }) {
  const { actions, state } = useApp();
  const [tab, setTab] = useState('video');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true); setFiles([]);
    const load = source === 'discover'
      ? api.getChannelFiles(channel.str_id || String(channel.id), tab)
      : api.getChatFiles(channel.id, tab);
    load.then(r => setFiles(r.files || [])).catch(()=>{}).finally(() => setLoading(false));
  }, [tab, channel.id]);

  const filtered = files.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.caption||'').toLowerCase().includes(search.toLowerCase())
  );

  function play(file) { actions.play(file, source); }

  // Open Fast Player for videos
  function openFastPlayer(file) {
    const streamUrl = api.streamUrl(source, file.channel_id, file.msg_id);
    const backendBase = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
    window.open(`${backendBase}/player?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(file.name)}&id=${encodeURIComponent(file.id)}`, '_blank');
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#f2f2f7', padding: '52px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <button onClick={onBack} style={{ width: '36px', height: '36px', borderRadius: '10px',
            background: 'white', border: 'none', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flexShrink: 0 }}>
            <ArrowLeft size={18} color="#3478f6" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontWeight: '700', fontSize: '18px', color: '#1c1c1e', margin: 0,
                         overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {channel.name || channel.title}
            </h2>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8e8e93' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..."
            style={{ width: '100%', background: 'white', border: 'none', borderRadius: '12px',
                     padding: '10px 12px 10px 34px', fontSize: '14px', color: '#1c1c1e',
                     outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px',
                         padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                         background: active ? '#3478f6' : 'white', flexShrink: 0,
                         color: active ? 'white' : '#8e8e93', fontWeight: '600', fontSize: '13px',
                         boxShadow: active ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 100px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid #e5e5ea',
                          borderTopColor: '#3478f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: '#8e8e93', fontSize: '15px', fontWeight: '500' }}>No {tab}s found</p>
          </div>
        ) : tab === 'video' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {filtered.map(f => (
              <div key={f.id} style={{ background: 'white', borderRadius: '14px',
                                       overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {/* Thumbnail */}
                <div style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg,#1c1c3a,#2c2c54)',
                               display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <button onClick={() => openFastPlayer(f)}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                             background: 'rgba(255,255,255,0.15)', cursor: 'pointer',
                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                             backdropFilter: 'blur(8px)' }}>
                    <Play size={18} color="white" fill="white" />
                  </button>
                  {f.size > 0 && (
                    <span style={{ position: 'absolute', bottom: '6px', left: '6px',
                                   background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px',
                                   padding: '2px 6px', borderRadius: '6px', fontWeight: '600' }}>
                      {formatSize(f.size)}
                    </span>
                  )}
                </div>
                <div style={{ padding: '10px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#1c1c1e', margin: 0,
                               overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                               WebkitBoxOrient: 'vertical', lineHeight: '1.4' }}>
                    {f.name.replace(/\.[^.]+$/, '')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'image' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {filtered.map(f => {
              const src = api.streamUrl(source, f.channel_id, f.msg_id);
              return (
                <div key={f.id} style={{ aspectRatio: '1', borderRadius: '10px', overflow: 'hidden',
                                         background: '#e5e5ea', cursor: 'pointer' }}
                     onClick={() => play(f)}>
                  <img src={src} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display='none'; }} />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(f => {
              const Icon = tab === 'audio' ? Music : tab === 'epub' ? BookOpen : FileText;
              const color = tab === 'audio' ? '#34c759' : tab === 'epub' ? '#ff9500' : '#ff3b30';
              return (
                <button key={f.id} onClick={() => play(f)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white',
                            borderRadius: '14px', padding: '12px 14px', border: 'none', cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'left', width: '100%' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
                                background: color+'20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#1c1c1e', margin: 0,
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name.replace(/\.[^.]+$/, '')}
                    </p>
                    <p style={{ fontSize: '12px', color: '#8e8e93', margin: '2px 0 0' }}>
                      {formatSize(f.size)}
                    </p>
                  </div>
                  <Play size={16} color="#c7c7cc" />
                </button>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
