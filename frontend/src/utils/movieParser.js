/**
 * Robust movie filename parser
 * Handles patterns like:
 * "Sky Force (2024) Web-Rip ORG [Hindi DD 5.1] 1080p"
 * "Viduthalai Part 2 2024 UNCUT Web Rip ORG Hindi Tamil 1080p"
 * "The Leopard (2025) Season 01 Complete ORG [Hindi - English] 720p HEVC"
 * "Khakee: The Bengal Chapter 2024 Web-Rip Hindi 1080p"
 */

// Noise words to strip after extracting title
const NOISE = [
  /\bWEB[-\s]?RIP\b/gi, /\bWEB[-\s]?DL\b/gi, /\bBluRay\b/gi, /\bBRRip\b/gi,
  /\bHDCAM\b/gi, /\bDVDRip\b/gi, /\bHDRip\b/gi, /\bVODRip\b/gi,
  /\bORG\b/gi, /\bUNCUT\b/gi, /\bEXTENDED\b/gi, /\bDIRECTOR'?S CUT\b/gi,
  /\bHINDI\b/gi, /\bENGLISH\b/gi, /\bTAMIL\b/gi, /\bTELUGU\b/gi,
  /\bMALAYALAM\b/gi, /\bKANNADA\b/gi, /\bMARATHI\b/gi, /\bBENGALI\b/gi,
  /\bDUAL AUDIO\b/gi, /\bDUAL\b/gi, /\bMULTI\b/gi,
  /\bDD[\s]?[25]\.[01]\b/gi, /\bAAC\b/gi, /\bHEVC\b/gi, /\bX265\b/gi, /\bX264\b/gi,
  /\bHDR\b/gi, /\b10BIT\b/gi, /\bDC\b(?!\s*Comics)/gi,
  /\bCOMPLETE\b/gi, /\bPACK\b/gi,
  /\[.*?\]/g,   // anything in square brackets
  /\((?!\d{4})[^)]*\)/g, // parens that don't contain a year
];

function isJunk(title) {
  if (!title || title.length < 2) return true;
  if (/^[a-f0-9]{12,}$/i.test(title)) return true; // hex hash
  if (/^file_\d+$/.test(title)) return true;
  if (/^\d+$/.test(title)) return true;
  if (!/[a-zA-Z]/.test(title)) return true;
  return false;
}

export function parseMovieFile(filename) {
  let name = filename
    .replace(/\.[a-zA-Z0-9]{2,4}$/, '') // remove extension
    .replace(/_/g, ' ')                   // underscores → spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Extract year — in parens first, then standalone
  const yearParens = name.match(/\((\d{4})\)/);
  const yearPlain  = name.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearParens ? yearParens[1] : (yearPlain ? yearPlain[1] : null);

  // Extract season
  const seasonMatch = name.match(/\b(?:Season|S)[\s._-]*(\d{1,2})\b/i);
  const season = seasonMatch ? parseInt(seasonMatch[1]) : null;
  const isSeries = !!season;

  // Extract quality
  const qualityMatch = name.match(/\b(2160p|4K|1080p|720p|480p|360p)\b/i);
  const quality = qualityMatch ? qualityMatch[1].replace(/4K/i, '2160p').toLowerCase() : null;

  // Is sample?
  const isSample = /\bsample\b/i.test(name);

  // Cut title at first noise anchor
  let title = name;

  // Priority cut points (in order)
  const cuts = [
    yearParens  ? yearParens.index  : Infinity,
    yearPlain   ? yearPlain.index   : Infinity,
    seasonMatch ? seasonMatch.index : Infinity,
    qualityMatch ? qualityMatch.index : Infinity,
    // Also cut at Web-Rip, Blu-ray etc. that appear before year
    ...['Web-Rip','Web Rip','WebRip','BluRay','HDCAM','DVDRip','BRRip','UNCUT'].map(kw => {
      const i = name.toLowerCase().indexOf(kw.toLowerCase());
      return i > 0 ? i : Infinity;
    }),
  ];
  const cutAt = Math.min(...cuts);
  if (cutAt < Infinity) title = name.slice(0, cutAt).trim();

  // Strip trailing noise
  title = title.replace(/[-:.\s]+$/, '').trim();

  // Remove noise phrases from title
  for (const p of NOISE) title = title.replace(p, ' ');
  title = title.replace(/\s+/g, ' ').replace(/[-:.\s]+$/, '').trim();

  const qualityRank = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1, '360p': 0 };

  return {
    title,
    year,
    season,
    isSeries,
    quality,
    isSample,
    qualityRank: qualityRank[quality?.toLowerCase()] ?? -1,
    isValid: !isJunk(title) && title.length >= 2,
  };
}

export function groupMovies(files) {
  const groups = {};

  for (const file of files) {
    const info = parseMovieFile(file.name);
    if (!info.isValid || info.isSample) continue;

    const titleKey = info.title.toLowerCase().replace(/\s+/g, ' ').trim();
    const key = `${titleKey}__${info.year || 'unknown'}`;

    if (!groups[key]) {
      groups[key] = {
        id: key,
        title: info.title,
        year: info.year,
        isSeries: info.isSeries,
        versions: [],
        date: file.date || 0,
      };
    } else {
      // Keep the title with most proper casing
      const ec = (groups[key].title.match(/[A-Z]/g) || []).length;
      const nc = (info.title.match(/[A-Z]/g) || []).length;
      if (nc > ec) groups[key].title = info.title;
    }

    groups[key].versions.push({ ...file, ...info });
    if ((file.date || 0) > groups[key].date) groups[key].date = file.date;
  }

  for (const g of Object.values(groups)) {
    g.versions.sort((a, b) => b.qualityRank - a.qualityRank);
    g.bestFile = g.versions[0];
    g.qualities = [...new Set(g.versions.map(v => v.quality).filter(Boolean))];
  }

  return Object.values(groups)
    .filter(g => g.versions.length > 0)
    .sort((a, b) => b.date - a.date);
}
