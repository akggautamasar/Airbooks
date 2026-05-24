import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Play, Star, ChevronRight, RefreshCw, Film, Tv, Search, X, ArrowLeft } from 'lucide-react';
import { api } from '../../utils/api';
import { groupMovies } from '../../utils/movieParser';
import { searchTMDB, posterUrl, backdropUrl, getRating, MOVIE_GENRES, TV_GENRES } from '../../utils/tmdb';

const AIR_MOVIES_ID = '-1003930241514';

// Gradient colors for poster fallbacks
const GRAD_COLORS = [
  ['#1a1a2e','#e94560'],['#0f3460','#533483'],['#1b262c','#0f4c75'],
  ['#2d132c','#ee4540'],['#151515','#3d5a80'],['#1c1c1e','#30b0c7'],
  ['#0a3d62','#38ada9'],['#2c003e','#7b2d8b'],['#1a1a2e','#4a00e0'],
  ['#0d0d0d','#870000'],
];

function gradientFor(id) {
  const idx = Math.abs(id?.split('').reduce((a, c) => a + c.charCodeAt(0), 0) || 0) % GRAD_COLORS.length;
  return GRAD_COLORS[idx];
}

// ── Enrich group with TMDB ─────────────────────────────────────────────────
async function enrich(group) {
  const tmdb = await searchTMDB(group.title, group.year, group.isSeries);
  const gmap = group.isSeries ? TV_GENRES : MOVIE_GENRES;
  return {
    ...group,
    tmdb,
    poster:   posterUrl(tmdb?.poster_path, 'w342'),
    backdrop: backdropUrl(tmdb?.backdrop_path, 'w780'),
    rating:   getRating(tmdb),
    overview: tmdb?.overview || '',
    genres:   (tmdb?.genre_ids || []).slice(0, 2).map(id => gmap[id]).filter(Boolean),
  };
}

// ── Poster card ────────────────────────────────────────────────────────────
function PosterCard({ movie, onTap, width = 120 }) {
  const [failed, setFailed] = useState(false);
  const [g1, g2] = gradientFor(movie.id);
  const height = Math.round(width * 1.5);

  return (
    <button onClick={() => onTap(movie)} style={{
      flexShrink: 0, width, background: 'none',
      border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
    }}>
      <div style={{
        width, height, borderRadius: '12px', overflow: 'hidden',
        background: `linear-gradient(135deg,${g1},${g2})`,
        position: 'relative', marginBottom: '7px',
        boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
      }}>
        {movie.poster && !failed ? (
          <img src={movie.poster} alt={movie.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setFailed(true)} />
        ) : (
          // Colorful fallback
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '12px', gap: '8px',
          }}>
            {movie.isSeries
              ? <Tv size={28} color="rgba(255,255,255,0.6)" />
              : <Film size={28} color="rgba(255,255,255,0.6)" />}
            <p style={{
              color: 'white', fontSize: '12px', fontWeight: '700',
              textAlign: 'center', lineHeight: '1.3', margin: 0,
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{movie.title}</p>
          </div>
        )}
        {/* Type badge */}
        <div style={{
          position: 'absolute', top: '6px', left: '6px',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          color: 'white', fontSize: '9px', fontWeight: '700',
          padding: '2px 6px', borderRadius: '4px',
        }}>
          {movie.isSeries ? 'TV' : 'MOVIE'}
        </div>
        {/* Rating */}
        {movie.rating && (
          <div style={{
            position: 'absolute', top: '6px', right: '6px',
            background: '#e91e8c', color: 'white',
            fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
            display: 'flex', alignItems: 'center', gap: '2px',
          }}>
            <Star size={8} fill="white" strokeWidth={0} /> {movie.rating}
          </div>
        )}
        {/* Quality */}
        {movie.qualities?.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '6px', left: '6px', display: 'flex', gap: '3px',
          }}>
            {movie.qualities.slice(0, 2).map(q => (
              <span key={q} style={{
                background: 'rgba(0,0,0,0.75)', color: '#4ade80',
                fontSize: '8px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px',
              }}>{q}</span>
            ))}
          </div>
        )}
      </div>
      <p style={{
        fontSize: '12px', fontWeight: '600', color: '#1c1c1e', margin: '0 0 2px',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        lineHeight: '1.3',
      }}>{movie.title}</p>
      {movie.year && <p style={{ fontSize: '11px', color: '#8e8e93', margin: 0 }}>{movie.year}</p>}
    </button>
  );
}

