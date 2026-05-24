/**
 * Parse movie/series info from Telegram filenames like:
 * "Sky Force (2024) Web-Rip ORG [Hindi DD 5.1] 1080p"
 * "The Leopard (2025) Season 01 Complete ORG [Hindi - English] 720p HEVC"
 */

// Words/patterns that indicate it's NOT a movie title
const JUNK_PATTERNS = [
  /^[a-f0-9]{16,}$/i,          // hex hashes like "2080ef5c1f44411ba6bb"
  /^file_\d+$/i,                // "file_12345"
  /^\d+$/,                      // pure numbers
  /^[^a-zA-Z]+$/,               // no letters at all
];

function isJunkTitle(title) {
  if (!title || title.length < 2) return true;
  for (const p of JUNK_PATTERNS) {
    if (p.test(title.trim())) return true;
  }
  return false;
}

export function parseMovieFile(filename) {
  // Remove extension
  let name = filename.replace(/\.[a-zA-Z0-9]{2,4}$/, '').trim();

  // Replace underscores/dots used as spaces (common in filenames)
  // But keep dots inside titles like "S.W.A.T"
  // Replace only sequences of underscores
  name = name.replace(/_/g, ' ');

  // Extract year (4 digits in parens OR standalone)
  const yearInParens = name.match(/\((\d{4})\)/);
  const yearStandalone = name.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearInParens ? yearInParens[1] : (yearStandalone ? yearStandalone[1] : null);

  // Extract season
  const seasonMatch = name.match(/\b(?:Season|S)[\s._-]*(\d{1,2})\b/i);
  const season = seasonMatch ? parseInt(seasonMatch[1]) : null;
  const isSeries = !!season;

  // Extract quality
  const qualityMatch = name.match(/\b(2160p|4K|1080p|720p|480p|360p)\b/i);
  const quality = qualityMatch ? qualityMatch[1].replace(/4K/i, '2160p').toLowerCase() : null;

  // Is sample?
  const isSample = /\bsample\b/i.test(name);

  // Extract title — everything before (year) or Season or quality keywords
  let title = name;

  // Cut at year in parens
  if (yearInParens) {
    title = name.slice(0, yearInParens.index).trim();
  } else if (seasonMatch) {
    title = name.slice(0, seasonMatch.index).trim();
  } else if (qualityMatch) {
    title = name.slice(0, qualityMatch.index).trim();
  } else if (yearStandalone) {
    title = name.slice(0, yearStandalone.index).trim();
  }

  // Clean up title
  title = title
    .replace(/[-_.]+$/, '')           // trailing separators
    .replace(/\s+/g, ' ')             // multiple spaces
    .replace(/^\s*[\[\(].*/, '')      // starts with bracket
    .trim();

  // Remove trailing quality/source tags
  title = title.replace(/\s*(Web.?Rip|BluRay|WEB-DL|HDCAM|DVDRip|BRRip|HQ|ORG|Dual\.Audio)\s*$/i, '').trim();

  const qualityRank = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1, '360p': 0 };

  return {
    title,
    year,
    season,
    isSeries,
    quality,
    isSample,
    qualityRank: qualityRank[quality?.toLowerCase()] ?? -1,
    isValid: !isJunkTitle(title),
  };
}

export function groupMovies(files) {
  const groups = {};

  for (const file of files) {
    const info = parseMovieFile(file.name);

    // Skip junk, samples
    if (!info.isValid || info.isSample) continue;

    // Normalize title for grouping (lowercase, no extra spaces)
    const titleKey = info.title.toLowerCase().replace(/\s+/g, ' ').trim();
    const key = `${titleKey}__${info.year || 'unknown'}`;

    if (!groups[key]) {
      groups[key] = {
        id: key,
        title: info.title, // Keep original casing
        year: info.year,
        isSeries: info.isSeries,
        versions: [],
        date: file.date || 0,
      };
    } else {
      // Prefer title casing that looks more "proper" (more capitals = better)
      const existingCaps = (groups[key].title.match(/[A-Z]/g) || []).length;
      const newCaps = (info.title.match(/[A-Z]/g) || []).length;
      if (newCaps > existingCaps) groups[key].title = info.title;
    }

    groups[key].versions.push({ ...file, ...info });
    if ((file.date || 0) > groups[key].date) groups[key].date = file.date;
  }

  // Sort versions by quality, pick best
  for (const g of Object.values(groups)) {
    g.versions.sort((a, b) => b.qualityRank - a.qualityRank);
    g.bestFile = g.versions[0];
    g.qualities = [...new Set(g.versions.map(v => v.quality).filter(Boolean))];
  }

  // Sort groups by date desc (newest first)
  return Object.values(groups)
    .filter(g => g.versions.length > 0)
    .sort((a, b) => b.date - a.date);
}
