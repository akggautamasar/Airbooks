import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Play, Star, ChevronRight, RefreshCw, Film, Tv, Search, X, ArrowLeft, Bookmark, BookmarkCheck } from 'lucide-react';
import { api } from '../../utils/api';
import { groupMovies } from '../../utils/movieParser';
import { searchTMDB, posterUrl, backdropUrl, getRating, getOverview, MOVIE_GENRES, TV_GENRES } from '../../utils/tmdb';
import { useApp } from '../../store/AppContext';

const AIR_MOVIES_ID = '-1003930241514';
const TMDB_CACHE_KEY = 'airbooks_tmdb_cache_v1';
const BOOKMARKS_KEY  = 'airbooks_bookmarks_v1';

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

function loadTMDBCache() {
  try { return JSON.parse(localStorage.getItem(TMDB_CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveTMDBCache(c) {
  try { localStorage.setItem(TMDB_CACHE_KEY, JSON.stringify(c)); } catch {}
}
function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); } catch { return []; }
}
function saveBookmarks(b) {
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(b)); } catch {}
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

// ── Initials avatar ────────────────────────────────────────────────────────
function UserPill({ user }) {
  const name = user?.name || 'Guest';
  const initials = name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'8px',
      background:'rgba(255,255,255,0.18)', backdropFilter:'blur(12px)',
      borderRadius:'24px', padding:'5px 14px 5px 6px',
      border:'1px solid rgba(255,255,255,0.22)',
    }}>
      <div style={{
        width:'28px', height:'28px', borderRadius:'50%',
        background:'#3478f6', display:'flex', alignItems:'center',
        justifyContent:'center', flexShrink:0,
      }}>
        <span style={{color:'white', fontWeight:'800', fontSize:'11px'}}>{initials}</span>
      </div>
      <span style={{color:'white', fontWeight:'600', fontSize:'13px', maxWidth:'120px',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
        {name}
      </span>
    </div>
  );
}

