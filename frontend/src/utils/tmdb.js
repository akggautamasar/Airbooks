/**
 * TMDB API — free public key, no signup needed for basic usage
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG  = 'https://image.tmdb.org/t/p';
// Free read-only API key from TMDB public docs
const API_KEY   = 'b8dee0f07efec7ce8e2d4af73182c58e';

const cache = {};

export async function searchTMDB(title, year, isSeries = false) {
  const cacheKey = `${title}|${year}|${isSeries}`;
  if (cache[cacheKey] !== undefined) return cache[cacheKey];

  const type = isSeries ? 'tv' : 'movie';

  async function doSearch(withYear) {
    const q = encodeURIComponent(title);
    const yr = withYear && year
      ? (isSeries ? `&first_air_date_year=${year}` : `&year=${year}`)
      : '';
    const url = `${TMDB_BASE}/search/${type}?api_key=${API_KEY}&query=${q}${yr}&language=en-US&page=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] || null;
  }

  try {
    // Try with year first, then without
    let result = await doSearch(true);
    if (!result && year) result = await doSearch(false);
    // If still nothing and it might be a series, try the other type
    if (!result) {
      const altType = isSeries ? 'movie' : 'tv';
      const url = `${TMDB_BASE}/search/${altType}?api_key=${API_KEY}&query=${encodeURIComponent(title)}&language=en-US&page=1`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        result = data.results?.[0] || null;
      }
    }
    cache[cacheKey] = result;
    return result;
  } catch {
    cache[cacheKey] = null;
    return null;
  }
}

export const posterUrl = (path, size = 'w342') =>
  path ? `${TMDB_IMG}/${size}${path}` : null;

export const backdropUrl = (path, size = 'w780') =>
  path ? `${TMDB_IMG}/${size}${path}` : null;

export const getRating = (tmdb) => {
  const r = tmdb?.vote_average;
  return r && r > 0 ? r.toFixed(1) : null;
};

export const MOVIE_GENRES = {
  28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',
  99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',
  27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Sci-Fi',
  53:'Thriller',10752:'War',37:'Western',
};
export const TV_GENRES = {
  10759:'Action',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',
  18:'Drama',10751:'Family',10762:'Kids',9648:'Mystery',10765:'Sci-Fi',37:'Western',
};
