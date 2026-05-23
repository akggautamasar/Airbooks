import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Film, Music, Image, BookOpen, Search, Hash, ChevronRight, RefreshCw, Play, FileText } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import ChannelPage from './ChannelPage';

const TYPE_COLORS = {
  video: 'from-purple-600 to-blue-600',
  pdf:   'from-red-600 to-orange-500',
  audio: 'from-green-600 to-teal-500',
  image: 'from-pink-600 to-rose-500',
  epub:  'from-amber-600 to-yellow-500',
};
const TYPE_ICONS = { video: Film, audio: Music, image: Image, pdf: FileText, epub: BookOpen };

function ChannelCard({ channel, onClick }) {
  const totalFiles = channel.file_count || 0;
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 text-left hover:bg-white/[0.07] transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shrink-0">
          <Hash size={20} className="text-white/80" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">{channel.name}</p>
          {channel.username && <p className="text-xs text-white/40">@{channel.username}</p>}
        </div>
        <ChevronRight size={16} className="text-white/30 shrink-0" />
      </div>
      {channel.description && (
        <p className="text-xs text-white/40 mt-2 line-clamp-2">{channel.description}</p>
      )}
    </motion.button>
  );
}

export default function DiscoverScreen() {
  const { state, actions } = useApp();
  const [loading, setLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);

  useEffect(() => {
    if (state.discoverChannels.length === 0) load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getDiscoverChannels();
      actions.setDiscover(res.channels || []);
    } catch {}
    setLoading(false);
  }

  if (activeChannel) {
    return <ChannelPage channel={activeChannel} source="discover" onBack={() => setActiveChannel(null)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Discover</h1>
            <p className="text-sm text-white/40 mt-0.5">Browse content channels</p>
          </div>
          <button onClick={load} className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
            <RefreshCw size={15} className={`text-white/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && state.discoverChannels.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw size={20} className="animate-spin text-white/30" />
        </div>
      ) : state.discoverChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <Hash size={32} className="text-white/10" />
          <p className="text-sm text-white/30">No channels configured</p>
          <p className="text-xs text-white/20">Add BOT_CHANNELS to your .env</p>
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {state.discoverChannels.map((ch, i) => (
            <motion.div key={ch.str_id || ch.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}>
              <ChannelCard channel={ch} onClick={() => setActiveChannel(ch)} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