// ── Hero banner ────────────────────────────────────────────────────────────
function Hero({ movies, onPlay }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (movies.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % movies.length), 5000);
    return () => clearInterval(t);
  }, [movies.length]);
  if (!movies.length) return null;
  const m = movies[idx];
  const [g1, g2] = gradientFor(m.id);

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}>
      {m.backdrop ? (
        <img src={m.backdrop} alt={m.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg,${g1},${g2})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Film size={48} color="rgba(255,255,255,0.3)" />
        </div>
      )}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom,rgba(0,0,0,0.05) 0%,rgba(0,0,0,0.75) 100%)',
      }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
          <span style={{
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(6px)',
            color: 'white', fontSize: '10px', fontWeight: '700',
            padding: '2px 8px', borderRadius: '5px',
          }}>{m.isSeries ? 'SERIES' : 'MOVIE'}</span>
          {m.rating && (
            <span style={{
              background: '#e91e8c', color: 'white',
              fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '5px',
              display: 'flex', alignItems: 'center', gap: '3px',
            }}>
              <Star size={9} fill="white" strokeWidth={0} /> {m.rating}
            </span>
          )}
        </div>
        <h2 style={{ color: 'white', fontWeight: '800', fontSize: '20px', margin: '0 0 4px',
                     textShadow: '0 2px 8px rgba(0,0,0,0.5)', lineHeight: '1.2' }}>
          {m.title}
        </h2>
        {m.year && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '0 0 4px' }}>
          {m.year}{m.genres.length ? ' · ' + m.genres.join(' · ') : ''}
        </p>}
        {m.overview && <p style={{
          color: 'rgba(255,255,255,0.8)', fontSize: '11px', margin: '0 0 10px',
          lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{m.overview}</p>}
        <button onClick={() => onPlay(m)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(8px)',
          color: 'white', border: 'none', borderRadius: '24px',
          padding: '10px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
        }}>
          <Play size={15} fill="white" strokeWidth={0} /> Watch
        </button>
      </div>
      {movies.length > 1 && (
        <div style={{ position: 'absolute', bottom: '10px', right: '14px', display: 'flex', gap: '5px' }}>
          {movies.slice(0, 6).map((_, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{
              width: i === idx ? '18px' : '6px', height: '6px', borderRadius: '3px',
              background: i === idx ? 'white' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer', transition: 'width 0.3s',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Horizontal row ─────────────────────────────────────────────────────────
function Row({ icon, title, movies, onTap, onViewAll }) {
  if (!movies.length) return null;
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 16px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '16px' }}>{icon}</span>
          </div>
          <span style={{ fontSize: '17px', fontWeight: '700', color: '#1c1c1e' }}>{title}</span>
        </div>
        <button onClick={onViewAll} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '2px',
          fontSize: '13px', fontWeight: '600', color: '#3478f6', padding: '4px 8px',
        }}>
          View All <ChevronRight size={14} />
        </button>
      </div>
      <div style={{
        display: 'flex', gap: '12px', overflowX: 'auto',
        padding: '2px 16px 8px', scrollbarWidth: 'none',
      }}>
        {movies.slice(0, 15).map(m => <PosterCard key={m.id} movie={m} onTap={onTap} />)}
      </div>
    </div>
  );
}

// ── Grid view (View All) ───────────────────────────────────────────────────
function GridView({ title, movies, onBack, onTap }) {
  const [search, setSearch] = useState('');
  const filtered = movies.filter(m =>
    !search || m.title.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7', overflow: 'hidden' }}>
      <div style={{ padding: '50px 16px 10px', background: '#f2f2f7', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <button onClick={onBack} style={{
            width: '36px', height: '36px', borderRadius: '10px', background: 'white',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flexShrink: 0,
          }}><ArrowLeft size={18} color="#3478f6" /></button>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1c1c1e', margin: 0, flex: 1 }}>{title}</h2>
          <span style={{ fontSize: '13px', color: '#8e8e93' }}>{filtered.length}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} color="#8e8e93" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{
              width: '100%', boxSizing: 'border-box', background: 'white', border: 'none',
              borderRadius: '12px', padding: '10px 12px 10px 34px', fontSize: '14px',
              color: '#1c1c1e', outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {filtered.map(m => <PosterCard key={m.id} movie={m} onTap={onTap} width="100%" />)}
        </div>
      </div>
    </div>
  );
}

// ── Quality sheet ──────────────────────────────────────────────────────────
function QualitySheet({ movie, onClose }) {
  const backendBase = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
  const [g1, g2] = gradientFor(movie.id);

  function play(file) {
    const streamUrl = api.streamUrl('user', file.channel_id, file.msg_id);
    window.open(
      `${backendBase}/player?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(file.name)}&id=${encodeURIComponent(file.id)}`,
      '_blank'
    );
    onClose();
  }

  const sorted = [...(movie.versions || [])].sort((a, b) => b.qualityRank - a.qualityRank);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: '20px 20px 0 0', width: '100%',
        padding: '16px 16px calc(env(safe-area-inset-bottom,0px)+16px)',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ width: '36px', height: '4px', background: '#e5e5ea', borderRadius: '2px', margin: '0 auto 16px' }} />

        {/* Movie header */}
        <div style={{ display: 'flex', gap: '14px', marginBottom: '18px', alignItems: 'flex-start' }}>
          <div style={{
            width: '60px', height: '90px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0,
            background: `linear-gradient(135deg,${g1},${g2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {movie.poster
              ? <img src={movie.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Film size={24} color="rgba(255,255,255,0.6)" />}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: '800', fontSize: '17px', color: '#1c1c1e', margin: '0 0 4px', lineHeight: '1.2' }}>
              {movie.title}
            </p>
            <p style={{ fontSize: '13px', color: '#8e8e93', margin: '0 0 6px' }}>
              {movie.year}{movie.isSeries ? ' · Series' : ' · Movie'}
              {movie.genres?.length ? ' · ' + movie.genres[0] : ''}
            </p>
            {movie.rating && (
              <span style={{
                background: '#e91e8c', color: 'white', fontSize: '11px', fontWeight: '700',
                padding: '3px 8px', borderRadius: '6px',
                display: 'inline-flex', alignItems: 'center', gap: '3px',
              }}>
                <Star size={10} fill="white" strokeWidth={0} /> {movie.rating}
              </span>
            )}
          </div>
        </div>

        {movie.overview ? (
          <p style={{ fontSize: '13px', color: '#636366', lineHeight: '1.5', margin: '0 0 16px',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {movie.overview}
          </p>
        ) : null}

        <p style={{ fontWeight: '700', fontSize: '12px', color: '#8e8e93', margin: '0 0 10px', letterSpacing: '0.5px' }}>
          SELECT QUALITY
        </p>

        {sorted.map((v, i) => (
          <button key={i} onClick={() => play(v)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '13px 14px',
            background: i === 0 ? '#e8f0ff' : '#f2f2f7',
            border: i === 0 ? '1.5px solid #3478f640' : '1.5px solid transparent',
            borderRadius: '14px', cursor: 'pointer', marginBottom: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: i === 0 ? '#3478f620' : '#e5e5ea',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Play size={16} color={i === 0 ? '#3478f6' : '#8e8e93'} fill={i === 0 ? '#3478f6' : '#8e8e93'} strokeWidth={0} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: '700', fontSize: '14px', color: i === 0 ? '#3478f6' : '#1c1c1e', margin: 0 }}>
                  {v.quality ? v.quality.toUpperCase() : 'Standard'}{i === 0 ? '  ✦ Best' : ''}
                </p>
                <p style={{ fontSize: '11px', color: '#8e8e93', margin: '2px 0 0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                  {v.name?.replace(/\.[^.]+$/, '')}
                </p>
              </div>
            </div>
            {v.size > 0 && (
              <span style={{ fontSize: '12px', color: '#8e8e93', fontWeight: '600', flexShrink: 0 }}>
                {(v.size / 1e9).toFixed(1)} GB
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const [all, setAll]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [viewAll, setViewAll]   = useState(null);
  const [search, setSearch]     = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getChannelFiles(AIR_MOVIES_ID, 'video');
      const files = res.files || [];
      const groups = groupMovies(files);
      const enriched = [];
      // Enrich in batches of 6
      for (let i = 0; i < groups.length; i += 6) {
        const batch = groups.slice(i, i + 6);
        const results = await Promise.all(batch.map(enrich));
        enriched.push(...results);
        setAll([...enriched]);
        if (i + 6 < groups.length) await new Promise(r => setTimeout(r, 250));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const movies  = useMemo(() => all.filter(m => !m.isSeries), [all]);
  const series  = useMemo(() => all.filter(m => m.isSeries), [all]);
  const recent  = useMemo(() => [...all].sort((a, b) => b.date - a.date).slice(0, 20), [all]);
  const topRated = useMemo(() => [...all].filter(m => m.rating).sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, 20), [all]);
  const heroList = useMemo(() => recent.filter(m => m.backdrop).slice(0, 6), [recent]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return all.filter(m =>
      m.title.toLowerCase().includes(q) ||
      (m.year || '').includes(q) ||
      (m.genres || []).some(g => g.toLowerCase().includes(q))
    );
  }, [all, search]);

  if (viewAll) {
    return <GridView title={viewAll.title} movies={viewAll.movies}
                     onBack={() => setViewAll(null)} onTap={setSelected} />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7', overflow: 'hidden' }}>

      {/* Floating header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        padding: '48px 16px 10px',
        background: showSearch ? '#f2f2f7' : 'linear-gradient(to bottom,rgba(242,242,247,0.95),rgba(242,242,247,0))',
      }}>
        {showSearch ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} color="#8e8e93" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search movies & series..."
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'white', border: 'none',
                  borderRadius: '12px', padding: '11px 12px 11px 34px', fontSize: '14px',
                  color: '#1c1c1e', outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }} />
              {search && (
                <button onClick={() => setSearch('')} style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}>
                  <X size={14} color="#8e8e93" />
                </button>
              )}
            </div>
            <button onClick={() => { setShowSearch(false); setSearch(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                       fontSize: '14px', fontWeight: '600', color: '#3478f6', whiteSpace: 'nowrap' }}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '24px', fontWeight: '800', color: '#1c1c1e' }}>Discover</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowSearch(true)} style={{
                width: '36px', height: '36px', borderRadius: '10px', background: 'white',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              }}><Search size={15} color="#3478f6" /></button>
              <button onClick={load} style={{
                width: '36px', height: '36px', borderRadius: '10px', background: 'white',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              }}>
                <RefreshCw size={15} color="#3478f6"
                  style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: '100px' }}>

        {/* Search results */}
        {showSearch && search ? (
          <div style={{ paddingTop: '110px', padding: '110px 12px 20px' }}>
            {searchResults.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#8e8e93', padding: '40px', fontSize: '15px' }}>
                No results for "{search}"
              </p>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: '#8e8e93', margin: '0 4px 12px', fontWeight: '500' }}>
                  {searchResults.length} results
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {searchResults.map(m => <PosterCard key={m.id} movie={m} onTap={setSelected} width="100%" />)}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Hero */}
            <div style={{ marginTop: '88px' }}>
              {heroList.length > 0
                ? <Hero movies={heroList} onPlay={setSelected} />
                : loading && all.length === 0
                  ? <div style={{ width: '100%', aspectRatio: '16/9', background: 'linear-gradient(135deg,#1a1a2e,#0f3460)' }} />
                  : null}
            </div>

            {/* Loading skeleton */}
            {loading && all.length === 0 ? (
              <div style={{ padding: '20px 16px' }}>
                {[0,1,2].map(r => (
                  <div key={r} style={{ marginBottom: '24px' }}>
                    <div style={{ height: '18px', width: '120px', background: '#e5e5ea', borderRadius: '6px', marginBottom: '12px' }} />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ flexShrink: 0, width: '120px' }}>
                          <div style={{ width: '120px', height: '178px', background: '#e5e5ea', borderRadius: '12px', marginBottom: '8px' }} />
                          <div style={{ height: '12px', background: '#e5e5ea', borderRadius: '4px' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ paddingTop: '16px' }}>
                <Row icon="🆕" title="Recently Added" movies={recent} onTap={setSelected}
                  onViewAll={() => setViewAll({ title: 'Recently Added', movies: recent })} />
                {topRated.length > 0 && (
                  <Row icon="⭐" title="Top Rated" movies={topRated} onTap={setSelected}
                    onViewAll={() => setViewAll({ title: 'Top Rated', movies: topRated })} />
                )}
                {movies.length > 0 && (
                  <Row icon="🎬" title="Movies" movies={movies} onTap={setSelected}
                    onViewAll={() => setViewAll({ title: 'Movies', movies })} />
                )}
                {series.length > 0 && (
                  <Row icon="📺" title="Series" movies={series} onTap={setSelected}
                    onViewAll={() => setViewAll({ title: 'Series', movies: series })} />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selected && <QualitySheet movie={selected} onClose={() => setSelected(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
