import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Play, Star, ChevronRight, RefreshCw, Film, Tv, Search, X, ArrowLeft, Bookmark } from 'lucide-react';
import { api } from '../../utils/api';
import { groupMovies } from '../../utils/movieParser';
import { searchTMDB, posterUrl, backdropUrl, getRating, getOverview, MOVIE_GENRES, TV_GENRES } from '../../utils/tmdb';

const AIR_MOVIES_ID = '-1003930241514';
const TMDB_CACHE_KEY = 'airbooks_tmdb_cache_v1';

const GRADS = [
  ['#1a1a2e','#e94560'],['#0f3460','#533483'],['#1b262c','#0f4c75'],
  ['#2d132c','#ee4540'],['#0a3d62','#38ada9'],['#1c1c1e','#30b0c7'],
  ['#2c003e','#7b2d8b'],['#151515','#3d5a80'],['#0d0d0d','#870000'],
  ['#1a1a2e','#4a00e0'],
];
function grad(id) {
  const n = Math.abs((id||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0));
  return GRADS[n % GRADS.length];
}

// Load/save TMDB cache in localStorage
function loadTMDBCache() {
  try { return JSON.parse(localStorage.getItem(TMDB_CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveTMDBCache(c) {
  try { localStorage.setItem(TMDB_CACHE_KEY, JSON.stringify(c)); } catch {}
}

async function enrich(group, tmdbCache) {
  const cacheKey = `${group.title}|${group.year}|${group.isSeries}`;
  let data = tmdbCache[cacheKey];
  if (!data) {
    data = await searchTMDB(group.title, group.year, group.isSeries);
    if (data) tmdbCache[cacheKey] = data;
  }
  const gmap = group.isSeries ? TV_GENRES : MOVIE_GENRES;
  const genres = data?.source === 'omdb' && data?.genres_text
    ? data.genres_text.split(',').slice(0,2).map(g=>g.trim())
    : (data?.genre_ids||[]).slice(0,2).map(id=>gmap[id]).filter(Boolean);
  return {
    ...group,
    poster:   posterUrl(data),
    backdrop: backdropUrl(data),
    rating:   getRating(data),
    overview: getOverview(data),
    genres,
  };
}

// ── Poster card ────────────────────────────────────────────────────────────
function PosterCard({ movie, onTap, style = {} }) {
  const [failed, setFailed] = useState(false);
  const [g1,g2] = grad(movie.id);
  return (
    <button onClick={()=>onTap(movie)} style={{
      flexShrink:0, width:'120px', background:'none',
      border:'none', cursor:'pointer', padding:0, textAlign:'left', ...style,
    }}>
      <div style={{
        width:'120px', height:'178px', borderRadius:'14px', overflow:'hidden',
        background:`linear-gradient(135deg,${g1},${g2})`, position:'relative',
        marginBottom:'8px', boxShadow:'0 4px 14px rgba(0,0,0,0.18)',
      }}>
        {movie.poster && !failed
          ? <img src={movie.poster} alt={movie.title}
              style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
              onError={()=>setFailed(true)} />
          : <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',
                         alignItems:'center',justifyContent:'center',gap:'8px',padding:'10px'}}>
              {movie.isSeries?<Tv size={26} color="rgba(255,255,255,0.5)"/>:<Film size={26} color="rgba(255,255,255,0.5)"/>}
              <p style={{color:'white',fontSize:'11px',fontWeight:'700',textAlign:'center',
                         lineHeight:'1.3',margin:0,display:'-webkit-box',
                         WebkitLineClamp:4,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                {movie.title}
              </p>
            </div>
        }
        <div style={{position:'absolute',top:'6px',left:'6px',
          background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',
          color:'white',fontSize:'9px',fontWeight:'700',
          padding:'2px 6px',borderRadius:'4px'}}>
          {movie.isSeries?'TV':'MOVIE'}
        </div>
        {movie.rating && (
          <div style={{position:'absolute',top:'6px',right:'6px',
            background:'#e91e8c',color:'white',fontSize:'9px',fontWeight:'700',
            padding:'2px 6px',borderRadius:'4px',
            display:'flex',alignItems:'center',gap:'2px'}}>
            <Star size={8} fill="white" strokeWidth={0}/> {movie.rating}
          </div>
        )}
        {movie.qualities?.length>0 && (
          <div style={{position:'absolute',bottom:'6px',left:'6px',display:'flex',gap:'3px'}}>
            {movie.qualities.slice(0,2).map(q=>(
              <span key={q} style={{background:'rgba(0,0,0,0.8)',color:'#4ade80',
                fontSize:'8px',fontWeight:'700',padding:'1px 5px',borderRadius:'3px'}}>{q}</span>
            ))}
          </div>
        )}
      </div>
      <p style={{fontSize:'12px',fontWeight:'600',color:'#1c1c1e',margin:'0 0 2px',
                 overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,
                 WebkitBoxOrient:'vertical',lineHeight:'1.3'}}>
        {movie.title}
      </p>
      {movie.year && <p style={{fontSize:'11px',color:'#8e8e93',margin:0}}>{movie.year}</p>}
    </button>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function Hero({ movies, onPlay }) {
  const [idx,setIdx] = useState(0);
  useEffect(()=>{
    if(movies.length<2) return;
    const t = setInterval(()=>setIdx(i=>(i+1)%movies.length),5000);
    return ()=>clearInterval(t);
  },[movies.length]);
  if(!movies.length) return null;
  const m = movies[idx];
  const [g1,g2] = grad(m.id);
  return (
    <div style={{position:'relative',width:'100%',height:'300px',overflow:'hidden'}}>
      {m.backdrop
        ? <img src={m.backdrop} alt={m.title}
            style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
        : <div style={{width:'100%',height:'100%',
                       background:`linear-gradient(135deg,${g1},${g2})`}}/>
      }
      <div style={{position:'absolute',inset:0,
        background:'linear-gradient(to bottom,rgba(0,0,0,0.0) 0%,rgba(0,0,0,0.8) 100%)'}}/>
      <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'16px'}}>
        <div style={{display:'flex',gap:'6px',marginBottom:'6px'}}>
          <span style={{background:'rgba(255,255,255,0.2)',backdropFilter:'blur(6px)',
            color:'white',fontSize:'10px',fontWeight:'700',padding:'2px 8px',borderRadius:'5px'}}>
            {m.isSeries?'SERIES':'MOVIE'}
          </span>
          {m.rating && (
            <span style={{background:'#e91e8c',color:'white',fontSize:'10px',fontWeight:'700',
              padding:'2px 8px',borderRadius:'5px',display:'flex',alignItems:'center',gap:'3px'}}>
              <Star size={9} fill="white" strokeWidth={0}/> {m.rating}
            </span>
          )}
        </div>
        <h2 style={{color:'white',fontWeight:'800',fontSize:'22px',margin:'0 0 4px',
                    textShadow:'0 2px 10px rgba(0,0,0,0.5)',lineHeight:'1.2'}}>
          {m.title}
        </h2>
        {m.year && <p style={{color:'rgba(255,255,255,0.7)',fontSize:'12px',margin:'0 0 4px'}}>
          {m.year}{m.genres?.length?' · '+m.genres.join(' · '):''}
        </p>}
        <button onClick={()=>onPlay(m)} style={{
          display:'inline-flex',alignItems:'center',gap:'8px',
          background:'rgba(20,20,20,0.85)',backdropFilter:'blur(8px)',
          color:'white',border:'none',borderRadius:'24px',
          padding:'10px 22px',fontWeight:'700',fontSize:'14px',cursor:'pointer',
        }}>
          <Play size={15} fill="white" strokeWidth={0}/> Watch
        </button>
      </div>
      {movies.length>1 && (
        <div style={{position:'absolute',bottom:'12px',right:'16px',display:'flex',gap:'5px'}}>
          {movies.slice(0,6).map((_,i)=>(
            <div key={i} onClick={()=>setIdx(i)} style={{
              width:i===idx?'18px':'6px',height:'6px',borderRadius:'3px',
              background:i===idx?'white':'rgba(255,255,255,0.4)',
              cursor:'pointer',transition:'width 0.3s',
            }}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────
function Row({ icon, title, movies, onTap, onViewAll }) {
  if(!movies.length) return null;
  return (
    <div style={{marginBottom:'24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                   padding:'0 16px',marginBottom:'12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'34px',height:'34px',borderRadius:'10px',
            background:'#f2f2f7',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:'16px'}}>{icon}</span>
          </div>
          <span style={{fontSize:'17px',fontWeight:'700',color:'#1c1c1e'}}>{title}</span>
        </div>
        <button onClick={onViewAll} style={{background:'none',border:'none',cursor:'pointer',
          display:'flex',alignItems:'center',gap:'2px',
          fontSize:'13px',fontWeight:'600',color:'#3478f6',padding:'4px 8px'}}>
          View All <ChevronRight size={14}/>
        </button>
      </div>
      <div style={{display:'flex',gap:'12px',overflowX:'auto',
                   padding:'2px 16px 8px',scrollbarWidth:'none'}}>
        {movies.slice(0,20).map(m=><PosterCard key={m.id} movie={m} onTap={onTap}/>)}
      </div>
    </div>
  );
}

// ── Movie detail page (like Telefin) ───────────────────────────────────────
function MovieDetail({ movie, onBack, onPlay }) {
  const [g1,g2] = grad(movie.id);
  const [imgFailed, setImgFailed] = useState(false);
  const sorted = [...(movie.versions||[])].sort((a,b)=>b.qualityRank-a.qualityRank);

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f2f2f7',overflow:'hidden'}}>
      <div style={{flex:1,overflowY:'auto'}}>
        {/* Backdrop */}
        <div style={{position:'relative',width:'100%',height:'260px',overflow:'hidden'}}>
          {movie.backdrop && !imgFailed
            ? <img src={movie.backdrop} alt={movie.title}
                style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                onError={()=>setImgFailed(true)}/>
            : <div style={{width:'100%',height:'100%',
                           background:`linear-gradient(135deg,${g1},${g2})`}}/>
          }
          <div style={{position:'absolute',inset:0,
            background:'linear-gradient(to bottom,rgba(0,0,0,0.1),rgba(0,0,0,0.6))'}}/>
          {/* Top nav */}
          <div style={{position:'absolute',top:0,left:0,right:0,
            display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'48px 16px 0'}}>
            <button onClick={onBack} style={{
              width:'36px',height:'36px',borderRadius:'50%',
              background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)',
              border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <ArrowLeft size={18} color="white"/>
            </button>
            <button style={{
              width:'36px',height:'36px',borderRadius:'50%',
              background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)',
              border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Bookmark size={16} color="white"/>
            </button>
          </div>
        </div>

        {/* Info card */}
        <div style={{margin:'16px',background:'white',borderRadius:'20px',
                     padding:'16px',boxShadow:'0 2px 12px rgba(0,0,0,0.08)'}}>
          <div style={{display:'flex',gap:'14px',marginBottom:'14px'}}>
            {/* Poster */}
            <div style={{width:'80px',height:'120px',borderRadius:'12px',overflow:'hidden',
                         flexShrink:0,background:`linear-gradient(135deg,${g1},${g2})`,
                         display:'flex',alignItems:'center',justifyContent:'center',
                         boxShadow:'0 4px 12px rgba(0,0,0,0.2)'}}>
              {movie.poster
                ? <img src={movie.poster} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : <Film size={28} color="rgba(255,255,255,0.6)"/>
              }
            </div>
            <div style={{flex:1}}>
              <h1 style={{fontWeight:'800',fontSize:'18px',color:'#1c1c1e',margin:'0 0 8px',lineHeight:'1.2'}}>
                {movie.title}
              </h1>
              <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                {movie.rating && (
                  <span style={{display:'inline-flex',alignItems:'center',gap:'4px',
                    background:'#f0f0f5',color:'#1c1c1e',fontSize:'13px',fontWeight:'700',
                    padding:'4px 10px',borderRadius:'20px'}}>
                    <Star size={12} fill="#f59e0b" color="#f59e0b"/> {movie.rating}
                  </span>
                )}
                {movie.year && (
                  <span style={{background:'#e8f0ff',color:'#3478f6',fontSize:'12px',
                    fontWeight:'700',padding:'4px 10px',borderRadius:'20px'}}>
                    {movie.year}
                  </span>
                )}
                <span style={{background:'#f0f0f5',color:'#636366',fontSize:'12px',
                  fontWeight:'600',padding:'4px 10px',borderRadius:'20px'}}>
                  {movie.isSeries?'Series':'Movie'}
                </span>
                {movie.genres?.map(g=>(
                  <span key={g} style={{background:'#f0f0f5',color:'#636366',fontSize:'12px',
                    fontWeight:'600',padding:'4px 10px',borderRadius:'20px'}}>{g}</span>
                ))}
              </div>
            </div>
          </div>
          {/* Divider */}
          <div style={{height:'1px',background:'#f2f2f7',margin:'0 0 14px'}}/>
          {/* Overview */}
          {movie.overview && (
            <p style={{fontSize:'14px',color:'#3c3c43',lineHeight:'1.6',margin:0}}>
              {movie.overview}
            </p>
          )}
        </div>

        {/* Quality options */}
        <div style={{margin:'0 16px 100px'}}>
          <p style={{fontWeight:'700',fontSize:'13px',color:'#8e8e93',
                     margin:'0 0 10px',letterSpacing:'0.5px'}}>
            AVAILABLE QUALITIES
          </p>
          {sorted.map((v,i)=>(
            <button key={i} onClick={()=>onPlay(v)} style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              width:'100%',padding:'14px',
              background:i===0?'#e8f0ff':'white',
              border:i===0?'1.5px solid #3478f640':'1.5px solid #f2f2f7',
              borderRadius:'16px',cursor:'pointer',marginBottom:'8px',
              boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'12px',
                  background:i===0?'#3478f620':'#f2f2f7',
                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Play size={17} color={i===0?'#3478f6':'#8e8e93'}
                        fill={i===0?'#3478f6':'#8e8e93'} strokeWidth={0}/>
                </div>
                <div style={{textAlign:'left'}}>
                  <p style={{fontWeight:'700',fontSize:'14px',
                             color:i===0?'#3478f6':'#1c1c1e',margin:0}}>
                    {v.quality?v.quality.toUpperCase():'Standard'}{i===0?' · Best Quality':''}
                  </p>
                  <p style={{fontSize:'11px',color:'#8e8e93',margin:'2px 0 0',
                             overflow:'hidden',textOverflow:'ellipsis',
                             whiteSpace:'nowrap',maxWidth:'210px'}}>
                    {v.name?.replace(/\.[^.]+$/,'')}
                  </p>
                </div>
              </div>
              {v.size>0 && (
                <span style={{fontSize:'12px',color:'#8e8e93',fontWeight:'600',flexShrink:0}}>
                  {(v.size/1e9).toFixed(1)} GB
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Play button */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,
        padding:'12px 16px calc(env(safe-area-inset-bottom,0px)+12px)',
        background:'white',borderTop:'1px solid #f2f2f7'}}>
        <button onClick={()=>sorted[0] && onPlay(sorted[0])} style={{
          width:'100%',padding:'16px',borderRadius:'16px',border:'none',
          background:'#3478f6',color:'white',fontWeight:'700',fontSize:'16px',
          cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
        }}>
          <Play size={18} fill="white" strokeWidth={0}/> Play
        </button>
      </div>
    </div>
  );
}

// ── Grid view ──────────────────────────────────────────────────────────────
function GridView({ title, movies, onBack, onTap }) {
  const [q, setQ] = useState('');
  const filtered = movies.filter(m=>!q||m.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f2f2f7',overflow:'hidden'}}>
      <div style={{padding:'50px 16px 10px',background:'#f2f2f7',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
          <button onClick={onBack} style={{width:'36px',height:'36px',borderRadius:'10px',
            background:'white',border:'none',cursor:'pointer',display:'flex',
            alignItems:'center',justifyContent:'center',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',flexShrink:0}}>
            <ArrowLeft size={18} color="#3478f6"/>
          </button>
          <h2 style={{fontSize:'18px',fontWeight:'700',color:'#1c1c1e',margin:0,flex:1}}>{title}</h2>
          <span style={{fontSize:'13px',color:'#8e8e93'}}>{filtered.length}</span>
        </div>
        <div style={{position:'relative'}}>
          <Search size={14} color="#8e8e93" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)'}}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..."
            style={{width:'100%',boxSizing:'border-box',background:'white',border:'none',
              borderRadius:'12px',padding:'10px 12px 10px 34px',fontSize:'14px',
              color:'#1c1c1e',outline:'none',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}/>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'8px 16px 100px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'14px'}}>
          {filtered.map(m=>{
            const [g1,g2] = grad(m.id);
            const [failed,setFailed] = useState(false);
            return (
              <button key={m.id} onClick={()=>onTap(m)} style={{
                background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}}>
                <div style={{width:'100%',paddingTop:'150%',position:'relative',
                             borderRadius:'12px',overflow:'hidden',
                             background:`linear-gradient(135deg,${g1},${g2})`,
                             marginBottom:'6px',boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}>
                  {m.poster && !failed
                    ? <img src={m.poster} alt={m.title}
                        style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}
                        onError={()=>setFailed(true)}/>
                    : <div style={{position:'absolute',inset:0,display:'flex',
                                   alignItems:'center',justifyContent:'center'}}>
                        <Film size={22} color="rgba(255,255,255,0.5)"/>
                      </div>
                  }
                  {m.rating && (
                    <div style={{position:'absolute',top:'5px',right:'5px',
                      background:'#e91e8c',color:'white',fontSize:'9px',fontWeight:'700',
                      padding:'2px 5px',borderRadius:'4px',
                      display:'flex',alignItems:'center',gap:'2px'}}>
                      <Star size={7} fill="white" strokeWidth={0}/> {m.rating}
                    </div>
                  )}
                </div>
                <p style={{fontSize:'11px',fontWeight:'600',color:'#1c1c1e',margin:'0 0 1px',
                           overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {m.title}
                </p>
                <p style={{fontSize:'10px',color:'#8e8e93',margin:0}}>{m.year}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const [all, setAll]             = useState([]);
  const [loading, setLoading]     = useState(true);
  const [detailMovie, setDetail]  = useState(null);
  const [viewAll, setViewAll]     = useState(null);
  const [search, setSearch]       = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const tmdbCache = useRef(loadTMDBCache());

  function playFile(file) {
    const backendBase = (import.meta.env.VITE_API_URL||'').replace(/\/api$/,'');
    const streamUrl = api.streamUrl('user', file.channel_id, file.msg_id);
    window.open(
      `${backendBase}/player?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(file.name)}&id=${encodeURIComponent(file.id)}`,
      '_blank'
    );
  }

  const load = useCallback(async (forceRefresh=false) => {
    setLoading(true);
    if (forceRefresh) {
      try { sessionStorage.removeItem(`ab_files_d_${AIR_MOVIES_ID}_video`); } catch {}
    }
    try {
      const res = await api.getChannelFiles(AIR_MOVIES_ID, 'video', forceRefresh);
      const groups = groupMovies(res.files||[]);
      const enriched = [];
      for (let i=0; i<groups.length; i+=6) {
        const batch = groups.slice(i,i+6);
        const results = await Promise.all(batch.map(g=>enrich(g, tmdbCache.current)));
        enriched.push(...results);
        setAll([...enriched]);
        saveTMDBCache(tmdbCache.current);
        if (i+6<groups.length) await new Promise(r=>setTimeout(r,200));
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(()=>{ load(); },[]);

  const movies   = useMemo(()=>all.filter(m=>!m.isSeries),[all]);
  const series   = useMemo(()=>all.filter(m=>m.isSeries),[all]);
  const recent   = useMemo(()=>[...all].sort((a,b)=>b.date-a.date).slice(0,20),[all]);
  const topRated = useMemo(()=>[...all].filter(m=>m.rating).sort((a,b)=>parseFloat(b.rating)-parseFloat(a.rating)).slice(0,20),[all]);
  const heroList = useMemo(()=>recent.filter(m=>m.backdrop).slice(0,6),[recent]);

  const searchResults = useMemo(()=>{
    if(!search.trim()) return [];
    const q = search.toLowerCase();
    return all.filter(m=>
      m.title.toLowerCase().includes(q)||
      (m.year||'').includes(q)||
      (m.genres||[]).some(g=>g.toLowerCase().includes(q))
    );
  },[all,search]);

  // Navigate detail → play
  if (detailMovie) {
    return (
      <MovieDetail
        movie={detailMovie}
        onBack={()=>setDetail(null)}
        onPlay={file=>{ playFile(file); }}
      />
    );
  }

  if (viewAll) {
    return <GridView title={viewAll.title} movies={viewAll.movies}
                     onBack={()=>setViewAll(null)} onTap={setDetail}/>;
  }

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f2f2f7',overflow:'hidden'}}>

      {/* Header — overlaid on hero */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,zIndex:20,
        padding:'48px 16px 10px',
        background: showSearch ? '#f2f2f7' : 'linear-gradient(to bottom,rgba(0,0,0,0.35),transparent)',
      }}>
        {showSearch ? (
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{position:'relative',flex:1}}>
              <Search size={14} color="#8e8e93" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)'}}/>
              <input autoFocus value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search movies & series..."
                style={{width:'100%',boxSizing:'border-box',background:'white',border:'none',
                  borderRadius:'12px',padding:'11px 34px 11px 34px',fontSize:'14px',
                  color:'#1c1c1e',outline:'none',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}/>
              {search && <button onClick={()=>setSearch('')} style={{
                position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',
                background:'none',border:'none',cursor:'pointer',padding:0}}>
                <X size={14} color="#8e8e93"/>
              </button>}
            </div>
            <button onClick={()=>{setShowSearch(false);setSearch('');}}
              style={{background:'none',border:'none',cursor:'pointer',
                fontSize:'14px',fontWeight:'600',color:'#3478f6',whiteSpace:'nowrap'}}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'24px',fontWeight:'800',color:'white',
                          textShadow:'0 1px 6px rgba(0,0,0,0.4)'}}>Discover</span>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>setShowSearch(true)} style={{
                width:'36px',height:'36px',borderRadius:'10px',
                background:'rgba(255,255,255,0.2)',backdropFilter:'blur(8px)',
                border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Search size={16} color="white"/>
              </button>
              <button onClick={()=>load(true)} style={{
                width:'36px',height:'36px',borderRadius:'10px',
                background:'rgba(255,255,255,0.2)',backdropFilter:'blur(8px)',
                border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <RefreshCw size={15} color="white"
                  style={{animation:loading?'spin 1s linear infinite':'none'}}/>
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{flex:1,overflowY:'auto',overflowX:'hidden',paddingBottom:'100px'}}>
        {showSearch && search ? (
          <div style={{paddingTop:'100px',padding:'100px 16px 20px'}}>
            {searchResults.length===0
              ? <p style={{textAlign:'center',color:'#8e8e93',padding:'40px',fontSize:'15px'}}>
                  No results for "{search}"
                </p>
              : <>
                  <p style={{fontSize:'13px',color:'#8e8e93',margin:'0 0 14px',fontWeight:'500'}}>
                    {searchResults.length} results
                  </p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px'}}>
                    {searchResults.map(m=>{
                      const [g1,g2]=grad(m.id);
                      return (
                        <button key={m.id} onClick={()=>setDetail(m)} style={{
                          background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}}>
                          <div style={{width:'100%',paddingTop:'150%',position:'relative',
                            borderRadius:'12px',overflow:'hidden',
                            background:`linear-gradient(135deg,${g1},${g2})`,
                            marginBottom:'5px',boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}>
                            {m.poster && <img src={m.poster} alt=""
                              style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>}
                            {m.rating && <div style={{position:'absolute',top:'5px',right:'5px',
                              background:'#e91e8c',color:'white',fontSize:'9px',fontWeight:'700',
                              padding:'2px 5px',borderRadius:'4px',display:'flex',alignItems:'center',gap:'2px'}}>
                              <Star size={7} fill="white" strokeWidth={0}/> {m.rating}
                            </div>}
                          </div>
                          <p style={{fontSize:'11px',fontWeight:'600',color:'#1c1c1e',margin:0,
                            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.title}</p>
                          <p style={{fontSize:'10px',color:'#8e8e93',margin:'1px 0 0'}}>{m.year}</p>
                        </button>
                      );
                    })}
                  </div>
                </>
            }
          </div>
        ) : (
          <>
            {/* Hero — no top padding, full width */}
            {heroList.length>0
              ? <Hero movies={heroList} onPlay={setDetail}/>
              : loading&&all.length===0
                ? <div style={{width:'100%',height:'300px',background:'linear-gradient(135deg,#1a1a2e,#0f3460)'}}/>
                : <div style={{height:'88px'}}/>
            }

            {loading && all.length===0 ? (
              <div style={{padding:'20px 16px'}}>
                {[0,1,2].map(r=>(
                  <div key={r} style={{marginBottom:'24px'}}>
                    <div style={{height:'18px',width:'120px',background:'#e5e5ea',borderRadius:'6px',marginBottom:'12px'}}/>
                    <div style={{display:'flex',gap:'12px'}}>
                      {[0,1,2].map(i=>(
                        <div key={i} style={{flexShrink:0,width:'120px'}}>
                          <div style={{width:'120px',height:'178px',background:'#e5e5ea',borderRadius:'12px',marginBottom:'8px'}}/>
                          <div style={{height:'12px',background:'#e5e5ea',borderRadius:'4px'}}/>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{paddingTop:'16px'}}>
                <Row icon="🆕" title="Recently Added" movies={recent} onTap={setDetail}
                  onViewAll={()=>setViewAll({title:'Recently Added',movies:recent})}/>
                {topRated.length>0 && (
                  <Row icon="⭐" title="Top Rated" movies={topRated} onTap={setDetail}
                    onViewAll={()=>setViewAll({title:'Top Rated',movies:topRated})}/>
                )}
                {movies.length>0 && (
                  <Row icon="🎬" title="Movies" movies={movies} onTap={setDetail}
                    onViewAll={()=>setViewAll({title:'Movies',movies})}/>
                )}
                {series.length>0 && (
                  <Row icon="📺" title="Series" movies={series} onTap={setDetail}
                    onViewAll={()=>setViewAll({title:'Series',movies:series})}/>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
