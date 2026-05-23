import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Search, Users, User, Hash, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import ChannelPage from '../discover/ChannelPage';

const TYPE_ICONS = { channel: Hash, group: Users, supergroup: Users, private: User };
const COLORS = ['from-blue-600 to-blue-800','from-purple-600 to-purple-800','from-green-600 to-green-800',
                 'from-red-600 to-red-800','from-orange-600 to-orange-800','from-teal-600 to-teal-800'];

function ChatCard({ chat, onClick }) {
  const Icon = TYPE_ICONS[chat.type] || Hash;
  const color = COLORS[Math.abs(chat.id) % COLORS.length];
  const initials = (chat.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);

  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors text-left">
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0 text-white font-bold text-sm`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-white truncate">{chat.name}</p>
          <Icon size={11} className="text-white/30 shrink-0" />
        </div>
        {chat.username && <p className="text-xs text-white/35">@{chat.username}</p>}
      </div>
      {chat.unread > 0 && (
        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
          {chat.unread > 99 ? '99+' : chat.unread}
        </span>
      )}
    </motion.button>
  );
}

export default function ChatsScreen() {
  const { state, actions } = useApp();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    if (state.isLoggedIn && state.userChats.length === 0) load();
  }, [state.isLoggedIn]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getChats();
      actions.setChats(res.chats || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (activeChat) {
    return <ChannelPage channel={activeChat} source="user" onBack={() => setActiveChat(null)} />;
  }

  const filtered = state.userChats.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.username || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!state.isLoggedIn) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 pb-24">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mb-4">
          <MessageCircle size={28} className="text-white/30" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Sign in to see your chats</h3>
        <p className="text-sm text-white/40 text-center">Login with your Telegram account to browse your channels and groups</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 pt-14 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Chats</h1>
            <p className="text-sm text-white/40 mt-0.5">{state.userChats.length} conversations</p>
          </div>
          <button onClick={load} className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
            <RefreshCw size={15} className={`text-white/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 divide-y divide-white/[0.04]">
        {loading && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : filtered.map((chat, i) => (
          <motion.div key={chat.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
            <ChatCard chat={chat} onClick={() => setActiveChat(chat)} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
