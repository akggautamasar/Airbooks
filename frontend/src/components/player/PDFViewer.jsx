import React from 'react';
import { motion } from 'framer-motion';
import { X, Download, ExternalLink } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { api } from '../../utils/api';

export default function PDFViewer() {
  const { state, actions } = useApp();
  const { file, source } = state.nowPlaying || {};

  if (!state.nowPlaying || (state.nowPlaying.type !== 'pdf' && state.nowPlaying.type !== 'epub')) return null;

  const src = api.streamUrl(source, file.channel_id, file.msg_id);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#1a1a1a] flex flex-col"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#111] border-b border-white/10 shrink-0 pt-12">
        <button onClick={actions.stop} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <X size={16} className="text-white" />
        </button>
        <p className="flex-1 text-sm font-medium text-white truncate">{file.name.replace(/\.[^.]+$/, '')}</p>
        <a href={src} target="_blank" rel="noreferrer"
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ExternalLink size={15} className="text-white" />
        </a>
        <a href={src} download={file.name}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <Download size={15} className="text-white" />
        </a>
      </div>

      {/* PDF iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(src)}&embedded=true`}
          className="w-full h-full border-0"
          title={file.name}
        />
      </div>

      {/* Fallback download button */}
      <div className="px-5 py-4 bg-[#111] border-t border-white/10 shrink-0">
        <div className="flex gap-3">
          <a href={src} target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold">
            <ExternalLink size={15} /> Open in browser
          </a>
          <a href={src} download={file.name}
            className="flex-1 flex items-center justify-center gap-2 bg-white/10 text-white py-3 rounded-xl text-sm font-semibold">
            <Download size={15} /> Download
          </a>
        </div>
      </div>
    </motion.div>
  );
}
