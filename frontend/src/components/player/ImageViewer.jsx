import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { api } from '../../utils/api';

export default function ImageViewer() {
  const { state, actions } = useApp();
  const { file, source } = state.nowPlaying || {};
  const [zoom, setZoom] = useState(1);

  if (!state.nowPlaying || state.nowPlaying.type !== 'image') return null;

  const src = api.streamUrl(source, file.channel_id, file.msg_id);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 bg-gradient-to-b from-black/80 to-transparent absolute top-0 inset-x-0 z-10">
        <button onClick={actions.stop} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <X size={18} className="text-white" />
        </button>
        <p className="flex-1 text-sm font-medium text-white truncate">{file.name}</p>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.5))} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ZoomIn size={16} className="text-white" />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.5))} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ZoomOut size={16} className="text-white" />
        </button>
        <a href={src} download={file.name} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <Download size={16} className="text-white" />
        </a>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        <img
          src={src}
          alt={file.name}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s' }}
          className="max-w-full max-h-full object-contain"
          onError={e => { e.target.alt = 'Failed to load image'; }}
        />
      </div>
    </motion.div>
  );
}
