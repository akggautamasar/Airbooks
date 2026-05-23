import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Film, Music, Image, FileText, BookOpen, Search, Play, Download } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';

const TABS = [
  { key: 'video', label: 'Videos', icon: Film },
  { key: 'audio', label: 'Music',  icon: Music },
  { key: 'image', label: 'Images', icon: Image },
  { key: 'pdf',   label: 'PDFs',   icon: FileText },
  { key: 'epub',  label: 'EPUBs',  icon: BookOpen },
];

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes > 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes > 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  return (bytes / 1e3).toFixed(0) + ' KB';
}

function formatDuration(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

function VideoCard({ file, onPlay, source }) {
  const streamUrl = api.streamUrl(source, file.channel_id, file.msg_id);
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onPlay}
      className="bg-white/[0.04] border border-white/[0.07] rounded-2xl overflow-hidden text-left w-full">
      <div className="relative aspect-video bg-black/60 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 to-purple-900/20" />
        <Play size={28} className="text-white/70 relative z-10" />
        {file.size > 0 && (
          <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 text-white/80 px-2 py-0.5 rounded-full font-mono">
            {formatSize(file.size)}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-medium text-white line-clamp-2 leading-relaxed">{file.name.replace(/\.[^.]+$/, '')}</p>
        {file.caption && <p className="text-[10px] text-white/40 mt-1 line-clamp-1">{file.caption}</p>}
      </div>
    </motion.button>
  );
}

function AudioCard({ file, onPlay }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onPlay}
      className="w-full flex items-center gap-3 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-left">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-600 to-teal-600 flex items-center justify-center shrink-0">
        <Music size={16} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{file.name.replace(/\.[^.]+$/, '')}</p>
        <p className="text-xs text-white/40">{formatSize(file.size)}</p>
      </div>
      <Play size={16} className="text-white/40 shrink-0" />
    </motion.button>
  );
}

function ImageCard({ file, onView }) {
  const streamUrl = api.streamUrl('discover', file.channel_id, file.msg_id);
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onView}
      className="aspect-square bg-white/[0.04] rounded-xl overflow-hidden relative">
      <img src={streamUrl} alt={file.name}
        className="w-full h-full object-cover"
        onError={e => { e.target.style.display = 'none'; }}
      />
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-1.5">
        <p className="text-[9px] text-white/70 truncate">{file.name}</p>
      </div>
    </motion.button>
  );
}

function PdfCard({ file, onOpen }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onOpen}
      className="w-full flex items-center gap-3 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-left">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shrink-0">
        <FileText size={16} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{file.name.replace(/\.[^.]+$/, '')}</p>
        <p className="text-xs text-white/40">{formatSize(file.size)}</p>
      </div>
      <Download size={14} className="text-white/40 shrink-0" />
    </motion.button>
  );
}

export default function ChannelPage({ channel, source, onBack }) {
  const { actions } = useApp();
  const [tab, setTab] = useState('video');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setFiles([]);
    const load = source === 'discover'
      ? api.getChannelFiles(channel.str_id || String(channel.id), tab)
      : api.getChatFiles(channel.id, tab);
    load.then(r => setFiles(r.files || [])).catch(() => {}).finally(() => setLoading(false));
  }, [tab, channel.id]);

  const filtered = files.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.caption || '').toLowerCase().includes(search.toLowerCase())
  );

  function handlePlay(file) {
    actions.play(file, source);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-14 pb-3 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white truncate">{channel.name || channel.title}</h2>
            {(channel.username) && <p className="text-xs text-white/40">@{channel.username}</p>}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                  ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white/[0.06] text-white/50 hover:text-white/80'}`}>
                <Icon size={12} />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24 px-5">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-white/30">
            <Film size={28} />
            <p className="text-sm">No {tab}s found</p>
          </div>
        ) : tab === 'video' ? (
          <div className="grid grid-cols-2 gap-3 pt-3">
            {filtered.map(f => <VideoCard key={f.id} file={f} source={source} onPlay={() => handlePlay(f)} />)}
          </div>
        ) : tab === 'image' ? (
          <div className="grid grid-cols-3 gap-2 pt-3">
            {filtered.map(f => <ImageCard key={f.id} file={f} onView={() => handlePlay(f)} />)}
          </div>
        ) : tab === 'audio' ? (
          <div className="space-y-2 pt-3">
            {filtered.map(f => <AudioCard key={f.id} file={f} onPlay={() => handlePlay(f)} />)}
          </div>
        ) : (
          <div className="space-y-2 pt-3">
            {filtered.map(f => <PdfCard key={f.id} file={f} onOpen={() => {
              window.open(api.streamUrl(source, f.channel_id, f.msg_id), '_blank');
            }} />)}
          </div>
        )}
      </div>
    </div>
  );
}
