import React, { useEffect, useState } from 'react';
import { MessageCircle, Search, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import ChannelPage from '../discover/ChannelPage';

const TYPE_COLORS = ['#3478f6','#34c759','#ff9500','#ff3b30','#5856d6','#00c7be','#ff2d55','#af52de'];

function ChatAvatar({ chat, source }) {
  const [errored, setErrored] = useState(false);
  const color = TYPE_COLORS[Math.abs(chat.id||0) % TYPE_COLORS.length];
  const initials = (chat.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const photoUrl = api.chatPhotoUrl(source || 'user', chat.id);

  if (!errored) {
    return (
      <div style={{ width:'70px', height:'70px', borderRadius:'16px', overflow:'hidden', flexShrink:0, margin:'0 auto', position:'relative' }}>
        <img src={photoUrl} alt={chat.name}
          style={{ width:'100%', height:'100%', objectFit:'cover' }}
          onError={() => setErrored(true)} />
      </div>
    );
  }
  return (
    <div style={{ width:'70px', height:'70px', borderRadius:'16px', background: color+'25', flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto',
                  color, fontWeight:'700', fontSize:'22px' }}>
      {initials}
    </div>
  );
}

function ChatCard({ chat, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px',
               background:'white', borderRadius:'16px', padding:'14px 8px',
               border:'none', cursor:'pointer', textAlign:'center',
               boxShadow:'0 1px 4px rgba(0,0,0,0.08)', transition:'transform 0.15s' }}
      onMouseDown={e => e.currentTarget.style.transform='scale(0.97)'}
      onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
      onTouchStart={e => e.currentTarget.style.transform='scale(0.97)'}
      onTouchEnd={e => e.currentTarget.style.transform='scale(1)'}>
      <ChatAvatar chat={chat} source="user" />
      <div style={{ width:'100%' }}>
        <p style={{ fontSize:'12px', fontWeight:'600', color:'#1c1c1e', margin:0,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {chat.name}
        </p>
        <span style={{ fontSize:'10px', color:'#8e8e93', background:'#f2f2f7',
                       borderRadius:'6px', padding:'1px 6px', display:'inline-block', marginTop:'3px' }}>
          {chat.type === 'channel' ? 'Channel' : chat.type === 'group' || chat.type === 'supergroup' ? 'Group' : 'Private'}
        </span>
      </div>
      {chat.unread > 0 && (
        <span style={{ position:'absolute', top:'10px', right:'10px', background:'#3478f6', color:'white',
                       fontSize:'10px', fontWeight:'700', borderRadius:'10px', padding:'1px 6px' }}>
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

  const FILTERS = ['all', 'channel', 'group', 'private'];
  let filtered = state.userChats.filter(c =>
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.username||'').toLowerCase().includes(search.toLowerCase())) &&
    (filter === 'all' || (filter === 'group' ? (c.type === 'group' || c.type === 'supergroup') : c.type === filter))
  );

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f2f2f7', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:'#f2f2f7', padding:'52px 16px 12px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <h1 style={{ fontSize:'28px', fontWeight:'700', color:'#1c1c1e', margin:0 }}>Chats</h1>
          {state.isLoggedIn && (
            <button onClick={() => load(true)}
              style={{ width:'36px', height:'36px', borderRadius:'10px', background:'white', border:'none',
                       cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                       boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>
              <RefreshCw size={16} color="#3478f6" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
        </div>
        {state.isLoggedIn && (
          <>
            <div style={{ position:'relative', marginBottom:'10px' }}>
              <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#8e8e93' }} />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats..."
                style={{ width:'100%', background:'white', border:'none', borderRadius:'12px',
                         padding:'10px 12px 10px 34px', fontSize:'14px', color:'#1c1c1e',
                         outline:'none', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }} />
            </div>
            {/* Filter chips */}
            <div style={{ display:'flex', gap:'6px', overflowX:'auto', scrollbarWidth:'none', paddingBottom:'2px' }}>
              {FILTERS.map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding:'5px 14px', borderRadius:'16px', border:'none', cursor:'pointer', flexShrink:0,
                           fontWeight:'600', fontSize:'12px',
                           background: filter===f ? '#3478f6' : 'white',
                           color: filter===f ? 'white' : '#8e8e93',
                           boxShadow: filter===f ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)+'s'}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        {!state.isLoggedIn ? (
          <div style={{ padding:'16px', textAlign:'center' }}>
            <div style={{ background:'white', borderRadius:'16px', padding:'32px 24px', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ width:'64px', height:'64px', borderRadius:'16px', background:'#e8f0ff',
                            display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <MessageCircle size={28} color="#3478f6" />
              </div>
              <p style={{ fontWeight:'600', fontSize:'17px', color:'#1c1c1e', margin:'0 0 8px' }}>Sign in to Telegram</p>
              <p style={{ fontSize:'14px', color:'#8e8e93', margin:'0 0 20px', lineHeight:'1.5' }}>
                Browse your channels, groups and chats
              </p>
            </div>
          </div>
        ) : loading && filtered.length === 0 ? (
          // Skeleton grid
          <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
            {[1,2,3,4,5,6,7,8,9].map(i => (
              <div key={i} style={{ background:'white', borderRadius:'16px', padding:'14px 8px',
                                    boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ width:'70px', height:'70px', borderRadius:'16px', background:'#e5e5ea',
                              margin:'0 auto 8px', animation:'shimmer 1.5s infinite' }} />
                <div style={{ height:'10px', background:'#e5e5ea', borderRadius:'4px', margin:'0 auto',
                              width:'80%', animation:'shimmer 1.5s infinite' }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', paddingBottom:'100px' }}>
            {filtered.map(chat => (
              <div key={chat.id} style={{ position:'relative' }}>
                <ChatCard chat={chat} onClick={() => setActiveChat(chat)} />
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      `}</style>
    </div>
  );
}
