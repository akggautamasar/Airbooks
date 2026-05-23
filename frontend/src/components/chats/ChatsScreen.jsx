import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Search, Users, User, Hash, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import ChannelPage from '../discover/ChannelPage';

const COLORS = ['#3478f6','#34c759','#ff9500','#ff3b30','#5856d6','#00c7be','#ff2d55','#af52de'];

function ChatCard({ chat, onClick }) {
  const color = COLORS[Math.abs(chat.id) % COLORS.length];
  const initials = (chat.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
      width: '100%', textAlign: 'left', transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background='#f2f2f7'}
      onMouseLeave={e => e.currentTarget.style.background='none'}>
      <div style={{ width: '50px', height: '50px', borderRadius: '14px', flexShrink: 0,
                    background: color+'25', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: color, fontWeight: '700', fontSize: '16px' }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: '600', fontSize: '15px', color: '#1c1c1e', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {chat.name}
        </p>
        {chat.username && (
          <p style={{ fontSize: '13px', color: '#8e8e93', margin: '2px 0 0' }}>@{chat.username}</p>
        )}
      </div>
      {chat.unread > 0 && (
        <span style={{ background: '#3478f6', color: 'white', fontSize: '11px', fontWeight: '700',
                        borderRadius: '10px', padding: '2px 7px', flexShrink: 0 }}>
          {chat.unread > 99 ? '99+' : chat.unread}
        </span>
      )}
    </button>
  );
}

export default function ChatsScreen() {
  const { state, actions } = useApp();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeChat, setActiveChat] = useState(null);

  const CHAT_CACHE = 'airbooks_chats_v1';

  useEffect(() => {
    if (!state.isLoggedIn) return;
    // Load from cache instantly
    try {
      const cached = JSON.parse(localStorage.getItem(CHAT_CACHE) || 'null');
      if (cached?.chats?.length) {
        actions.setChats(cached.chats);
      }
    } catch {}
    // Then refresh in background
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

  const filtered = state.userChats.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.username||'').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#f2f2f7', padding: '52px 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1c1c1e', margin: 0 }}>Chats</h1>
          {state.isLoggedIn && (
            <button onClick={load} style={{ width: '36px', height: '36px', borderRadius: '10px',
              background: 'white', border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <RefreshCw size={16} color="#3478f6" className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
        {state.isLoggedIn && (
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8e8e93' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..."
              style={{ width: '100%', background: 'white', border: 'none', borderRadius: '12px',
                       padding: '10px 12px 10px 34px', fontSize: '14px', color: '#1c1c1e',
                       outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!state.isLoggedIn ? (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '32px 24px',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#e8f0ff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <MessageCircle size={28} color="#3478f6" />
              </div>
              <p style={{ fontWeight: '600', fontSize: '17px', color: '#1c1c1e', margin: '0 0 8px' }}>
                Sign in to Telegram
              </p>
              <p style={{ fontSize: '14px', color: '#8e8e93', margin: '0 0 20px', lineHeight: '1.5' }}>
                Login with your Telegram phone number to browse your channels and groups
              </p>
              <button onClick={() => {/* login overlay shows automatically */}}
                style={{ background: '#3478f6', color: 'white', border: 'none', borderRadius: '12px',
                         padding: '12px 28px', fontWeight: '600', fontSize: '15px', cursor: 'pointer' }}>
                Login with Telegram
              </button>
            </div>
          </div>
        ) : loading && filtered.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid #e5e5ea',
                          borderTopColor: '#3478f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ background: 'white', marginTop: '8px', borderRadius: '0' }}>
            {filtered.map((chat, i) => (
              <div key={chat.id}>
                <ChatCard chat={chat} onClick={() => setActiveChat(chat)} />
                {i < filtered.length - 1 && (
                  <div style={{ height: '1px', background: '#f2f2f7', marginLeft: '78px' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
