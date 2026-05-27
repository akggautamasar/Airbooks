import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ArrowLeft, Film, Music, Image, FileText, BookOpen, Search,
         Play, ExternalLink } from 'lucide-react';
import ScanProgress from '../ui/ScanProgress';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';

const TABS = [
  { key: 'video', label: 'Videos', icon: Film,     color: '#5856d6' },
  { key: 'audio', label: 'Music',  icon: Music,    color: '#34c759' },
  { key: 'image', label: 'Images', icon: Image,    color: '#ff9500' },
  { key: 'pdf',   label: 'PDFs',   icon: FileText, color: '#ff3b30' },
  { key: 'epub',  label: 'EPUBs',  icon: BookOpen, color: '#ff9500' },
];

function fmtSize(b) {
  if (!b) return '';
  if (b > 1e9) return (b/1e9).toFixed(1)+' GB';
  if (b > 1e6) return (b/1e6).toFixed(1)+' MB';
  return (b/1e3).toFixed(0)+' KB';
}

function fmtDur(s) {
  if (!s) return '';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

// Lazy-loading image with skeleton
function LazyThumb({ src, alt, style, fallback }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if(e.isIntersecting){ setVisible(true); obs.disconnect(); } }, { rootMargin: '200px' });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ ...style, overflow:'hidden', position:'relative', background:'#e5e5ea' }}>
      {!loaded && !errored && (
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,#e5e5ea 25%,#f0f0f5 50%,#e5e5ea 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s infinite' }} />
      )}
      {visible && !errored && (
        <img src={src} alt={alt}
          style={{ width:'100%', height:'100%', objectFit:'cover', opacity: loaded?1:0, transition:'opacity 0.2s' }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)} />
      )}
      {errored && fallback}
    </div>
  );
}

