/**
 * Parse movie/series info from Telegram filenames like:
 * "Sky Force (2024) Web-Rip ORG [Hindi DD 5.1] 1080p"
 * "The Leopard (2025) Season 01 Complete ORG [Hindi - English] 720p HEVC"
 */

export function parseMovieFile(filename) {
  const name = filename.replace(/\.[^.]+$/, ''); // remove extension

  // Extract year
  const yearMatch = name.match(/\((\d{4})\)/);
  const year = yearMatch ? yearMatch[1] : null;

  // Extract season (series detection)
  const seasonMatch = name.match(/Season\s*(\d+)/i);
  const season = seasonMatch ? parseInt(seasonMatch[1]) : null;
  const isSeries = !!season;

  // Extract quality
  const qualityMatch = name.match(/\b(2160p|1080p|720p|480p|360p)\b/i);
  const quality = qualityMatch ? qualityMatch[1].toLowerCase() : null;

  // Is sample?
  const isSample = /sample/i.test(name);

  // Extract title — everything before (year) or Season
  let title = name;
  if (yearMatch) title = name.slice(0, yearMatch.index).trim();
  else if (seasonMatch) title = name.slice(0, seasonMatch.index).trim();
  // Clean up
  title = title.replace(/[-_]+$/, '').trim();

  // Quality rank for sorting (higher = better)
  const qualityRank = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1, '360p': 0 };

  return { title, year, season, isSeries, quality, isSample,
           qualityRank: qualityRank[quality] ?? -1 };
}

export function groupMovies(files) {
  const groups = {};

  for (const file of files) {
    const info = parseMovieFile(file.name);
    if (!info.title || info.isSample) continue;

    // Group key: title + year
    const key = `${info.title}__${info.year || 'unknown'}`;

    if (!groups[key]) {
      groups[key] = {
        id: key,
        title: info.title,
        year: info.year,
        isSeries: info.isSeries,
        versions: [],
        date: file.date,
      };
    }

    groups[key].versions.push({ ...file, ...info });
    // Use latest date
    if (file.date > groups[key].date) groups[key].date = file.date;
  }

  // For each group, sort versions by quality desc and pick best
  for (const g of Object.values(groups)) {
    g.versions.sort((a, b) => b.qualityRank - a.qualityRank);
    g.bestFile = g.versions[0]; // highest quality
    g.qualities = [...new Set(g.versions.map(v => v.quality).filter(Boolean))];
  }

  return Object.values(groups).sort((a, b) => b.date - a.date);
}
