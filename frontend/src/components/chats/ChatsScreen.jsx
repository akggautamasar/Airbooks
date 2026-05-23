import React, { useEffect, useState } from 'react';
import { MessageCircle, Search, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import ChannelPage from '../discover/ChannelPage';

const PALETTE = ['#3478f6','#34c759','#ff9500','#ff3b30','#5856d6','#00c7be','#ff2d55','#af52de','#30b0c7','#32ade6'];

function ChatPhoto({ chat }) {
  const [src, setSrc] = useState(api.chatPhotoUrl('user', chat.id));
  const [failed, setFailed] = useState(false);
  const color = PALETTE[Math.abs(chat.id||0) % PALETTE.length];
  const initials = (chat.name||'?').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '?';

  if (failed || !src) {
    return (
      <div style={{ width:'100%', aspectRatio:'1', borderRadius:'20px',
                    background: `linear-gradient(135deg, ${color}cc, ${color})`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'white', fontWeight:'800', fontSize:'22px', letterSpacing:'-0.5px' }}>
        {initials}
      </div>
    );
  }

  return (
    <img src={src} alt={chat.name}
      style={{ width:'100%', aspectRatio:'1', borderRadius:'20px', objectFit:'cover', display:'block' }}
      onError={() => setFailed(true)} />
  );
}

function ChatCard({ chat, onClick }) {
  const typeLabel = chat.type === 'channel' ? 'Channel' :
    (chat.type === 'group' || chat.type === 'supergroup') ? 'Group' : 'Private';
  const typeColor = chat.type === 'channel' ? '#5856d6' :
    (chat.type === 'group' || chat.type === 'supergroup') ? '#34c759' : '#3478f6';

  return (
    <button onClick={onClick}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'9px',
               background:'white', borderRadius:'20px', padding:'14px 10px 12px',
               border:'none', cursor:'pointer', width:'100%', textAlign:'center',
               boxShadow:'0 2px 8px rgba(0,0,0,0.07)', transition:'transform 0.1s, box-shadow 0.1s',
               position:'relative' }}
      onPointerDown={e => { e.currentTarget.style.transform='scale(0.96)'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.08)'; }}
      onPointerUp={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)'; }}
      onPointerLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)'; }}>
      
      {/* Photo */}
      <div style={{ width:'100%' }}>
        <ChatPhoto chat={chat} />
      </div>

      {/* Name */}
      <p style={{ fontSize:'11px', fontWeight:'600', color:'#1c1c1e', margin:0, width:'100%',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:'1.3' }}>
        {chat.name}
      </p>

      {/* Type badge */}
      <span style={{ fontSize:'9px', fontWeight:'700', color: typeColor,
                     background: typeColor+'15', borderRadius:'6px', padding:'2px 7px',
                     letterSpacing:'0.2px' }}>
        {typeLabel}
      </span>

      {/* Unread badge */}
      {chat.unread > 0 && (
        <div style={{ position:'absolute', top:'10px', right:'10px',
                      background:'#3478f6', color:'white', fontSize:'9px', fontWeight:'800',
                      borderRadius:'10px', padding:'2px 6px', minWidth:'18px', textAlign:'center',
                      lineHeight:'14px' }}>
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
    { key:'all', label:'All' },
    { key:'channel', label:'Channels' },
    { key:'group', label:'Groups' },
    { key:'private', label:'Private' },
  ];

  const filtered = state.userChats.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.username||'').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' ||
      (filter === 'group' ? (c.type === 'group' || c.type === 'supergroup') : c.type === filter);
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f2f2f7', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:'#f2f2f7', padding:'52px 16px 12px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <MessageCircle size={24} color="#3478f6" />
            <h1 style={{ fontSize:'26px', fontWeight:'800', color:'#1c1c1e', margin:0, letterSpacing:'-0.5px' }}>Chats</h1>
          </div>
          {state.isLoggedIn && (
            <button onClick={() => load(true)}
              style={{ width:'36px', height:'36px', borderRadius:'12px', background:'white', border:'none',
                       cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                       boxShadow:'0 1px 4px rgba(0,0,0,0.1)' }}>
              <RefreshCw size={16} color="#3478f6"
                style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
        </div>

        {state.isLoggedIn && (
          <>
            {/* Search */}
            <div style={{ position:'relative', marginBottom:'12px' }}>
              <Search size={15} color="#8e8e93"
                style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search chats..."
                style={{ width:'100%', background:'white', border:'none', borderRadius:'14px',
                         padding:'11px 14px 11px 40px', fontSize:'14px', color:'#1c1c1e',
                         outline:'none', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }} />
            </div>

            {/* Filter chips */}
            <div style={{ display:'flex', gap:'7px', overflowX:'auto', scrollbarWidth:'none' }}>
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  style={{ padding:'6px 16px', borderRadius:'20px', border:'none', cursor:'pointer',
                           flexShrink:0, fontWeight:'600', fontSize:'12px', transition:'all 0.15s',
                           background: filter===f.key ? '#3478f6' : 'white',
                           color: filter===f.key ? 'white' : '#636366',
                           boxShadow: filter===f.key ? '0 2px 8px rgba(52,120,246,0.3)' : '0 1px 4px rgba(0,0,0,0.08)' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 100px' }}>
        {!state.isLoggedIn ? (
          <div style={{ textAlign:'center', padding:'40px 24px' }}>
            <div style={{ width:'72px', height:'72px', borderRadius:'20px', background:'#e8f0ff',
                          display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <MessageCircle size={32} color="#3478f6" />
            </div>
            <p style={{ fontWeight:'700', fontSize:'18px', color:'#1c1c1e', margin:'0 0 8px' }}>
              Sign in with Telegram
            </p>
            <p style={{ fontSize:'14px', color:'#8e8e93', lineHeight:'1.5', margin:0 }}>
              Browse all your channels, groups and private chats with their media files
            </p>
          </div>
        ) : loading && filtered.length === 0 ? (
          // Skeleton
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
            {Array.from({length:12}).map((_,i) => (
              <div key={i} style={{ background:'white', borderRadius:'20px', padding:'14px 10px 12px',
                                    boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ width:'100%', aspectRatio:'1', borderRadius:'20px', background:'#e5e5ea',
                              marginBottom:'9px', animation:'shimmer 1.5s infinite' }} />
                <div style={{ height:'11px', background:'#e5e5ea', borderRadius:'4px', marginBottom:'6px',
                              animation:'shimmer 1.5s infinite' }} />
                <div style={{ height:'16px', background:'#e5e5ea', borderRadius:'8px', width:'60%',
                              margin:'0 auto', animation:'shimmer 1.5s infinite' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px', color:'#8e8e93', fontSize:'15px', fontWeight:'500' }}>
            No chats found
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
            {filtered.map(chat => (
              <ChatCard key={chat.id} chat={chat} onClick={() => setActiveChat(chat)} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0% { background: #e5e5ea; }
          50% { background: #f0f0f5; }
          100% { background: #e5e5ea; }
        }
      `}</style>
    </div>
  );
}
