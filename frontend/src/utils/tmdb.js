/**
 * TMDB API - uses free public API key
 * Get your free key at: https://www.themoviedb.org/settings/api
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG  = 'https://image.tmdb.org/t/p';
const API_KEY   = '8b33ffa6582789c777e32996bd5bc38f'; // Free public key

const cache = {};

export async function searchMovie(title, year, isSeries = false) {
  const cacheKey = `${title}_${year}_${isSeries}`;
  if (cache[cacheKey] !== undefined) return cache[cacheKey];

  try {
    const type = isSeries ? 'tv' : 'movie';
    const q = encodeURIComponent(title);
    const yearParam = year ? (isSeries ? `&first_air_date_year=${year}` : `&year=${year}`) : '';
    const url = `${TMDB_BASE}/search/${type}?api_key=${API_KEY}&query=${q}${yearParam}&language=en-US&page=1`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('TMDB error');
    const data = await res.json();
    const result = data.results?.[0] || null;
    cache[cacheKey] = result;
    return result;
  } catch {
    // Retry without year if no results
    try {
      const type = isSeries ? 'tv' : 'movie';
      const url = `${TMDB_BASE}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(title)}&language=en-US&page=1`;
      const res = await fetch(url);
      const data = await res.json();
      const result = data.results?.[0] || null;
      cache[cacheKey] = result;
      return result;
    } catch {
      cache[cacheKey] = null;
      return null;
    }
  }
}

export function posterUrl(path, size = 'w342') {
  if (!path) return null;
  return `${TMDB_IMG}/${size}${path}`;
}

export function backdropUrl(path, size = 'w780') {
  if (!path) return null;
  return `${TMDB_IMG}/${size}${path}`;
}

export function getRating(tmdb) {
  if (!tmdb) return null;
  const r = tmdb.vote_average;
  return r && r > 0 ? r.toFixed(1) : null;
}

export const MOVIE_GENRES = {
  28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',
  99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',
  27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Sci-Fi',
  53:'Thriller',10752:'War',37:'Western',
};
export const TV_GENRES = {
  10759:'Action',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',
  18:'Drama',10751:'Family',10762:'Kids',9648:'Mystery',10765:'Sci-Fi',
  10766:'Soap',10767:'Talk',37:'Western',
};
