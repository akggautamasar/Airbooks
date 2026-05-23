import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { api } from '../../utils/api';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${String(sec).padStart(2,'0')}`;
}

export default function AudioPlayer() {
  const { state, actions } = useApp();
  const { file, source } = state.nowPlaying || {};
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  if (!state.nowPlaying || state.nowPlaying.type !== 'audio') return null;

  const src = api.streamUrl(source, file.channel_id, file.msg_id);

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28 }}
      className="fixed bottom-0 inset-x-0 z-[100] bg-[#0f0f1a] border-t border-white/10 rounded-t-3xl pb-8"
    >
      <div className="px-5 pt-5">
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        {/* Cover */}
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-green-600 to-teal-600 flex items-center justify-center mx-auto mb-4">
          <Volume2 size={36} className="text-white/80" />
        </div>

        {/* Title */}
        <p className="text-base font-semibold text-white text-center truncate mb-1">{file.name.replace(/\.[^.]+$/, '')}</p>
        <p className="text-xs text-white/40 text-center mb-5">{file.caption || 'Audio'}</p>

        {/* Progress */}
        <div className="mb-2 cursor-pointer" onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          if(audioRef.current && duration) audioRef.current.currentTime = ((e.clientX-r.left)/r.width)*duration;
        }}>
          <div className="h-1.5 bg-white/15 rounded-full relative">
            <div className="absolute inset-y-0 left-0 bg-green-500 rounded-full" style={{width:duration?`${(currentTime/duration)*100}%`:'0%'}} />
          </div>
        </div>
        <div className="flex justify-between text-xs text-white/40 mb-5">
          <span>{fmt(currentTime)}</span><span>{fmt(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-8">
          <button onClick={() => { if(audioRef.current) audioRef.current.currentTime -= 10; }} className="text-white/60">
            <SkipBack size={24} />
          </button>
          <button onClick={() => { const a=audioRef.current; if(!a) return; a.paused?a.play():a.pause(); }}
            className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center">
            {playing ? <Pause size={24} className="text-white" /> : <Play size={24} className="text-white ml-0.5" />}
          </button>
          <button onClick={() => { if(audioRef.current) audioRef.current.currentTime += 10; }} className="text-white/60">
            <SkipForward size={24} />
          </button>
        </div>

        <audio ref={audioRef} src={src} preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={e => setDuration(e.target.duration)}
          onTimeUpdate={e => setCurrentTime(e.target.currentTime)}
        />
      </div>
      <button onClick={actions.stop} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
        <X size={14} className="text-white/60" />
      </button>
    </motion.div>
  );
}
