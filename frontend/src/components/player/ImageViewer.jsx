import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Download, RotateCcw } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { api } from '../../utils/api';

export default function ImageViewer() {
  const { state, actions } = useApp();
  const { file, source } = state.nowPlaying || {};
  const [zoom, setZoom] = useState(1);
  const [errored, setErrored] = useState(false);

  if (!state.nowPlaying || state.nowPlaying.type !== 'image') return null;

  const src = api.streamUrl(source, file.channel_id, file.msg_id);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      {/* Toolbar */}
      <div style={{ position:'absolute', top:0, insetInline:0, zIndex:10,
                    background:'linear-gradient(rgba(0,0,0,0.7),transparent)',
                    padding:'calc(env(safe-area-inset-top,0px) + 12px) 16px 32px',
                    display:'flex', alignItems:'center', gap:'10px' }}>
        <button onClick={actions.stop}
          style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(255,255,255,0.15)',
                   border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <X size={18} color="white" />
        </button>
        <p style={{ flex:1, fontSize:'13px', fontWeight:'600', color:'white',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {file.name}
        </p>
        <button onClick={() => setZoom(z => Math.min(4, +(z+0.5).toFixed(1)))}
          style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(255,255,255,0.15)',
                   border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <ZoomIn size={16} color="white" />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.5, +(z-0.5).toFixed(1)))}
          style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(255,255,255,0.15)',
                   border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <ZoomOut size={16} color="white" />
        </button>
        <button onClick={() => setZoom(1)}
          style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(255,255,255,0.15)',
                   border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <RotateCcw size={15} color="white" />
        </button>
        <a href={src} download={file.name}
          style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(255,255,255,0.15)',
                   display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
          <Download size={16} color="white" />
        </a>
      </div>

      {/* Image */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                    overflow:'auto', padding:'60px 16px 16px' }}>
        {errored ? (
          <div style={{ textAlign:'center', color:'white' }}>
            <p style={{ color:'rgba(255,255,255,0.5)', marginBottom:'12px' }}>Failed to load image</p>
            <button onClick={() => setErrored(false)}
              style={{ background:'#3478f6', color:'white', border:'none', borderRadius:'10px',
                       padding:'8px 20px', cursor:'pointer', fontWeight:'600' }}>
              Retry
            </button>
          </div>
        ) : (
          <img
            src={src}
            alt={file.name}
            style={{
              maxWidth:'100%', maxHeight:'100%', objectFit:'contain',
              transform:`scale(${zoom})`, transformOrigin:'center',
              transition:'transform 0.2s', borderRadius:'4px',
            }}
            onError={() => setErrored(true)}
          />
        )}
      </div>

      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div style={{ position:'absolute', bottom:'32px', left:'50%', transform:'translateX(-50%)',
                      background:'rgba(0,0,0,0.6)', color:'white', padding:'6px 14px',
                      borderRadius:'20px', fontSize:'13px', fontWeight:'600' }}>
          {Math.round(zoom*100)}%
        </div>
      )}
    </motion.div>
  );
}
