import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { api } from '../../utils/api';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

export default function VideoPlayer() {
  const { state, actions } = useApp();
  const { file, source } = state.nowPlaying || {};
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimer = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [error, setError] = useState('');

  const streamUrl = file ? api.streamUrl(source, file.channel_id, file.msg_id) : null;

  useEffect(() => {
    if (!file) return;
    setPlaying(false); setCurrentTime(0); setDuration(0);
    setLoading(true); setError('');
    videoRef.current?.load();
  }, [file?.id]);

  function showCtrl() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }

  useEffect(() => {
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    else { clearTimeout(hideTimer.current); setShowControls(true); }
    return () => clearTimeout(hideTimer.current);
  }, [playing]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  }, []);

  const seek = useCallback((secs) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + secs));
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowLeft') seek(-10);
      if (e.code === 'ArrowRight') seek(10);
      if (e.code === 'KeyF') toggleFullscreen();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [togglePlay, seek]);

  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

  if (!state.nowPlaying || state.nowPlaying.type !== 'video') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      ref={containerRef}
    >
      <div className="flex-1 relative flex items-center justify-center"
           onClick={togglePlay} onMouseMove={showCtrl} onTouchStart={showCtrl}>
        <video
          ref={videoRef}
          src={streamUrl}
          className="max-w-full max-h-full"
          playsInline preload="auto"
          onPlay={() => { setPlaying(true); setLoading(false); }}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={e => { setDuration(e.target.duration); setLoading(false); }}
          onTimeUpdate={e => {
            setCurrentTime(e.target.currentTime);
            if (e.target.buffered.length > 0)
              setBuffered(e.target.buffered.end(e.target.buffered.length - 1));
          }}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onError={() => { setError('Could not play this video'); setLoading(false); }}
        />
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <p className="text-white/60 text-sm mb-3">{error}</p>
              <button onClick={e => { e.stopPropagation(); setError(''); videoRef.current?.load(); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm flex items-center gap-2 mx-auto">
                <RotateCcw size={14} /> Retry
              </button>
            </div>
          </div>
        )}
        {/* Double-tap zones */}
        <div className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
             onDoubleClick={e => { e.stopPropagation(); seek(-10); }} />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
             onDoubleClick={e => { e.stopPropagation(); seek(10); }} />
      </div>

      <AnimatePresence>
        {showControls && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none">
            {/* Top */}
            <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent px-4 pt-12 pb-6 pointer-events-auto">
              <div className="flex items-center gap-3">
                <button onClick={actions.stop} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <ChevronDown size={20} className="text-white" />
                </button>
                <p className="flex-1 text-sm font-semibold text-white truncate">{file?.name?.replace(/\.[^.]+$/, '')}</p>
                <div className="relative">
                  <button onClick={e => { e.stopPropagation(); setShowSpeedMenu(v => !v); }}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold text-white">{speed}x</button>
                  {showSpeedMenu && (
                    <div className="absolute top-10 right-0 bg-[#1a1a2e] border border-white/10 rounded-2xl overflow-hidden z-50 pointer-events-auto shadow-xl">
                      {SPEEDS.map(s => (
                        <button key={s} onClick={e => { e.stopPropagation(); if(videoRef.current) videoRef.current.playbackRate=s; setSpeed(s); setShowSpeedMenu(false); }}
                          className={`block w-full px-5 py-2.5 text-sm text-left transition-colors ${speed===s?'text-blue-400 bg-blue-500/10':'text-white/70 hover:bg-white/5'}`}>
                          {s}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Center play */}
            {!playing && !loading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                <button onClick={e => { e.stopPropagation(); togglePlay(); }}
                  className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <Play size={28} className="text-white ml-1" />
                </button>
              </div>
            )}
            {/* Bottom */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-8 pointer-events-auto">
              <div className="mb-3 cursor-pointer" onClick={e => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                if(videoRef.current && duration) videoRef.current.currentTime = ((e.clientX-r.left)/r.width)*duration;
              }}>
                <div className="h-1 hover:h-1.5 bg-white/20 rounded-full transition-all relative">
                  <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{width: duration?`${(buffered/duration)*100}%`:'0%'}} />
                  <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-full" style={{width: duration?`${(currentTime/duration)*100}%`:'0%'}} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={e => { e.stopPropagation(); togglePlay(); }} className="text-white">
                  {playing ? <Pause size={22}/> : <Play size={22}/>}
                </button>
                <button onClick={e => { e.stopPropagation(); seek(-10); }} className="text-white/70"><SkipBack size={18}/></button>
                <button onClick={e => { e.stopPropagation(); seek(10); }} className="text-white/70"><SkipForward size={18}/></button>
                <span className="text-xs text-white/70 font-mono flex-1">{fmt(currentTime)} / {fmt(duration)}</span>
                <button onClick={e => { e.stopPropagation(); const v=videoRef.current; if(v){v.muted=!v.muted; setMuted(v.muted);} }} className="text-white/70">
                  {muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
                </button>
                <button onClick={e => { e.stopPropagation(); toggleFullscreen(); }} className="text-white/70">
                  {fullscreen ? <Minimize size={18}/> : <Maximize size={18}/>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
