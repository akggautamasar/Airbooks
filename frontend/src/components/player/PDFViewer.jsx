import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download, ExternalLink, Globe, BookOpen } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { api } from '../../utils/api';

export default function PDFViewer() {
  const { state, actions } = useApp();
  const { file, source } = state.nowPlaying || {};
  const [viewMode, setViewMode] = useState('google'); // 'google' | 'direct'
  const isEpub = state.nowPlaying?.type === 'epub';

  if (!state.nowPlaying || (state.nowPlaying.type !== 'pdf' && state.nowPlaying.type !== 'epub')) return null;

  const src = api.streamUrl(source, file.channel_id, file.msg_id);
  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(src)}&embedded=true`;

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-[100] bg-gray-100 flex flex-col"
    >
      {/* Toolbar */}
      <div style={{ background:'white', borderBottom:'1px solid #e5e5ea', padding:'12px 16px',
                    paddingTop:'calc(env(safe-area-inset-top,0px) + 12px)',
                    display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
        <button onClick={actions.stop}
          style={{ width:'36px', height:'36px', borderRadius:'10px', background:'#f2f2f7',
                   border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <X size={18} color="#1c1c1e" />
        </button>
        <p style={{ flex:1, fontWeight:'600', fontSize:'14px', color:'#1c1c1e',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {file.name.replace(/\.[^.]+$/,'')}
        </p>
        {!isEpub && (
          <div style={{ display:'flex', gap:'4px', background:'#f2f2f7', borderRadius:'10px', padding:'3px' }}>
            {[
              { key:'google', icon: Globe,    label:'Preview' },
              { key:'direct', icon: BookOpen, label:'Reader' },
            ].map(m => (
              <button key={m.key} onClick={() => setViewMode(m.key)}
                style={{ display:'flex', alignItems:'center', gap:'4px', padding:'5px 10px',
                         borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
                         background: viewMode===m.key ? 'white' : 'transparent',
                         color: viewMode===m.key ? '#1c1c1e' : '#8e8e93',
                         boxShadow: viewMode===m.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                <m.icon size={12} />{m.label}
              </button>
            ))}
          </div>
        )}
        <a href={src} target="_blank" rel="noreferrer"
          style={{ width:'36px', height:'36px', borderRadius:'10px', background:'#f2f2f7',
                   display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
          <ExternalLink size={16} color="#3478f6" />
        </a>
        <a href={src} download={file.name}
          style={{ width:'36px', height:'36px', borderRadius:'10px', background:'#f2f2f7',
                   display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
          <Download size={16} color="#3478f6" />
        </a>
      </div>

      {/* Viewer */}
      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        {isEpub ? (
          // EPUB — show download + open options since browser can't render EPUB natively
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                        height:'100%', padding:'32px', background:'white' }}>
            <div style={{ width:'72px', height:'72px', borderRadius:'18px', background:'#ff950015',
                          display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'16px' }}>
              <BookOpen size={32} color="#ff9500" />
            </div>
            <p style={{ fontWeight:'700', fontSize:'18px', color:'#1c1c1e', margin:'0 0 8px', textAlign:'center' }}>
              {file.name.replace(/\.[^.]+$/,'')}
            </p>
            <p style={{ fontSize:'14px', color:'#8e8e93', textAlign:'center', margin:'0 0 28px', lineHeight:'1.5' }}>
              EPUB files are best read in a dedicated reader app.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', width:'100%', maxWidth:'300px' }}>
              <a href={src} target="_blank" rel="noreferrer"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                         background:'#ff9500', color:'white', borderRadius:'14px', padding:'14px',
                         fontWeight:'700', fontSize:'15px', textDecoration:'none' }}>
                <ExternalLink size={16} /> Open in Browser
              </a>
              <a href={src} download={file.name}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                         background:'#f2f2f7', color:'#1c1c1e', borderRadius:'14px', padding:'14px',
                         fontWeight:'700', fontSize:'15px', textDecoration:'none' }}>
                <Download size={16} /> Download EPUB
              </a>
            </div>
          </div>
        ) : viewMode === 'google' ? (
          <iframe
            key="google"
            src={googleViewerUrl}
            style={{ width:'100%', height:'100%', border:'none' }}
            title={file.name}
          />
        ) : (
          // Direct PDF viewer using browser's built-in
          <iframe
            key="direct"
            src={src + '#toolbar=1&navpanes=1&scrollbar=1'}
            style={{ width:'100%', height:'100%', border:'none' }}
            title={file.name}
          />
        )}
      </div>

      {/* Bottom bar with open options */}
      <div style={{ background:'white', borderTop:'1px solid #e5e5ea',
                    padding:'12px 16px', paddingBottom:'calc(env(safe-area-inset-bottom,0px) + 12px)',
                    display:'flex', gap:'10px', flexShrink:0 }}>
        <a href={src} target="_blank" rel="noreferrer"
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                   background:'#3478f6', color:'white', borderRadius:'12px', padding:'12px',
                   fontWeight:'600', fontSize:'14px', textDecoration:'none' }}>
          <ExternalLink size={15} /> Open in Browser
        </a>
        <a href={src} download={file.name}
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                   background:'#f2f2f7', color:'#1c1c1e', borderRadius:'12px', padding:'12px',
                   fontWeight:'600', fontSize:'14px', textDecoration:'none' }}>
          <Download size={15} /> Download
        </a>
      </div>
    </motion.div>
  );
}
