import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, Film, Music, Image, FileText, BookOpen, Search, Play, Download, ExternalLink, SortAsc, SortDesc, Clock, AlignJustify } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';

const TABS = [
  { key: 'video', label: 'Videos', icon: Film,     color: '#5856d6' },
  { key: 'audio', label: 'Music',  icon: Music,    color: '#34c759' },
  { key: 'image', label: 'Images', icon: Image,    color: '#ff9500' },
  { key: 'pdf',   label: 'PDFs',   icon: FileText, color: '#ff3b30' },
  { key: 'epub',  label: 'EPUBs',  icon: BookOpen, color: '#ff9500' },
];

function formatSize(b) {
  if (!b) return '';
  if (b > 1e9) return (b/1e9).toFixed(1)+' GB';
  if (b > 1e6) return (b/1e6).toFixed(1)+' MB';
  return (b/1e3).toFixed(0)+' KB';
}

function SortBar({ count, sort, setSort, order, setOrder, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'8px 0', marginBottom:'4px' }}>
      <span style={{ fontSize:'13px', fontWeight:'600', color:'#8e8e93' }}>
        {count} {label}
      </span>
      <div style={{ display:'flex', gap:'6px' }}>
        {[
          { key:'date',  icon: Clock,       label:'Date' },
          { key:'name',  icon: AlignJustify,label:'Name' },
          { key:'size',  icon: SortAsc,     label:'Size' },
        ].map(s => (
          <button key={s.key} onClick={() => { if(sort===s.key) setOrder(o=>o==='asc'?'desc':'asc'); else { setSort(s.key); setOrder('desc'); }}}
            style={{ display:'flex', alignItems:'center', gap:'4px', padding:'5px 10px',
                     borderRadius:'10px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
                     background: sort===s.key ? '#3478f6' : 'white',
                     color: sort===s.key ? 'white' : '#8e8e93',
                     boxShadow: sort===s.key ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
            <s.icon size={11} />
            {s.label}
            {sort===s.key && <span>{order==='desc'?'↓':'↑'}</span>}
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
  const [openMenu, setOpenMenu] = useState(null); // file id with open menu

  useEffect(() => {
    setLoading(true); setFiles([]); setSearch('');
    const load = source === 'discover'
      ? api.getChannelFiles(channel.str_id || String(channel.id), tab)
      : api.getChatFiles(channel.id, tab);
    load.then(r => setFiles(r.files || [])).catch(()=>{}).finally(() => setLoading(false));
  }, [tab, channel.id]);

  const sorted = useMemo(() => {
    let f = files.filter(f =>
      !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.caption||'').toLowerCase().includes(search.toLowerCase())
    );
    f = [...f].sort((a, b) => {
      let cmp = 0;
      if (sort === 'date') cmp = (a.date||0) - (b.date||0);
      if (sort === 'name') cmp = a.name.localeCompare(b.name);
      if (sort === 'size') cmp = (a.size||0) - (b.size||0);
      return order === 'desc' ? -cmp : cmp;
    });
    return f;
  }, [files, search, sort, order]);

  const tabInfo = TABS.find(t => t.key === tab);
  const tabLabel = tabInfo?.label || tab;

  function play(file) { actions.play(file, source); }

  function openFastPlayer(file) {
    const streamUrl = api.streamUrl(source, file.channel_id, file.msg_id);
    const backendBase = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
    window.open(`${backendBase}/player?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(file.name)}&id=${encodeURIComponent(file.id)}`, '_blank');
  }

  function openInBrowser(file) {
    window.open(api.streamUrl(source, file.channel_id, file.msg_id), '_blank');
  }

  function downloadFile(file) {
    const a = document.createElement('a');
    a.href = api.streamUrl(source, file.channel_id, file.msg_id);
    a.download = file.name;
    a.click();
  }

  // Viewer choice modal
  const [viewerFile, setViewerFile] = useState(null);
  const [viewerType, setViewerType] = useState(null); // 'pdf' | 'epub' | 'video'

  function ViewerModal() {
    if (!viewerFile) return null;
    const streamUrl = api.streamUrl(source, viewerFile.channel_id, viewerFile.msg_id);
    const backendBase = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');

    const opts = viewerType === 'video' ? [
      { label: '⚡ Fast Player', sub: 'Speed control, resume, seek — recommended', action: () => { openFastPlayer(viewerFile); setViewerFile(null); }, highlight: true },
      { label: '▶ Built-in Player', sub: 'Simple in-app player', action: () => { play(viewerFile); setViewerFile(null); } },
      { label: '🌐 Open in Browser', sub: 'Stream in Chrome/Safari', action: () => { openInBrowser(viewerFile); setViewerFile(null); } },
      { label: '⬇ Download', sub: 'Save to device', action: () => { downloadFile(viewerFile); setViewerFile(null); } },
    ] : viewerType === 'pdf' ? [
      { label: '📄 In-app Viewer', sub: 'View inside AirBooks', action: () => { play(viewerFile); setViewerFile(null); }, highlight: true },
      { label: '🌐 Open in Browser', sub: 'Native PDF viewer (best quality)', action: () => { openInBrowser(viewerFile); setViewerFile(null); } },
      { label: '⬇ Download', sub: 'Save to device', action: () => { downloadFile(viewerFile); setViewerFile(null); } },
    ] : [ // epub
      { label: '📖 In-app Reader', sub: 'Built-in EPUB reader', action: () => { play(viewerFile); setViewerFile(null); }, highlight: true },
      { label: '🌐 Open in Browser', sub: 'Download & open with system reader', action: () => { openInBrowser(viewerFile); setViewerFile(null); } },
      { label: '⬇ Download', sub: 'Save .epub to device', action: () => { downloadFile(viewerFile); setViewerFile(null); } },
    ];

    return (
      <div onClick={() => setViewerFile(null)}
        style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.4)',
                 display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0' }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background:'white', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'480px',
                   padding:'16px 16px 32px', boxShadow:'0 -4px 24px rgba(0,0,0,0.15)' }}>
          <div style={{ width:'36px', height:'4px', background:'#e5e5ea', borderRadius:'2px', margin:'0 auto 16px' }} />
          <p style={{ fontWeight:'700', fontSize:'15px', color:'#1c1c1e', margin:'0 0 4px',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {viewerFile.name.replace(/\.[^.]+$/,'')}
          </p>
          <p style={{ fontSize:'12px', color:'#8e8e93', margin:'0 0 16px' }}>Choose how to open</p>
          {opts.map((o, i) => (
            <button key={i} onClick={o.action}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px',
                       background: o.highlight ? '#e8f0ff' : '#f2f2f7',
                       border: o.highlight ? '1.5px solid #3478f620' : '1.5px solid transparent',
                       borderRadius:'14px', padding:'13px 14px', cursor:'pointer',
                       textAlign:'left', marginBottom:'8px' }}>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:'600', fontSize:'14px', color: o.highlight ? '#3478f6' : '#1c1c1e', margin:0 }}>{o.label}</p>
                <p style={{ fontSize:'12px', color:'#8e8e93', margin:'2px 0 0' }}>{o.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f2f2f7', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:'#f2f2f7', padding:'52px 16px 0', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
          <button onClick={onBack} style={{ width:'36px', height:'36px', borderRadius:'10px',
            background:'white', border:'none', cursor:'pointer', display:'flex',
            alignItems:'center', justifyContent:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', flexShrink:0 }}>
            <ArrowLeft size={18} color="#3478f6" />
          </button>
          <h2 style={{ fontWeight:'700', fontSize:'18px', color:'#1c1c1e', margin:0,
                       overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
            {channel.name || channel.title}
          </h2>
        </div>

        {/* Search */}
        <div style={{ position:'relative', marginBottom:'12px' }}>
          <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#8e8e93' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..."
            style={{ width:'100%', background:'white', border:'none', borderRadius:'12px',
                     padding:'10px 12px 10px 34px', fontSize:'14px', color:'#1c1c1e',
                     outline:'none', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }} />
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'12px', scrollbarWidth:'none' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 14px',
                         borderRadius:'20px', border:'none', cursor:'pointer', flexShrink:0,
                         background: active ? t.color : 'white',
                         color: active ? 'white' : '#8e8e93', fontWeight:'600', fontSize:'13px',
                         boxShadow: active ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                <Icon size={13} />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 100px' }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'40px' }}>
            <div style={{ width:'28px', height:'28px', border:'3px solid #e5e5ea',
                          borderTopColor:'#3478f6', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
          </div>
        ) : (
          <>
            <SortBar count={sorted.length} sort={sort} setSort={setSort}
                     order={order} setOrder={setOrder} label={tabLabel} />

            {sorted.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px' }}>
                <p style={{ color:'#8e8e93', fontSize:'15px', fontWeight:'500' }}>No {tabLabel.toLowerCase()} found</p>
              </div>
            ) : tab === 'video' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                {sorted.map(f => (
                  <div key={f.id} style={{ background:'white', borderRadius:'14px',
                                           overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
                    <div style={{ aspectRatio:'16/9', background:'linear-gradient(135deg,#1c1c3a,#2c2c54)',
                                   display:'flex', alignItems:'center', justifyContent:'center', position:'relative',
                                   cursor:'pointer' }}
                         onClick={() => { setViewerFile(f); setViewerType('video'); }}>
                      <div style={{ width:'40px', height:'40px', borderRadius:'50%', border:'none',
                               background:'rgba(255,255,255,0.18)', cursor:'pointer',
                               display:'flex', alignItems:'center', justifyContent:'center',
                               backdropFilter:'blur(8px)' }}>
                        <Play size={18} color="white" fill="white" />
                      </div>
                      {f.size > 0 && (
                        <span style={{ position:'absolute', bottom:'6px', left:'6px',
                                       background:'rgba(0,0,0,0.65)', color:'white', fontSize:'10px',
                                       padding:'2px 6px', borderRadius:'6px', fontWeight:'600' }}>
                          {formatSize(f.size)}
                        </span>
                      )}
                    </div>
                    <div style={{ padding:'10px' }}>
                      <p style={{ fontSize:'12px', fontWeight:'600', color:'#1c1c1e', margin:0,
                                   overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2,
                                   WebkitBoxOrient:'vertical', lineHeight:'1.4' }}>
                        {f.name.replace(/\.[^.]+$/,'')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : tab === 'image' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
                {sorted.map(f => {
                  const src = api.streamUrl(source, f.channel_id, f.msg_id);
                  return (
                    <div key={f.id} style={{ aspectRatio:'1', borderRadius:'10px', overflow:'hidden',
                                             background:'#e5e5ea', cursor:'pointer' }}
                         onClick={() => play(f)}>
                      <img src={src} alt={f.name}
                        style={{ width:'100%', height:'100%', objectFit:'cover' }}
                        onError={e => { e.target.parentNode.style.background='#e5e5ea'; e.target.style.display='none'; }} />
                    </div>
                  );
                })}
              </div>
            ) : (
              // Audio, PDF, EPUB list
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {sorted.map(f => {
                  const t = TABS.find(t => t.key === tab);
                  const Icon = t?.icon || FileText;
                  const color = t?.color || '#8e8e93';
                  const needsChoice = tab === 'pdf' || tab === 'epub';
                  return (
                    <button key={f.id}
                      onClick={() => needsChoice ? (setViewerFile(f), setViewerType(tab)) : play(f)}
                      style={{ display:'flex', alignItems:'center', gap:'12px', background:'white',
                                borderRadius:'14px', padding:'12px 14px', border:'none', cursor:'pointer',
                                boxShadow:'0 1px 3px rgba(0,0,0,0.08)', textAlign:'left', width:'100%' }}>
                      <div style={{ width:'42px', height:'42px', borderRadius:'10px', flexShrink:0,
                                    background:color+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Icon size={20} color={color} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'14px', fontWeight:'600', color:'#1c1c1e', margin:0,
                                     overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {f.name.replace(/\.[^.]+$/,'')}
                        </p>
                        <p style={{ fontSize:'12px', color:'#8e8e93', margin:'2px 0 0' }}>
                          {formatSize(f.size)}{f.caption ? ' · '+f.caption.slice(0,40) : ''}
                        </p>
                      </div>
                      <Play size={15} color="#c7c7cc" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Viewer choice modal */}
      <ViewerModal />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
