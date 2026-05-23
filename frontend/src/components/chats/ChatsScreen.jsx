import React, { useEffect, useState, useRef } from 'react';
import { MessageCircle, Search, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import ChannelPage from '../discover/ChannelPage';

const PALETTE = [
  '#2196F3','#E91E63','#4CAF50','#FF5722','#9C27B0',
  '#00BCD4','#FF9800','#3F51B5','#009688','#F44336',
];

function ChatPhoto({ chat }) {
  const [failed, setFailed] = useState(false);
  const color = PALETTE[Math.abs(chat.id || 0) % PALETTE.length];
  const words = (chat.name || '?').split(' ');
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : (chat.name || '?').slice(0, 2).toUpperCase();

  if (failed) {
    return (
      <div style={{
        width: '100%', aspectRatio: '1', borderRadius: '16px',
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: '700', fontSize: '20px',
      }}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={api.chatPhotoUrl('user', chat.id)}
      alt={chat.name}
      style={{ width: '100%', aspectRatio: '1', borderRadius: '16px', objectFit: 'cover', display: 'block' }}
      onError={() => setFailed(true)}
    />
  );
}

function ChatCard({ chat, onClick }) {
  const typeLabel = chat.type === 'channel' ? 'Channel'
    : (chat.type === 'group' || chat.type === 'supergroup') ? 'Group'
    : 'Private';

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: 'white', borderRadius: '16px', padding: '12px 8px 10px',
        border: 'none', cursor: 'pointer', width: '100%',
        boxShadow: '0 1px 6px rgba(0,0,0,0.08)', position: 'relative',
        gap: '6px', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ width: '100%' }}>
        <ChatPhoto chat={chat} />
      </div>
      <p style={{
        fontSize: '11px', fontWeight: '600', color: '#1c1c1e',
        margin: 0, width: '100%', textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: '1.3',
      }}>
        {chat.name}
      </p>
      <span style={{
        fontSize: '9px', fontWeight: '600', color: '#636366',
        background: '#f2f2f7', borderRadius: '5px', padding: '1px 6px',
      }}>
        {typeLabel}
      </span>
      {chat.unread > 0 && (
        <div style={{
          position: 'absolute', top: '8px', right: '8px',
          background: '#3478f6', color: 'white',
          fontSize: '9px', fontWeight: '800', borderRadius: '9px',
          padding: '1px 5px', minWidth: '16px', textAlign: 'center',
        }}>
          {chat.unread > 99 ? '99+' : chat.unread}
        </div>
      )}
    </button>
  );
}

export default function ChatsScreen() {
  const { state, actions } = useApp();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeChat, setActiveChat] = useState(null);
  const [filter, setFilter] = useState('all');
  const CHAT_CACHE = 'airbooks_chats_v1';

  useEffect(() => {
    if (!state.isLoggedIn) return;
    try {
      const cached = JSON.parse(localStorage.getItem(CHAT_CACHE) || 'null');
      if (cached?.chats?.length) actions.setChats(cached.chats);
    } catch {}
    load(state.userChats.length === 0);
  }, [state.isLoggedIn]);

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.getChats();
      const chats = res.chats || [];
      actions.setChats(chats);
      localStorage.setItem(CHAT_CACHE, JSON.stringify({ chats, ts: Date.now() }));
    } catch {}
    setLoading(false);
  }

  if (activeChat) {
    return <ChannelPage channel={activeChat} source="user" onBack={() => setActiveChat(null)} />;
  }

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'channel', label: 'Channels' },
    { key: 'group', label: 'Groups' },
    { key: 'private', label: 'Private' },
  ];

  const filtered = state.userChats.filter(c => {
    const matchSearch = !search
      || c.name.toLowerCase().includes(search.toLowerCase())
      || (c.username || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all'
      || (filter === 'group' ? (c.type === 'group' || c.type === 'supergroup') : c.type === filter);
    return matchSearch && matchFilter;
  });

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: '#f2f2f7', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ background: '#f2f2f7', padding: '52px 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#1c1c1e', margin: 0 }}>Chats</h1>
          {state.isLoggedIn && (
            <button onClick={() => load(true)} style={{
              width: '36px', height: '36px', borderRadius: '12px', background: 'white',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            }}>
              <RefreshCw size={15} color="#3478f6"
                style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
        </div>

        {state.isLoggedIn && (
          <>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={14} color="#8e8e93"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search chats..."
                style={{
                  width: '100%', background: 'white', border: 'none', borderRadius: '12px',
                  padding: '10px 12px 10px 36px', fontSize: '14px', color: '#1c1c1e',
                  outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  padding: '5px 14px', borderRadius: '16px', border: 'none',
                  cursor: 'pointer', flexShrink: 0, fontWeight: '600', fontSize: '12px',
                  background: filter === f.key ? '#3478f6' : 'white',
                  color: filter === f.key ? 'white' : '#636366',
                  boxShadow: filter === f.key ? '0 2px 6px rgba(52,120,246,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Scrollable content — vertical only */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '10px 12px 100px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {!state.isLoggedIn ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{
              width: '68px', height: '68px', borderRadius: '18px', background: '#e8f0ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            }}>
              <MessageCircle size={30} color="#3478f6" />
            </div>
            <p style={{ fontWeight: '700', fontSize: '17px', color: '#1c1c1e', margin: '0 0 8px' }}>
              Sign in with Telegram
            </p>
            <p style={{ fontSize: '14px', color: '#8e8e93', lineHeight: '1.5', margin: 0 }}>
              Browse your channels, groups and chats
            </p>
          </div>
        ) : loading && filtered.length === 0 ? (
          // Skeleton — 3 column grid
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: '16px', padding: '12px 8px 10px',
                boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  width: '100%', aspectRatio: '1', borderRadius: '16px',
                  background: '#e5e5ea', marginBottom: '8px',
                  animation: 'shimmer 1.5s ease-in-out infinite',
                }} />
                <div style={{ height: '10px', background: '#e5e5ea', borderRadius: '4px', marginBottom: '6px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                <div style={{ height: '14px', background: '#e5e5ea', borderRadius: '7px', width: '55%', margin: '0 auto', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#8e8e93', fontSize: '15px', fontWeight: '500', padding: '40px' }}>
            No chats found
          </p>
        ) : (
          // 3-column grid, vertical scroll only
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {filtered.map(chat => (
              <ChatCard key={chat.id} chat={chat} onClick={() => setActiveChat(chat)} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
