import React, { useEffect, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import ChannelPage from '../discover/ChannelPage';

const COLORS = [
  '#9C27B0','#00BCD4','#3F51B5','#E91E63',
  '#4CAF50','#FF5722','#2196F3','#FF9800',
  '#009688','#F44336','#673AB7','#607D8B',
];

function getInitials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (name || '??').slice(0, 2).toUpperCase();
}

function getColor(id) {
  return COLORS[Math.abs(Number(id) || 0) % COLORS.length];
}

function ChatCard({ chat, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  const color = getColor(chat.id);
  const ini = getInitials(chat.name);
  const typeLabel = chat.type === 'channel' ? 'Channel'
    : (chat.type === 'group' || chat.type === 'supergroup') ? 'Group'
    : 'Chat';

  return (
    <button
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: '16px',
        border: 'none',
        cursor: 'pointer',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        boxShadow: '0 1px 6px rgba(0,0,0,0.09)',
        position: 'relative',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Photo square — fixed padding-top trick for true square */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '100%' }}>
        {/* Colored background always rendered — image overlays it */}
        <div style={{
          position: 'absolute', inset: 0,
          background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: '800', fontSize: '22px',
          borderRadius: '16px 16px 0 0',
        }}>
          {ini}
        </div>
        {/* Image on top — if it loads it covers initials, if not initials show */}
        {!imgFailed && (
          <img
            src={api.chatPhotoUrl('user', chat.id)}
            alt=""
            onError={() => setImgFailed(true)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              borderRadius: '16px 16px 0 0',
            }}
          />
        )}
      </div>

      {/* Text area */}
      <div style={{ padding: '8px 8px 10px', textAlign: 'center' }}>
        <p style={{
          fontSize: '11px', fontWeight: '600', color: '#1c1c1e',
          margin: '0 0 5px', lineHeight: '1.3',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {chat.name}
        </p>
        <span style={{
          display: 'inline-block',
          fontSize: '9px', fontWeight: '600', color: '#8e8e93',
          background: '#f2f2f7', borderRadius: '5px', padding: '1px 7px',
        }}>
          {typeLabel}
        </span>
      </div>

      {/* Unread badge */}
      {chat.unread > 0 && (
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          background: '#3478f6', color: 'white',
          fontSize: '9px', fontWeight: '800',
          borderRadius: '8px', padding: '2px 5px',
          minWidth: '16px', textAlign: 'center', lineHeight: '13px',
        }}>
          {chat.unread > 99 ? '99+' : chat.unread}
        </div>
      )}
    </button>
  );
}

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'channel', label: 'Channels' },
  { key: 'group',   label: 'Groups' },
  { key: 'private', label: 'Private' },
];

const CACHE_KEY = 'airbooks_chats_v1';

export default function ChatsScreen() {
  const { state, actions } = useApp();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    if (!state.isLoggedIn) return;
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.chats?.length) actions.setChats(cached.chats);
    } catch {}
    refresh(state.userChats.length === 0);
  }, [state.isLoggedIn]);

  async function refresh(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.getChats();
      const chats = res.chats || [];
      actions.setChats(chats);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ chats, ts: Date.now() }));
    } catch {}
    setLoading(false);
  }

  if (activeChat) {
    return <ChannelPage channel={activeChat} source="user" onBack={() => setActiveChat(null)} />;
  }

  const visible = state.userChats.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || c.name.toLowerCase().includes(q)
      || (c.username || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all'
      || (filter === 'group'
        ? c.type === 'group' || c.type === 'supergroup'
        : c.type === filter);
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, background: '#f2f2f7', padding: '50px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '26px', fontWeight: '800', color: '#1c1c1e' }}>Chats</span>
          {state.isLoggedIn && (
            <button onClick={() => refresh(true)} style={{
              width: '36px', height: '36px', borderRadius: '10px', background: 'white',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            }}>
              <RefreshCw size={15} color="#3478f6"
                style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
        </div>

        {state.isLoggedIn && (
          <>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={14} color="#8e8e93" style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search chats..."
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'white', border: 'none', borderRadius: '12px',
                  padding: '10px 12px 10px 36px', fontSize: '14px', color: '#1c1c1e',
                  outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  flexShrink: 0, padding: '5px 14px', borderRadius: '16px',
                  border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px',
                  background: filter === f.key ? '#3478f6' : 'white',
                  color: filter === f.key ? 'white' : '#636366',
                  boxShadow: filter === f.key
                    ? '0 2px 6px rgba(52,120,246,0.25)'
                    : '0 1px 3px rgba(0,0,0,0.08)',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 12px 100px' }}>
        {!state.isLoggedIn ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <p style={{ fontSize: '17px', fontWeight: '600', color: '#1c1c1e', margin: '0 0 8px' }}>
              Sign in with Telegram
            </p>
            <p style={{ fontSize: '14px', color: '#8e8e93', lineHeight: '1.5', margin: 0 }}>
              Browse your channels, groups and chats
            </p>
          </div>
        ) : loading && visible.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 5px rgba(0,0,0,0.06)' }}>
                <div style={{ width: '100%', paddingTop: '100%', background: '#e5e5ea' }} />
                <div style={{ padding: '8px 8px 10px' }}>
                  <div style={{ height: '10px', background: '#e5e5ea', borderRadius: '5px', marginBottom: '6px' }} />
                  <div style={{ height: '14px', background: '#e5e5ea', borderRadius: '7px', width: '55%', margin: '0 auto' }} />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#8e8e93', padding: '40px', fontWeight: '500' }}>
            No chats found
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {visible.map(chat => (
              <ChatCard key={chat.id} chat={chat} onClick={() => setActiveChat(chat)} />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
