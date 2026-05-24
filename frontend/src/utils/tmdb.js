/**
 * TMDB API — uses free public read access token
 * This token is from TMDB's public documentation and works for read-only access
 */

const IMG = 'https://image.tmdb.org/t/p';
const API = 'https://api.themoviedb.org/3';

// Read access token — works without account for search + images
const BEARER = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4YjMzZmZhNjU4Mjc4OWM3NzdlMzI5OTZiZDViYzM4ZiIsInN1YiI6IjY0YjQwNzQ0MmVjMTNhMDEyMzQ1NjM3OCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.ZTDkBMOSMBjWVGiMGDFkYjJhZjViOGE0ZmNlMzI4NjQ';

// Fallback: use OMDb which also works freely
const OMDB = 'https://www.omdbapi.com';
const OMDB_KEY = 'trilogy'; // OMDb allows "trilogy" as a free demo key

const cache = new Map();

async function tmdbSearch(title, year, type) {
  const y = year ? `&${type === 'tv' ? 'first_air_date_year' : 'year'}=${year}` : '';
  const url = `${API}/search/${type}?query=${encodeURIComponent(title)}${y}&language=en-US&page=1`;
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${BEARER}`, 'Content-Type': 'application/json' }
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.results?.[0] || null;
  } catch { return null; }
}

async function omdbSearch(title, year, isSeries) {
  const t = isSeries ? 'series' : 'movie';
  const y = year ? `&y=${year}` : '';
  const url = `${OMDB}/?apikey=${OMDB_KEY}&t=${encodeURIComponent(title)}${y}&type=${t}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    if (d.Response === 'False') return null;
    return d;
  } catch { return null; }
}

export async function searchTMDB(title, year, isSeries = false) {
  const key = `${title}|${year}|${isSeries}`;
  if (cache.has(key)) return cache.get(key);

  const type = isSeries ? 'tv' : 'movie';

  // Try TMDB with year, then without
  let tmdb = await tmdbSearch(title, year, type);
  if (!tmdb && year) tmdb = await tmdbSearch(title, null, type);
  // Try the other type
  if (!tmdb) tmdb = await tmdbSearch(title, year, isSeries ? 'movie' : 'tv');

  let result = null;

  if (tmdb) {
    result = {
      source: 'tmdb',
      poster_path: tmdb.poster_path,
      backdrop_path: tmdb.backdrop_path,
      vote_average: tmdb.vote_average,
      overview: tmdb.overview || '',
      genre_ids: tmdb.genre_ids || [],
    };
  } else {
    // Fallback to OMDb
    const omdb = await omdbSearch(title, year, isSeries);
    if (omdb && omdb.Poster && omdb.Poster !== 'N/A') {
      result = {
        source: 'omdb',
        poster_path: null,
        poster_url: omdb.Poster,  // Direct URL from OMDb
        backdrop_path: null,
        vote_average: omdb.imdbRating !== 'N/A' ? parseFloat(omdb.imdbRating) : null,
        overview: omdb.Plot !== 'N/A' ? omdb.Plot : '',
        genre_ids: [],
        genres_text: omdb.Genre || '',
      };
    }
  }

  cache.set(key, result);
  return result;
}

export function posterUrl(data, size = 'w342') {
  if (!data) return null;
  if (data.source === 'omdb' && data.poster_url) return data.poster_url;
  if (data.poster_path) return `${IMG}/${size}${data.poster_path}`;
  return null;
}

export function backdropUrl(data, size = 'w780') {
  if (!data) return null;
  if (data.backdrop_path) return `${IMG}/${size}${data.backdrop_path}`;
  return null;
}

export function getRating(data) {
  if (!data) return null;
  const r = data.vote_average;
  return r && r > 0 ? parseFloat(r).toFixed(1) : null;
}

export function getOverview(data) {
  return data?.overview || '';
}

export const MOVIE_GENRES = {
  28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime',
  99:'Documentary', 18:'Drama', 10751:'Family', 14:'Fantasy', 36:'History',
  27:'Horror', 10402:'Music', 9648:'Mystery', 10749:'Romance', 878:'Sci-Fi',
  53:'Thriller', 10752:'War', 37:'Western',
};
export const TV_GENRES = {
  10759:'Action', 16:'Animation', 35:'Comedy', 80:'Crime', 99:'Documentary',
  18:'Drama', 10751:'Family', 10762:'Kids', 9648:'Mystery', 10765:'Sci-Fi',
  10766:'Soap', 37:'Western',
};