function VideoCard({ file, source, onClick }) {
  const thumbUrl = file.has_thumb ? api.thumbUrl(source, file.channel_id, file.msg_id) : null;
  const dur = fmtDur(file.duration);
  const size = fmtSize(file.size);
  return (
    <div onClick={onClick} style={{ background:'white', borderRadius:'14px', overflow:'hidden',
                                    boxShadow:'0 1px 4px rgba(0,0,0,0.08)', cursor:'pointer' }}>
      <div style={{ aspectRatio:'16/9', position:'relative', background:'#1c1c2e' }}>
        {thumbUrl ? (
          <LazyThumb src={thumbUrl} alt={file.name}
            style={{ width:'100%', height:'100%' }}
            fallback={<div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><Play size={24} color="rgba(255,255,255,0.4)" /></div>} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#1c1c3a,#2c2c54)' }}>
            <Film size={24} color="rgba(255,255,255,0.3)" />
          </div>
        )}
        {/* Overlay badges */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 40%,rgba(0,0,0,0.7))', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'6px', left:'6px', display:'flex', gap:'4px', flexWrap:'wrap' }}>
          {size && <span style={{ background:'rgba(0,0,0,0.75)', color:'white', fontSize:'10px', padding:'2px 6px', borderRadius:'5px', fontWeight:'600' }}>{size}</span>}
        </div>
        {dur && <span style={{ position:'absolute', bottom:'6px', right:'6px', background:'rgba(0,0,0,0.75)', color:'white', fontSize:'10px', padding:'2px 6px', borderRadius:'5px', fontWeight:'700' }}>{dur}</span>}
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.15)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Play size={16} color="white" fill="white" />
          </div>
        </div>
      </div>
      <div style={{ padding:'8px 10px' }}>
        <p style={{ fontSize:'12px', fontWeight:'600', color:'#1c1c1e', margin:0, overflow:'hidden',
                    display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:'1.4' }}>
          {file.name.replace(/\.[^.]+$/,'')}
        </p>
        {file.caption && (
          <p style={{ fontSize:'11px', color:'#8e8e93', margin:'3px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {file.caption}
          </p>
        )}
      </div>
    </div>
  );
}

function AudioCard({ file, source, onClick }) {
  const thumbUrl = file.has_thumb ? api.thumbUrl(source, file.channel_id, file.msg_id) : null;
  const dur = fmtDur(file.duration);
  const size = fmtSize(file.size);
  return (
    <button onClick={onClick}
      style={{ display:'flex', alignItems:'center', gap:'12px', background:'white',
               borderRadius:'14px', padding:'10px 12px', border:'none', cursor:'pointer',
               boxShadow:'0 1px 3px rgba(0,0,0,0.08)', textAlign:'left', width:'100%' }}>
      {/* Album art */}
      <div style={{ width:'52px', height:'52px', borderRadius:'10px', flexShrink:0, overflow:'hidden', background:'#34c75918', position:'relative' }}>
        {thumbUrl ? (
          <LazyThumb src={thumbUrl} alt={file.name} style={{ width:'100%', height:'100%' }}
            fallback={<div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><Music size={22} color="#34c759" /></div>} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Music size={22} color="#34c759" />
          </div>
        )}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:'14px', fontWeight:'600', color:'#1c1c1e', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {file.name.replace(/\.[^.]+$/,'')}
        </p>
        <div style={{ display:'flex', gap:'6px', marginTop:'4px', flexWrap:'wrap' }}>
          {size && <span style={{ fontSize:'11px', color:'#8e8e93', background:'#f2f2f7', padding:'2px 6px', borderRadius:'5px', fontWeight:'600' }}>{size}</span>}
          {dur && <span style={{ fontSize:'11px', color:'#34c759', background:'#34c75915', padding:'2px 6px', borderRadius:'5px', fontWeight:'700' }}>{dur}</span>}
        </div>
        {file.caption && <p style={{ fontSize:'11px', color:'#8e8e93', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.caption}</p>}
      </div>
      <Play size={15} color="#c7c7cc" />
    </button>
  );
}

function ImageCard({ file, source, onClick }) {
  const src = api.streamUrl(source, file.channel_id, file.msg_id);
  const size = fmtSize(file.size);
  return (
    <div onClick={onClick} style={{ background:'white', borderRadius:'12px', overflow:'hidden',
                                    boxShadow:'0 1px 4px rgba(0,0,0,0.08)', cursor:'pointer' }}>
      <LazyThumb src={src} alt={file.name}
        style={{ width:'100%', aspectRatio:'1' }}
        fallback={<div style={{ width:'100%', aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center' }}><Image size={20} color="#ccc" /></div>} />
      {(size || file.caption) && (
        <div style={{ padding:'5px 7px' }}>
          {size && <span style={{ fontSize:'10px', color:'#8e8e93', fontWeight:'600' }}>{size}</span>}
          {file.caption && <p style={{ fontSize:'10px', color:'#1c1c1e', margin:'1px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.caption}</p>}
        </div>
      )}
    </div>
  );
}

function DocCard({ file, source, tab, onClick }) {
  const t = TABS.find(t=>t.key===tab);
  const Icon = t?.icon || FileText;
  const color = t?.color || '#8e8e93';
  const size = fmtSize(file.size);

  // PDFs shown as grid cards with thumbnail
  if (tab === 'pdf' || tab === 'epub') {
    const thumbUrl = api.thumbUrl(source, file.channel_id, file.msg_id);
    return (
      <button onClick={onClick} style={{
        background:'white', borderRadius:'14px', overflow:'hidden',
        boxShadow:'0 1px 4px rgba(0,0,0,0.08)', cursor:'pointer',
        border:'none', padding:0, textAlign:'left', width:'100%',
      }}>
        {/* Cover area */}
        <div style={{ aspectRatio:'3/4', position:'relative', background: color+'18',
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
          <LazyThumb src={thumbUrl} alt={file.name}
            style={{ width:'100%', height:'100%' }}
            fallback={
              <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column',
                            alignItems:'center', justifyContent:'center', gap:'8px', padding:'12px',
                            background:`linear-gradient(135deg,${color}18,${color}30)` }}>
                <Icon size={28} color={color}/>
                <p style={{ fontSize:'10px', fontWeight:'700', color, textAlign:'center',
                            margin:0, lineHeight:'1.3', overflow:'hidden',
                            display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical' }}>
                  {file.name.replace(/\.[^.]+$/,'')}
                </p>
              </div>
            }/>
          {/* Size badge */}
          {size && <span style={{ position:'absolute', bottom:'5px', left:'5px',
            background:'rgba(0,0,0,0.7)', color:'white',
            fontSize:'9px', fontWeight:'700', padding:'2px 6px', borderRadius:'4px' }}>
            {size}
          </span>}
          {/* Type badge */}
          <span style={{ position:'absolute', top:'5px', left:'5px',
            background: color, color:'white',
            fontSize:'9px', fontWeight:'700', padding:'2px 6px', borderRadius:'4px' }}>
            {tab.toUpperCase()}
          </span>
        </div>
        <div style={{ padding:'8px' }}>
          <p style={{ fontSize:'11px', fontWeight:'600', color:'#1c1c1e', margin:0,
                      overflow:'hidden', display:'-webkit-box',
                      WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:'1.3' }}>
            {file.name.replace(/\.[^.]+$/,'')}
          </p>
        </div>
      </button>
    );
  }

  // EPUBs and others — list style
  return (
    <button onClick={onClick}
      style={{ display:'flex', alignItems:'center', gap:'12px', background:'white',
               borderRadius:'14px', padding:'12px 14px', border:'none', cursor:'pointer',
               boxShadow:'0 1px 3px rgba(0,0,0,0.08)', textAlign:'left', width:'100%' }}>
      <div style={{ width:'44px', height:'44px', borderRadius:'10px', flexShrink:0,
                    background:color+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={22} color={color} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:'14px', fontWeight:'600', color:'#1c1c1e', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {file.name.replace(/\.[^.]+$/,'')}
        </p>
        <div style={{ display:'flex', gap:'6px', marginTop:'3px', alignItems:'center', flexWrap:'wrap' }}>
          {size && <span style={{ fontSize:'11px', color:'#8e8e93', background:'#f2f2f7', padding:'2px 6px', borderRadius:'5px', fontWeight:'600' }}>{size}</span>}
        </div>
      </div>
      <ExternalLink size={14} color="#c7c7cc" />
    </button>
  );
}

function ViewerSheet({ file, source, onClose }) {
  if (!file) return null;
  const streamUrl = api.streamUrl(source, file.channel_id, file.msg_id);
  const backendBase = (import.meta.env.VITE_API_URL||'').replace(/\/api$/,'');
  let options = [];
  if (file.type === 'video') {
    options = [
      { emoji:'⚡', label:'Fast Player', sub:'Speed, seek, resume — recommended', highlight:true,
        action:()=>{ window.open(`${backendBase}/player?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(file.name)}&id=${encodeURIComponent(file.id)}`, '_blank'); onClose(); } },
      { emoji:'🎬', label:'AirPlayer', sub:'BeyondDrive player',
        action:()=>{ window.open(`${backendBase}/air-player?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(file.name)}&title=${encodeURIComponent(file.name)}`, '_blank'); onClose(); } },
      { emoji:'🌐', label:'Open in Browser', sub:'Stream in Chrome',
        action:()=>{ window.open(streamUrl,'_blank'); onClose(); } },
      { emoji:'⬇', label:'Download', sub:'Save to device',
        action:()=>{ const a=document.createElement('a'); a.href=streamUrl; a.download=file.name; a.click(); onClose(); } },
    ];
  } else if (file.type === 'pdf') {
    options = [
      { emoji:'📄', label:'PDF Viewer', sub:'Built-in PDF.js reader', highlight:true,
        action:()=>{ window.open(`${backendBase}/pdf-viewer?url=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(file.name)}&mode=pdf`, '_blank'); onClose(); } },
      { emoji:'🌐', label:'Open in Browser', sub:'Native PDF viewer',
        action:()=>{ window.open(streamUrl,'_blank'); onClose(); } },
      { emoji:'⬇', label:'Download', action:()=>{ const a=document.createElement('a'); a.href=streamUrl; a.download=file.name; a.click(); onClose(); } },
    ];
  } else if (file.type === 'epub') {
    options = [
      { emoji:'📖', label:'EPUB Reader', sub:'Built-in reader', highlight:true,
        action:()=>{ window.open(`${backendBase}/pdf-viewer?url=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(file.name)}&mode=epub`, '_blank'); onClose(); } },
      { emoji:'⬇', label:'Download EPUB', action:()=>{ const a=document.createElement('a'); a.href=streamUrl; a.download=file.name; a.click(); onClose(); } },
    ];
  }
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:'white', borderRadius:'20px 20px 0 0', width:'100%',
                 padding:'16px 16px calc(env(safe-area-inset-bottom,0px)+16px)', boxShadow:'0 -4px 24px rgba(0,0,0,0.15)' }}>
        <div style={{ width:'36px', height:'4px', background:'#e5e5ea', borderRadius:'2px', margin:'0 auto 14px' }} />
        <p style={{ fontWeight:'700', fontSize:'15px', color:'#1c1c1e', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {file.name.replace(/\.[^.]+$/,'')}
        </p>
        <p style={{ fontSize:'12px', color:'#8e8e93', margin:'0 0 14px' }}>{fmtSize(file.size)}{file.duration?` · ${fmtDur(file.duration)}`:''} · Choose how to open</p>
        {options.map((o,i) => (
          <button key={i} onClick={o.action}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px',
                     background: o.highlight ? '#e8f0ff' : '#f2f2f7',
                     border: o.highlight ? '1.5px solid #3478f640' : '1.5px solid transparent',
                     borderRadius:'14px', padding:'12px 14px', cursor:'pointer', textAlign:'left', marginBottom:'8px' }}>
            <span style={{ fontSize:'20px' }}>{o.emoji}</span>
            <div>
              <p style={{ fontWeight:'700', fontSize:'14px', color: o.highlight ? '#3478f6' : '#1c1c1e', margin:0 }}>{o.label}</p>
              {o.sub && <p style={{ fontSize:'12px', color:'#8e8e93', margin:'1px 0 0' }}>{o.sub}</p>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChannelPage({ channel, source, onBack }) {
  const { actions } = useApp();
  const [tab, setTab] = useState('video');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date');
  const [order, setOrder] = useState('desc');
  const [viewerFile, setViewerFile] = useState(null);
  const [scannedAt, setScannedAt] = useState(null);
  const [forceRef, setForceRef] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileCache = useRef({});

  useEffect(() => {
    setSearch('');
    const cacheKey = `${channel.id}_${tab}`;
    if (fileCache.current[cacheKey]) {
      setFiles(fileCache.current[cacheKey]);
      setLoading(false);
      return;
    }
    setLoading(true); setFiles([]);
    if (source === 'user' && !fileCache.current[cacheKey]) {
      // Use SSE scan progress for user chats
      setScanning(true);
    } else {
      // Discover or cached — fetch directly
      const load = source === 'discover'
        ? api.getChannelFiles(channel.str_id||String(channel.id), tab)
        : api.getChatFiles(channel.id, tab, forceRef);
      load.then(r => {
        const f = r.files||[];
        fileCache.current[cacheKey] = f;
        setFiles(f);
        if (r.scanned_at) setScannedAt(r.scanned_at);
      }).catch(()=>{}).finally(()=>setLoading(false));
    }
    setForceRef(false);
  }, [tab, channel.id, forceRef]);

  // Called when SSE scan completes
  async function onScanDone(data) {
    setScanning(false);
    // Now fetch the actual typed files
    try {
      const r = await api.getChatFiles(channel.id, tab, false);
      const f = r.files||[];
      fileCache.current[`${channel.id}_${tab}`] = f;
      setFiles(f);
      if (r.scanned_at || data?.scanned_at) setScannedAt(r.scanned_at || data?.scanned_at);
    } catch {}
    setLoading(false);
  }

  const sorted = useMemo(() => {
    let f = files.filter(f =>
      !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.caption||'').toLowerCase().includes(search.toLowerCase())
    );
    return [...f].sort((a,b) => {
      let cmp = sort==='date' ? (a.date||0)-(b.date||0) :
                sort==='name' ? a.name.localeCompare(b.name) :
                sort==='size' ? (a.size||0)-(b.size||0) :
                (a.duration||0)-(b.duration||0);
      return order==='desc' ? -cmp : cmp;
    });
  }, [files, search, sort, order]);

  const tabInfo = TABS.find(t=>t.key===tab);
  const hasDuration = tab === 'video' || tab === 'audio';

  function handleFile(file) {
    if (file.type === 'audio') { actions.play(file, source); return; }
    if (file.type === 'image') { actions.play(file, source); return; }
    setViewerFile(file);
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f2f2f7', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:'#f2f2f7', padding:'52px 16px 0', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
          <button onClick={onBack}
            style={{ width:'36px', height:'36px', borderRadius:'10px', background:'white', border:'none',
                     cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                     boxShadow:'0 1px 3px rgba(0,0,0,0.1)', flexShrink:0 }}>
            <ArrowLeft size={18} color="#3478f6" />
          </button>
          <h2 style={{ fontWeight:'700', fontSize:'18px', color:'#1c1c1e', margin:0,
                       overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
            {channel.name||channel.title}
          </h2>
          <button onClick={() => { setForceRef(true); fileCache.current = {}; }}
            style={{ width:'32px', height:'32px', borderRadius:'10px', background:'white', border:'none',
                     cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                     boxShadow:'0 1px 3px rgba(0,0,0,0.1)', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3478f6" strokeWidth="2.5" strokeLinecap="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </button>
        </div>
        {scannedAt && (
          <p style={{ fontSize:'10px', color:'#8e8e93', margin:'-8px 0 8px 48px' }}>
            Cached · {new Date(scannedAt).toLocaleDateString()}
          </p>
        )}
        {/* Search */}
        <div style={{ position:'relative', marginBottom:'12px' }}>
          <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#8e8e93' }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files..."
            style={{ width:'100%', background:'white', border:'none', borderRadius:'12px',
                     padding:'10px 12px 10px 34px', fontSize:'14px', color:'#1c1c1e',
                     outline:'none', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }} />
        </div>
        {/* Tabs */}
        <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'12px', scrollbarWidth:'none' }}>
          {TABS.map(t => {
            const Icon = t.icon; const active = tab===t.key;
            return (
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 14px',
                         borderRadius:'20px', border:'none', cursor:'pointer', flexShrink:0,
                         background: active ? t.color : 'white', color: active ? 'white' : '#8e8e93',
                         fontWeight:'600', fontSize:'13px',
                         boxShadow: active ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                <Icon size={13} />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scan progress — shown during first scan */}
      {scanning && source === 'user' && (
        <div style={{ padding:'0 16px' }}>
          <ScanProgress
            chatId={channel.id}
            source={source}
            forceRefresh={forceRef}
            onDone={onScanDone}
            color={tabInfo?.color || '#3478f6'}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 100px' }}>
        {loading ? (
          <div>
            {/* Sort bar skeleton */}
            <div style={{ height:'32px', background:'#e5e5ea', borderRadius:'8px', margin:'10px 0 6px', animation:'shimmer 1.5s infinite' }} />
            {/* Card skeletons */}
            <div style={{ display:'grid', gridTemplateColumns: tab==='image'?'1fr 1fr 1fr':'1fr 1fr', gap:'12px' }}>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{ background:'white', borderRadius:'14px', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ aspectRatio: tab==='image'?'1':'16/9', background:'#e5e5ea', animation:'shimmer 1.5s infinite' }} />
                  {tab!=='image' && <div style={{ padding:'10px' }}>
                    <div style={{ height:'12px', background:'#e5e5ea', borderRadius:'4px', marginBottom:'6px', animation:'shimmer 1.5s infinite' }} />
                    <div style={{ height:'10px', background:'#e5e5ea', borderRadius:'4px', width:'60%', animation:'shimmer 1.5s infinite' }} />
                  </div>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Sort bar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0 6px' }}>
              <span style={{ fontSize:'13px', fontWeight:'600', color:'#8e8e93' }}>
                {sorted.length} {tabInfo?.label}
              </span>
              <div style={{ display:'flex', gap:'5px' }}>
                {[{k:'date',l:'Date'},{k:'name',l:'Name'},{k:'size',l:'Size'}, ...(hasDuration?[{k:'duration',l:'Duration'}]:[])].map(s => (
                  <button key={s.k}
                    onClick={()=>{ if(sort===s.k) setOrder(o=>o==='asc'?'desc':'asc'); else{setSort(s.k);setOrder('desc');} }}
                    style={{ padding:'4px 10px', borderRadius:'10px', border:'none', cursor:'pointer',
                             fontSize:'12px', fontWeight:'600',
                             background: sort===s.k ? (tabInfo?.color||'#3478f6') : 'white',
                             color: sort===s.k ? 'white' : '#8e8e93',
                             boxShadow: sort===s.k ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                    {s.l}{sort===s.k?(order==='desc'?' ↓':' ↑'):''}
                  </button>
                ))}
              </div>
            </div>

            {sorted.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px' }}>
                <p style={{ color:'#8e8e93', fontSize:'15px', fontWeight:'500' }}>No {tabInfo?.label?.toLowerCase()} found</p>
              </div>
            ) : tab === 'video' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                {sorted.map(f => <VideoCard key={f.id} file={f} source={source} onClick={()=>handleFile(f)} />)}
              </div>
            ) : tab === 'audio' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {sorted.map(f => <AudioCard key={f.id} file={f} source={source} onClick={()=>handleFile(f)} />)}
              </div>
            ) : tab === 'image' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
                {sorted.map(f => <ImageCard key={f.id} file={f} source={source} onClick={()=>handleFile(f)} />)}
              </div>
            ) : tab === 'pdf' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                {sorted.map(f => <DocCard key={f.id} file={f} source={source} tab={tab} onClick={()=>handleFile(f)} />)}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {sorted.map(f => <DocCard key={f.id} file={f} source={source} tab={tab} onClick={()=>handleFile(f)} />)}
              </div>
            )}
          </>
        )}
      </div>

      {viewerFile && <ViewerSheet file={viewerFile} source={source} onClose={()=>setViewerFile(null)} />}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      `}</style>
    </div>
  );
}