// ── Hero (Telefin-style, full-bleed, crossfade) ────────────────────────────
function Hero({ movies, onPlay, onSearch, onBookmark, user }) {
  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);
  const idxRef                = useRef(0);

  useEffect(() => { idxRef.current = idx; }, [idx]);

  useEffect(() => {
    if (idx >= movies.length && movies.length > 0) setIdx(0);
  }, [movies.length]);

  const goTo = useCallback((next) => {
    setVisible(false);
    setTimeout(() => { setIdx(next); setVisible(true); }, 350);
  }, []);

  useEffect(() => {
    if (movies.length < 2) return;
    const t = setInterval(() => {
      goTo((idxRef.current + 1) % movies.length);
    }, 5000);
    return () => clearInterval(t);
  }, [movies.length, goTo]);

  if (!movies.length) return null;

  const safeIdx  = Math.min(idx, movies.length - 1);
  const m        = movies[safeIdx];
  const [g1,g2]  = grad(m.id);
  const bgImage  = m.backdrop || m.poster;

  return (
    <div style={{ position:'relative', width:'100%', height:'58vh', minHeight:'320px', overflow:'hidden', flexShrink:0 }}>

      {/* Backdrop with crossfade via opacity */}
      <div style={{
        position:'absolute', inset:0, zIndex:1,
        opacity: visible ? 1 : 0,
        transition:'opacity 0.35s ease',
      }}>
        {bgImage
          ? <img src={bgImage} alt={m.title}
              style={{
                width:'100%', height:'100%', objectFit:'cover', display:'block',
                // If using poster as backdrop, scale+blur it to fill nicely
                filter: m.backdrop ? 'none' : 'blur(3px) brightness(0.75)',
                transform: m.backdrop ? 'none' : 'scale(1.08)',
              }}/>
          : <div style={{width:'100%',height:'100%',background:`linear-gradient(135deg,${g1},${g2})`}}/>
        }
      </div>

      {/* Gradient overlays */}
      <div style={{
        position:'absolute', inset:0, zIndex:3,
        background:'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.05) 55%, rgba(0,0,0,0.82) 100%)',
      }}/>

      {/* Top bar */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, zIndex:10,
        padding:'48px 16px 0',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <UserPill user={user}/>
        <div style={{display:'flex', gap:'8px'}}>
          <button onClick={onSearch} style={{
            width:'38px', height:'38px', borderRadius:'12px',
            background:'rgba(255,255,255,0.18)', backdropFilter:'blur(10px)',
            border:'1px solid rgba(255,255,255,0.2)',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Search size={17} color="white"/>
          </button>
          <button onClick={onBookmark} style={{
            width:'38px', height:'38px', borderRadius:'12px',
            background:'rgba(255,255,255,0.18)', backdropFilter:'blur(10px)',
            border:'1px solid rgba(255,255,255,0.2)',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Bookmark size={17} color="white"/>
          </button>
        </div>
      </div>

      {/* Bottom content */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, zIndex:10,
        padding:'0 20px 22px',
        display:'flex', flexDirection:'column', alignItems:'center',
      }}>
        {/* Title */}
        <h2 style={{
          color:'white', fontWeight:'900', fontSize:'clamp(22px,6vw,32px)',
          margin:'0 0 16px', textAlign:'center', lineHeight:'1.15',
          textShadow:'0 2px 16px rgba(0,0,0,0.6)',
          letterSpacing:'-0.5px',
          textTransform: m.title === m.title.toUpperCase() ? 'none' : 'none',
          maxWidth:'90%',
          overflow:'hidden', display:'-webkit-box',
          WebkitLineClamp:2, WebkitBoxOrient:'vertical',
        }}>
          {m.title}
        </h2>

        {/* Watch button */}
        <button onClick={() => onPlay(m)} style={{
          display:'inline-flex', alignItems:'center', gap:'9px',
          background:'rgba(18,18,24,0.82)', backdropFilter:'blur(10px)',
          color:'white', border:'1.5px solid rgba(255,255,255,0.15)',
          borderRadius:'30px', padding:'11px 28px',
          fontWeight:'700', fontSize:'15px', cursor:'pointer',
          boxShadow:'0 4px 20px rgba(0,0,0,0.35)',
          letterSpacing:'0.2px',
        }}>
          <Play size={15} fill="white" strokeWidth={0}/> Watch
        </button>

        {/* Dot indicators */}
        {movies.length > 1 && (
          <div style={{display:'flex', gap:'6px', marginTop:'16px'}}>
            {movies.slice(0,8).map((_,i) => (
              <div key={i} onClick={() => goTo(i)} style={{
                width: i===safeIdx ? '20px' : '6px',
                height:'6px', borderRadius:'3px',
                background: i===safeIdx ? 'white' : 'rgba(255,255,255,0.35)',
                cursor:'pointer', transition:'all 0.35s ease',
              }}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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

// ── Grid card ─────────────────────────────────────────────────────────────
function GridCard({ movie, onTap }) {
  const [failed, setFailed] = useState(false);
  const [g1,g2] = grad(movie.id);
  return (
    <button onClick={()=>onTap(movie)} style={{
      background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left', width:'100%',
    }}>
      <div style={{width:'100%', paddingTop:'150%', position:'relative',
                   borderRadius:'12px', overflow:'hidden',
                   background:`linear-gradient(135deg,${g1},${g2})`,
                   marginBottom:'6px', boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}>
        {movie.poster && !failed
          ? <img src={movie.poster} alt={movie.title}
              style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}
              onError={()=>setFailed(true)}/>
          : <div style={{position:'absolute',inset:0,display:'flex',
                         alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'4px',padding:'6px'}}>
              <Film size={20} color="rgba(255,255,255,0.5)"/>
              <p style={{color:'rgba(255,255,255,0.7)',fontSize:'9px',fontWeight:'600',
                         textAlign:'center',margin:0,lineHeight:'1.3',
                         overflow:'hidden',display:'-webkit-box',
                         WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>
                {movie.title}
              </p>
            </div>
        }
        {movie.rating && (
          <div style={{position:'absolute',top:'5px',right:'5px',
            background:'#e91e8c',color:'white',fontSize:'9px',fontWeight:'700',
            padding:'2px 5px',borderRadius:'4px',
            display:'flex',alignItems:'center',gap:'2px'}}>
            <Star size={7} fill="white" strokeWidth={0}/> {movie.rating}
          </div>
        )}
        <div style={{position:'absolute',top:'5px',left:'5px',
          background:'rgba(0,0,0,0.6)',color:'white',fontSize:'8px',fontWeight:'700',
          padding:'1px 5px',borderRadius:'3px'}}>
          {movie.isSeries?'TV':'MOVIE'}
        </div>
      </div>
      <p style={{fontSize:'11px',fontWeight:'600',color:'#1c1c1e',margin:'0 0 1px',
                 overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
        {movie.title}
      </p>
      <p style={{fontSize:'10px',color:'#8e8e93',margin:0}}>{movie.year}</p>
    </button>
  );
}

// ── Landscape card ─────────────────────────────────────────────────────────
function LandscapeCard({ movie, onTap }) {
  const [failed, setFailed] = useState(false);
  const [g1,g2] = grad(movie.id);
  return (
    <button onClick={()=>onTap(movie)} style={{
      flexShrink:0, width:'260px', background:'none',
      border:'none', cursor:'pointer', padding:0, textAlign:'left',
    }}>
      <div style={{
        width:'260px', height:'155px', borderRadius:'16px', overflow:'hidden',
        background:`linear-gradient(135deg,${g1},${g2})`, position:'relative',
        marginBottom:'8px', boxShadow:'0 4px 16px rgba(0,0,0,0.2)',
      }}>
        {movie.backdrop && !failed
          ? <img src={movie.backdrop} alt={movie.title}
              style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
              onError={()=>setFailed(true)}/>
          : movie.poster && !failed
            ? <img src={movie.poster} alt={movie.title}
                style={{width:'100%',height:'100%',objectFit:'cover',display:'block',
                        filter:'blur(2px) brightness(0.7)',transform:'scale(1.1)'}}
                onError={()=>setFailed(true)}/>
            : <div style={{width:'100%',height:'100%',display:'flex',
                           alignItems:'center',justifyContent:'center'}}>
                <Film size={36} color="rgba(255,255,255,0.4)"/>
              </div>
        }
        <div style={{position:'absolute',inset:0,
          background:'linear-gradient(to bottom,rgba(0,0,0,0) 30%,rgba(0,0,0,0.85) 100%)'}}/>
        <div style={{position:'absolute',top:'8px',left:'8px',display:'flex',gap:'5px',alignItems:'center'}}>
          <span style={{background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',
            color:'white',fontSize:'9px',fontWeight:'700',padding:'2px 7px',borderRadius:'5px'}}>
            {movie.isSeries?'TV':'MOVIE'}
          </span>
          {movie.rating && (
            <span style={{background:'#e91e8c',color:'white',fontSize:'9px',fontWeight:'700',
              padding:'2px 7px',borderRadius:'5px',display:'flex',alignItems:'center',gap:'2px'}}>
              <Star size={8} fill="white" strokeWidth={0}/> {movie.rating}
            </span>
          )}
        </div>
        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'10px 10px 8px'}}>
          <p style={{color:'white',fontWeight:'800',fontSize:'14px',margin:'0 0 2px',
                     lineHeight:'1.2',textShadow:'0 1px 4px rgba(0,0,0,0.5)',
                     overflow:'hidden',display:'-webkit-box',
                     WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
            {movie.title}
          </p>
          <p style={{color:'rgba(255,255,255,0.7)',fontSize:'11px',margin:0}}>
            {movie.year}{movie.genres?.length?' · '+movie.genres[0]:''}
          </p>
        </div>
        {movie.qualities?.length>0 && (
          <div style={{position:'absolute',bottom:'8px',right:'8px',display:'flex',gap:'3px'}}>
            {movie.qualities.slice(0,1).map(q=>(
              <span key={q} style={{background:'rgba(0,0,0,0.8)',color:'#4ade80',
                fontSize:'9px',fontWeight:'700',padding:'2px 6px',borderRadius:'4px'}}>{q}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ── Landscape Row ──────────────────────────────────────────────────────────
function LandscapeRow({ icon, title, movies, onTap, onViewAll }) {
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
        {movies.slice(0,15).map(m=><LandscapeCard key={m.id} movie={m} onTap={onTap}/>)}
      </div>
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

// ── Movie detail ───────────────────────────────────────────────────────────
function MovieDetail({ movie, onBack, onPlay, bookmarks, onToggleBookmark }) {
  const [g1,g2] = grad(movie.id);
  const [imgFailed, setImgFailed] = useState(false);
  const sorted = [...(movie.versions||[])].sort((a,b)=>b.qualityRank-a.qualityRank);
  const isBookmarked = bookmarks.some(b=>b.id===movie.id);

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f2f2f7',overflow:'hidden'}}>
      <div style={{flex:1,overflowY:'auto'}}>
        <div style={{position:'relative',width:'100%',height:'260px',overflow:'hidden'}}>
          {movie.backdrop && !imgFailed
            ? <img src={movie.backdrop} alt={movie.title}
                style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                onError={()=>setImgFailed(true)}/>
            : <div style={{width:'100%',height:'100%',background:`linear-gradient(135deg,${g1},${g2})`}}/>
          }
          <div style={{position:'absolute',inset:0,
            background:'linear-gradient(to bottom,rgba(0,0,0,0.1),rgba(0,0,0,0.6))'}}/>
          <div style={{position:'absolute',top:0,left:0,right:0,
            display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'48px 16px 0'}}>
            <button onClick={onBack} style={{
              width:'36px',height:'36px',borderRadius:'50%',
              background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)',
              border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <ArrowLeft size={18} color="white"/>
            </button>
            <button onClick={()=>onToggleBookmark(movie)} style={{
              width:'36px',height:'36px',borderRadius:'50%',
              background: isBookmarked ? '#3478f6' : 'rgba(0,0,0,0.4)',
              backdropFilter:'blur(6px)',
              border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {isBookmarked
                ? <BookmarkCheck size={16} color="white"/>
                : <Bookmark size={16} color="white"/>
              }
            </button>
          </div>
        </div>

        <div style={{margin:'16px',background:'white',borderRadius:'20px',
                     padding:'16px',boxShadow:'0 2px 12px rgba(0,0,0,0.08)'}}>
          <div style={{display:'flex',gap:'14px',marginBottom:'14px'}}>
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
          <div style={{height:'1px',background:'#f2f2f7',margin:'0 0 14px'}}/>
          {movie.overview && (
            <p style={{fontSize:'14px',color:'#3c3c43',lineHeight:'1.6',margin:0}}>
              {movie.overview}
            </p>
          )}
        </div>

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
          {filtered.map(m=><GridCard key={m.id} movie={m} onTap={onTap}/>)}
        </div>
      </div>
    </div>
  );
}

// ── Bookmarks view ─────────────────────────────────────────────────────────
function BookmarksView({ bookmarks, onBack, onTap, onRemove }) {
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f2f2f7',overflow:'hidden'}}>
      <div style={{padding:'50px 16px 10px',background:'#f2f2f7',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
          <button onClick={onBack} style={{width:'36px',height:'36px',borderRadius:'10px',
            background:'white',border:'none',cursor:'pointer',display:'flex',
            alignItems:'center',justifyContent:'center',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',flexShrink:0}}>
            <ArrowLeft size={18} color="#3478f6"/>
          </button>
          <h2 style={{fontSize:'18px',fontWeight:'700',color:'#1c1c1e',margin:0,flex:1}}>Bookmarks</h2>
          <span style={{fontSize:'13px',color:'#8e8e93'}}>{bookmarks.length}</span>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'8px 16px 100px'}}>
        {bookmarks.length === 0
          ? <div style={{textAlign:'center',padding:'60px 20px'}}>
              <Bookmark size={40} color="#c7c7cc" style={{marginBottom:'12px'}}/>
              <p style={{color:'#8e8e93',fontSize:'15px',fontWeight:'500',margin:0}}>No bookmarks yet</p>
              <p style={{color:'#c7c7cc',fontSize:'13px',margin:'6px 0 0'}}>Tap the bookmark icon on any title to save it</p>
            </div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'14px'}}>
              {bookmarks.map(m=><GridCard key={m.id} movie={m} onTap={onTap}/>)}
            </div>
        }
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const { state } = useApp();
  const [all, setAll]             = useState([]);
  const [loading, setLoading]     = useState(true);
  const [detailMovie, setDetail]  = useState(null);
  const [viewAll, setViewAll]     = useState(null);
  const [search, setSearch]       = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const tmdbCache = useRef(loadTMDBCache());

  function toggleBookmark(movie) {
    setBookmarks(prev => {
      const exists = prev.some(b=>b.id===movie.id);
      const next = exists ? prev.filter(b=>b.id!==movie.id) : [movie,...prev];
      saveBookmarks(next);
      return next;
    });
  }

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
  // Hero: prefer top-rated with backdrops, fall back to any movie with image, then raw recent
  const heroList = useMemo(()=>{
    const withBackdrop = topRated.filter(m=>m.backdrop);
    if (withBackdrop.length >= 3) return withBackdrop.slice(0,8);
    const withImage = [...all].sort((a,b)=>b.date-a.date).filter(m=>m.backdrop||m.poster).slice(0,8);
    if (withImage.length >= 1) return withImage;
    return recent.slice(0,8);
  },[topRated, all, recent]);

  const searchResults = useMemo(()=>{
    if(!search.trim()) return [];
    const q = search.toLowerCase();
    return all.filter(m=>
      m.title.toLowerCase().includes(q)||
      (m.year||'').includes(q)||
      (m.genres||[]).some(g=>g.toLowerCase().includes(q))
    );
  },[all,search]);

  if (detailMovie) {
    return (
      <MovieDetail
        movie={detailMovie}
        onBack={()=>setDetail(null)}
        onPlay={file=>{ playFile(file); }}
        bookmarks={bookmarks}
        onToggleBookmark={toggleBookmark}
      />
    );
  }

  if (viewAll) {
    return <GridView title={viewAll.title} movies={viewAll.movies}
                     onBack={()=>setViewAll(null)} onTap={setDetail}/>;
  }

  if (showBookmarks) {
    return <BookmarksView bookmarks={bookmarks} onBack={()=>setShowBookmarks(false)}
                          onTap={setDetail} onRemove={toggleBookmark}/>;
  }

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f2f2f7',overflow:'hidden'}}>

      {/* Search overlay header (only when searching) */}
      {showSearch && (
        <div style={{
          position:'absolute',top:0,left:0,right:0,zIndex:30,
          padding:'48px 16px 10px',
          background:'#f2f2f7',
        }}>
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
        </div>
      )}

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
                    {searchResults.map(m=><GridCard key={m.id} movie={m} onTap={setDetail}/>)}
                  </div>
                </>
            }
          </div>
        ) : (
          <>
            {/* Full-bleed Telefin-style Hero */}
            {heroList.length > 0
              ? <Hero
                  movies={heroList}
                  onPlay={setDetail}
                  onSearch={()=>setShowSearch(true)}
                  onBookmark={()=>setShowBookmarks(true)}
                  user={state.user}
                />
              : /* Skeleton — always show while loading, even before TMDB enrichment */
                <div style={{
                  width:'100%', height:'58vh', minHeight:'320px',
                  background:'linear-gradient(135deg,#1a1a2e,#0f3460)',
                  position:'relative', overflow:'hidden',
                  display:'flex', flexDirection:'column',
                  justifyContent:'flex-end', padding:'20px',
                  boxSizing:'border-box',
                }}>
                  {/* Shimmer overlay */}
                  <div style={{
                    position:'absolute', inset:0,
                    background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.04) 50%,transparent 100%)',
                    animation:'shimmer 2s infinite',
                  }}/>
                  <div style={{width:'55%',height:'24px',background:'rgba(255,255,255,0.12)',borderRadius:'6px',marginBottom:'14px'}}/>
                  <div style={{width:'120px',height:'38px',background:'rgba(255,255,255,0.1)',borderRadius:'20px'}}/>
                </div>
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
                <LandscapeRow icon="🆕" title="Recently Added" movies={recent} onTap={setDetail}
                  onViewAll={()=>setViewAll({title:'Recently Added',movies:recent})}/>
                {topRated.length>0 && (
                  <LandscapeRow icon="⭐" title="Top Rated" movies={topRated} onTap={setDetail}
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

      {/* Refresh button (floating, only on main view) */}
      {!showSearch && (
        <button onClick={()=>load(true)} style={{
          position:'absolute', bottom:'80px', right:'16px', zIndex:20,
          width:'40px', height:'40px', borderRadius:'12px',
          background:'white', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 2px 12px rgba(0,0,0,0.15)',
        }}>
          <RefreshCw size={16} color="#3478f6"
            style={{animation:loading?'spin 1s linear infinite':'none'}}/>
        </button>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}
