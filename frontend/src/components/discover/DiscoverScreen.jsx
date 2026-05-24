import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Star, ChevronRight, RefreshCw, Film, Tv } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import { groupMovies } from '../../utils/movieParser';
import { searchMovie, posterUrl, backdropUrl, getRating, MOVIE_GENRES, TV_GENRES } from '../../utils/tmdb';

const AIR_MOVIES_CHANNEL = '-1003930241514';

// ── Enrich a group with TMDB data ─────────────────────────────────────────────
async function enrichGroup(group) {
  const tmdb = await searchMovie(group.title, group.year, group.isSeries);
  const genres = group.isSeries ? TV_GENRES : MOVIE_GENRES;
  return {
    ...group,
    tmdb,
    poster: posterUrl(tmdb?.poster_path),
    backdrop: backdropUrl(tmdb?.backdrop_path),
    rating: getRating(tmdb),
    overview: tmdb?.overview || '',
    genreIds: tmdb?.genre_ids || [],
    genreNames: (tmdb?.genre_ids || []).slice(0, 2).map(id => genres[id]).filter(Boolean),
  };
}

// ── Hero banner ───────────────────────────────────────────────────────────────
function HeroBanner({ movies, onPlay }) {
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (movies.length < 2) return;
    timer.current = setInterval(() => setIdx(i => (i + 1) % movies.length), 5000);
    return () => clearInterval(timer.current);
  }, [movies.length]);

  if (!movies.length) return null;
  const m = movies[idx];

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: '#111' }}>
      {/* Backdrop */}
      {m.backdrop ? (
        <img src={m.backdrop} alt={m.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1a1a2e,#16213e)' }} />
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.85) 100%)',
      }} />

      {/* Content */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <span style={{
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            color: 'white', fontSize: '10px', fontWeight: '700', padding: '2px 8px',
            borderRadius: '5px', letterSpacing: '0.5px',
          }}>
            {m.isSeries ? 'SERIES' : 'MOVIE'}
          </span>
          {m.rating && (
            <span style={{
              background: '#e91e8c', color: 'white',
              fontSize: '10px', fontWeight: '700', padding: '2px 8px',
              borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '3px',
            }}>
              <Star size={9} fill="white" /> {m.rating}
            </span>
          )}
        </div>

        <h2 style={{ color: 'white', fontWeight: '800', fontSize: '22px', margin: '0 0 4px',
                     textShadow: '0 2px 8px rgba(0,0,0,0.5)', lineHeight: '1.2' }}>
          {m.title}
        </h2>

        {m.year && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '0 0 6px' }}>
          {m.year} {m.genreNames.length ? '· ' + m.genreNames.join(' · ') : ''}
        </p>}

        {m.overview ? (
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', margin: '0 0 12px',
                      lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {m.overview}
          </p>
        ) : null}

        <button onClick={() => onPlay(m)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(8px)',
          color: 'white', border: 'none', borderRadius: '24px',
          padding: '10px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
        }}>
          <Play size={16} fill="white" /> Watch
        </button>
      </div>

      {/* Dot indicators */}
      {movies.length > 1 && (
        <div style={{ position: 'absolute', bottom: '8px', right: '16px',
                      display: 'flex', gap: '5px' }}>
          {movies.slice(0, 5).map((_, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{
              width: i === idx ? '18px' : '6px', height: '6px',
              borderRadius: '3px', background: i === idx ? 'white' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer', transition: 'all 0.3s',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Movie poster card ─────────────────────────────────────────────────────────
function MovieCard({ movie, onTap }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button onClick={() => onTap(movie)} style={{
      flexShrink: 0, width: '120px', background: 'none',
      border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
    }}>
      {/* Poster */}
      <div style={{
        width: '120px', height: '178px', borderRadius: '12px', overflow: 'hidden',
        background: '#1c1c2e', position: 'relative', marginBottom: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}>
        {movie.poster && !imgFailed ? (
          <img src={movie.poster} alt={movie.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgFailed(true)} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg,#1a1a2e,#2d2d44)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px',
          }}>
            {movie.isSeries ? <Tv size={28} color="#5856d6" /> : <Film size={28} color="#3478f6" />}
            <p style={{ color: 'white', fontSize: '11px', fontWeight: '600',
                        textAlign: 'center', lineHeight: '1.3', margin: 0 }}>
              {movie.title}
            </p>
          </div>
        )}

        {/* Type badge */}
        <div style={{
          position: 'absolute', top: '6px', left: '6px',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          color: 'white', fontSize: '9px', fontWeight: '700',
          padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.3px',
        }}>
          {movie.isSeries ? 'TV' : 'MOVIE'}
        </div>

        {/* Rating badge */}
        {movie.rating && (
          <div style={{
            position: 'absolute', top: '6px', right: '6px',
            background: '#e91e8c', color: 'white',
            fontSize: '9px', fontWeight: '700',
            padding: '2px 6px', borderRadius: '4px',
            display: 'flex', alignItems: 'center', gap: '2px',
          }}>
            <Star size={8} fill="white" /> {movie.rating}
          </div>
        )}

        {/* Quality badges */}
        {movie.qualities?.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '6px', left: '6px',
            display: 'flex', gap: '3px', flexWrap: 'wrap',
          }}>
            {movie.qualities.slice(0, 2).map(q => (
              <span key={q} style={{
                background: 'rgba(0,0,0,0.75)', color: '#4ade80',
                fontSize: '8px', fontWeight: '700',
                padding: '1px 5px', borderRadius: '3px',
              }}>{q}</span>
            ))}
          </div>
        )}
      </div>

      {/* Title */}
      <p style={{
        fontSize: '12px', fontWeight: '600', color: '#1c1c1e',
        margin: 0, lineHeight: '1.3',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {movie.title}
      </p>
      {movie.year && (
        <p style={{ fontSize: '11px', color: '#8e8e93', margin: '2px 0 0' }}>
          {movie.year}
        </p>
      )}
    </button>
  );
}

// ── Horizontal row ────────────────────────────────────────────────────────────
function MovieRow({ title, icon, movies, onTap, onViewAll }) {
  if (!movies.length) return null;
  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Row header */}
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
          background: '#f2f2f7', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '6px 12px', borderRadius: '20px',
          fontSize: '12px', fontWeight: '600', color: '#3478f6',
        }}>
          View All <ChevronRight size={13} />
        </button>
      </div>

      {/* Horizontal scroll */}
      <div style={{
        display: 'flex', gap: '12px', overflowX: 'auto',
        padding: '4px 16px 8px', scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {movies.map(m => (
          <MovieCard key={m.id} movie={m} onTap={onTap} />
        ))}
      </div>
    </div>
  );
}

// ── Quality picker sheet ──────────────────────────────────────────────────────
function QualitySheet({ movie, source, onClose }) {
  const backendBase = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');

  function play(file) {
    const streamUrl = api.streamUrl(source, file.channel_id, file.msg_id);
    window.open(
      `${backendBase}/player?url=${encodeURIComponent(streamUrl)}&name=${encodeURIComponent(file.name)}&id=${encodeURIComponent(file.id)}`,
      '_blank'
    );
    onClose();
  }

  const sorted = [...movie.versions].sort((a, b) => b.qualityRank - a.qualityRank);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: '20px 20px 0 0', width: '100%',
        padding: '16px 16px calc(env(safe-area-inset-bottom,0px)+16px)',
        maxHeight: '70vh', overflowY: 'auto',
      }}>
        <div style={{ width: '36px', height: '4px', background: '#e5e5ea', borderRadius: '2px', margin: '0 auto 14px' }} />

        {/* Movie info */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {movie.poster && (
            <img src={movie.poster} alt={movie.title}
              style={{ width: '56px', height: '84px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div>
            <p style={{ fontWeight: '700', fontSize: '16px', color: '#1c1c1e', margin: '0 0 4px' }}>{movie.title}</p>
            <p style={{ fontSize: '13px', color: '#8e8e93', margin: '0 0 6px' }}>
              {movie.year} {movie.isSeries ? '· Series' : '· Movie'}
            </p>
            {movie.rating && (
              <span style={{
                background: '#e91e8c', color: 'white', fontSize: '11px',
                fontWeight: '700', padding: '2px 8px', borderRadius: '5px',
                display: 'inline-flex', alignItems: 'center', gap: '3px',
              }}>
                <Star size={10} fill="white" /> {movie.rating}
              </span>
            )}
          </div>
        </div>

        <p style={{ fontWeight: '600', fontSize: '13px', color: '#8e8e93', margin: '0 0 10px' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: i === 0 ? '#3478f615' : '#e5e5ea',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Play size={16} color={i === 0 ? '#3478f6' : '#8e8e93'} fill={i === 0 ? '#3478f6' : '#8e8e93'} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: '700', fontSize: '14px',
                            color: i === 0 ? '#3478f6' : '#1c1c1e', margin: 0 }}>
                  {v.quality ? v.quality.toUpperCase() : 'Standard'}
                  {i === 0 ? ' · Best' : ''}
                </p>
                <p style={{ fontSize: '11px', color: '#8e8e93', margin: '1px 0 0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: '220px' }}>
                  {v.name.replace(/\.[^.]+$/, '')}
                </p>
              </div>
            </div>
            {v.size > 0 && (
              <span style={{ fontSize: '11px', color: '#8e8e93', flexShrink: 0 }}>
                {(v.size / 1e9).toFixed(1)} GB
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── All movies grid ───────────────────────────────────────────────────────────
function AllMoviesGrid({ movies, title, onBack, onTap }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7', overflow: 'hidden' }}>
      <div style={{ padding: '50px 16px 12px', background: '#f2f2f7', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{
            width: '36px', height: '36px', borderRadius: '10px', background: 'white',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flexShrink: 0,
          }}>
            <ChevronRight size={18} color="#3478f6" style={{ transform: 'rotate(180deg)' }} />
          </button>
          <h2 style={{ fontWeight: '700', fontSize: '18px', color: '#1c1c1e', margin: 0 }}>{title}</h2>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 100px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
        }}>
          {movies.map(m => (
            <button key={m.id} onClick={() => onTap(m)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
            }}>
              <div style={{
                width: '100%', paddingTop: '150%', position: 'relative',
                borderRadius: '12px', overflow: 'hidden', background: '#1c1c2e',
                marginBottom: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}>
                {m.poster ? (
                  <img src={m.poster} alt={m.title}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg,#1a1a2e,#2d2d44)',
                  }}>
                    <Film size={24} color="#3478f6" />
                  </div>
                )}
                {m.rating && (
                  <div style={{
                    position: 'absolute', top: '5px', right: '5px',
                    background: '#e91e8c', color: 'white', fontSize: '9px', fontWeight: '700',
                    padding: '2px 5px', borderRadius: '4px',
                    display: 'flex', alignItems: 'center', gap: '2px',
                  }}>
                    <Star size={7} fill="white" /> {m.rating}
                  </div>
                )}
              </div>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#1c1c1e', margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.title}
              </p>
              <p style={{ fontSize: '10px', color: '#8e8e93', margin: '1px 0 0' }}>{m.year}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Discover Screen ──────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const { state } = useApp();
  const [allMovies, setAllMovies] = useState([]); // enriched groups
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [viewAll, setViewAll] = useState(null); // {title, movies}
  const enrichedRef = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getChannelFiles(AIR_MOVIES_CHANNEL, 'video');
      const files = res.files || [];
      const groups = groupMovies(files);

      // Enrich in batches of 5 to avoid rate limits
      const enriched = [];
      for (let i = 0; i < groups.length; i += 5) {
        const batch = groups.slice(i, i + 5);
        const results = await Promise.all(batch.map(g => enrichGroup(g)));
        enriched.push(...results);
        // Update UI progressively
        setAllMovies([...enriched]);
        if (i + 5 < groups.length) await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) {
      console.error('Discover load error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  if (!state.isLoggedIn) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7',
                    alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <Film size={48} color="#3478f6" style={{ marginBottom: '16px' }} />
        <p style={{ fontWeight: '700', fontSize: '18px', color: '#1c1c1e', margin: '0 0 8px' }}>
          AirMovies
        </p>
        <p style={{ fontSize: '14px', color: '#8e8e93', textAlign: 'center', lineHeight: '1.5' }}>
          Sign in to browse movies and series
        </p>
      </div>
    );
  }

  if (viewAll) {
    return (
      <AllMoviesGrid
        movies={viewAll.movies}
        title={viewAll.title}
        onBack={() => setViewAll(null)}
        onTap={setSelectedMovie}
      />
    );
  }

  // Categorize
  const movies  = allMovies.filter(m => !m.isSeries);
  const series  = allMovies.filter(m => m.isSeries);
  const recent  = [...allMovies].sort((a, b) => b.date - a.date).slice(0, 15);
  const heroMovies = recent.filter(m => m.backdrop).slice(0, 5);
  const topRated = [...allMovies].filter(m => m.rating).sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, 15);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '50px 16px 12px',
        background: 'linear-gradient(to bottom, rgba(242,242,247,0.95), transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '24px', fontWeight: '800', color: '#1c1c1e' }}>Discover</span>
        <button onClick={load} style={{
          width: '36px', height: '36px', borderRadius: '10px', background: 'white',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          <RefreshCw size={15} color="#3478f6"
            style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: '100px' }}>

        {/* Hero banner */}
        {heroMovies.length > 0 && (
          <div style={{ marginTop: '88px' }}>
            <HeroBanner movies={heroMovies} onPlay={setSelectedMovie} />
          </div>
        )}

        {loading && allMovies.length === 0 ? (
          // Skeleton
          <div style={{ padding: '24px 16px' }}>
            {[1,2,3].map(row => (
              <div key={row} style={{ marginBottom: '28px' }}>
                <div style={{ height: '20px', width: '140px', background: '#e5e5ea', borderRadius: '8px', marginBottom: '14px' }} />
                <div style={{ display: 'flex', gap: '12px', overflowX: 'hidden' }}>
                  {[1,2,3].map(i => (
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
          <div style={{ paddingTop: heroMovies.length ? '16px' : '100px' }}>
            <MovieRow title="Recently Added" icon="🆕"
              movies={recent} onTap={setSelectedMovie}
              onViewAll={() => setViewAll({ title: 'Recently Added', movies: recent })} />
            {topRated.length > 0 && (
              <MovieRow title="Top Rated" icon="⭐"
                movies={topRated} onTap={setSelectedMovie}
                onViewAll={() => setViewAll({ title: 'Top Rated', movies: topRated })} />
            )}
            {movies.length > 0 && (
              <MovieRow title="Movies" icon="🎬"
                movies={movies} onTap={setSelectedMovie}
                onViewAll={() => setViewAll({ title: 'Movies', movies })} />
            )}
            {series.length > 0 && (
              <MovieRow title="Series" icon="📺"
                movies={series} onTap={setSelectedMovie}
                onViewAll={() => setViewAll({ title: 'Series', movies: series })} />
            )}
          </div>
        )}
      </div>

      {/* Quality picker */}
      {selectedMovie && (
        <QualitySheet
          movie={selectedMovie}
          source="discover"
          onClose={() => setSelectedMovie(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
