import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, RefreshCw, LogIn, Hash, Film, Music, Image, FileText } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import ChannelPage from './ChannelPage';

const TYPE_ICONS = { video: Film, audio: Music, image: Image, pdf: FileText, epub: FileText };
const CHANNEL_COLORS = [
  ['#3478f6','#5856d6'], ['#34c759','#30d158'], ['#ff9500','#ff6b00'],
  ['#ff3b30','#ff2d55'], ['#5856d6','#af52de'], ['#00c7be','#32ade6'],
];

function ChannelCard({ channel, idx, onClick }) {
  const [c1, c2] = CHANNEL_COLORS[idx % CHANNEL_COLORS.length];
  const initials = (channel.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick}
      style={{ width: '100%', background: 'white', borderRadius: '16px', padding: '14px 16px',
               display: 'flex', alignItems: 'center', gap: '12px', border: 'none', cursor: 'pointer',
               boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '10px', textAlign: 'left' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                    background: `linear-gradient(135deg, ${c1}, ${c2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: '700', fontSize: '16px' }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: '600', fontSize: '15px', color: '#1c1c1e', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {channel.name}
        </p>
        {channel.description && (
          <p style={{ fontSize: '13px', color: '#8e8e93', margin: '2px 0 0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {channel.description}
          </p>
        )}
      </div>
      <ChevronRight size={16} color="#c7c7cc" />
    </motion.button>
  );
}

export default function DiscoverScreen() {
  const { state, actions } = useApp();
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  async function load() {
    try {
      const res = await api.getDiscoverChannels();
      actions.setDiscover(res.channels || []);
      setHasSession(res.has_session || false);
    } catch {}
  }

  async function handleRefresh() {
    if (!state.isLoggedIn) return;
    setLoading(true);
    try {
      await api.triggerDiscoverRefresh();
      await new Promise(r => setTimeout(r, 2000));
      await load();
    } catch {}
    setLoading(false);
  }

  if (activeChannel) {
    return <ChannelPage channel={activeChannel} source="discover" onBack={() => setActiveChannel(null)} />;
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f2f2f7' }}>
      {/* Header */}
      <div style={{ padding: '52px 20px 16px', background: '#f2f2f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1c1c1e', margin: 0 }}>Discover</h1>
            <p style={{ fontSize: '14px', color: '#8e8e93', margin: '2px 0 0' }}>Browse content channels</p>
          </div>
          {state.isLoggedIn && (
            <button onClick={handleRefresh} style={{ width: '36px', height: '36px', borderRadius: '10px',
              background: 'white', border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <RefreshCw size={16} color="#3478f6" className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px 100px' }}>
        {/* Not logged in */}
        {!state.isLoggedIn && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px',
                        textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px',
                          background: '#e8f0ff', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', margin: '0 auto 12px' }}>
              <LogIn size={24} color="#3478f6" />
            </div>
            <p style={{ fontWeight: '600', fontSize: '16px', color: '#1c1c1e', margin: '0 0 6px' }}>
              Login to load channels
            </p>
            <p style={{ fontSize: '13px', color: '#8e8e93', margin: '0 0 16px', lineHeight: '1.5' }}>
              Discover channels need your Telegram account to scan content. Go to Chats tab to login.
            </p>
            <button onClick={() => actions.setTab('chats')}
              style={{ background: '#3478f6', color: 'white', border: 'none', borderRadius: '12px',
                       padding: '10px 24px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
              Login with Telegram
            </button>
          </div>
        )}

        {/* Logged in but scanning */}
        {state.isLoggedIn && !hasSession && state.discoverChannels.length === 0 && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px',
                        textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #e8f0ff',
                          borderTopColor: '#3478f6', animation: 'spin 1s linear infinite',
                          margin: '0 auto 12px' }} />
            <p style={{ fontWeight: '600', fontSize: '15px', color: '#1c1c1e', margin: '0 0 4px' }}>
              Scanning channels...
            </p>
            <p style={{ fontSize: '13px', color: '#8e8e93', margin: 0 }}>
              This may take a few minutes for large channels
            </p>
          </div>
        )}

        {/* Channels list */}
        {state.discoverChannels.length > 0 && (
          <div>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        margin: '0 4px 10px', padding: '0' }}>
              CHANNELS
            </p>
            {state.discoverChannels.map((ch, i) => (
              <ChannelCard key={ch.str_id || ch.id} channel={ch} idx={i}
                onClick={() => setActiveChannel(ch)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
