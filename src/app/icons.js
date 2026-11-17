/** 内联 SVG 图标（24×24，描边风格）。 */
const P = {
  upload: '<path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4.5 17 5-5 3.5 3.5 3-3 4 4"/>',
  crop: '<path d="M6.5 2v15.5a1 1 0 0 0 1 1H22"/><path d="M2 6.5h15.5a1 1 0 0 1 1 1V22"/>',
  type: '<path d="M5 6V4.5h14V6"/><path d="M12 4.5V20"/><path d="M9 20h6"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-.9 2-1.8 0-1.6-1.6-1.7-1.6-3 0-1.2 1-2.2 2.4-2.2H17a4.5 4.5 0 0 0 4.5-4.5C21.1 5.6 17 3 12 3Z"/><circle cx="7.6" cy="10.4" r="1.1"/><circle cx="11" cy="7.4" r="1.1"/><circle cx="15.4" cy="8.4" r="1.1"/>',
  gauge: '<path d="M4 14a8 8 0 1 1 16 0"/><path d="m12 14 3.5-4.5"/><path d="M4 18h16"/>',
  archive: '<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5"/><path d="M10 12.5h4"/>',
  download: '<path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2"/>',
  trash: '<path d="M4.5 6.5h15"/><path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 15 0 0 1 15 5v1.5"/><path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5"/><path d="M10 10.5v6M14 10.5v6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sparkles: '<path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7Z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.2-2.8 7.4-7 9-4.2-1.6-7-4.8-7-9V6Z"/><path d="m9 11.8 2.2 2.2 4-4.2"/>',
  zap: '<path d="M13 3 5 13.5h5.5L10.5 21 19 10h-5.5Z"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m4.5 13.5 7.5 4.2 7.5-4.2"/><path d="m4.5 17.5 7.5 4.2 7.5-4.2"/>',
  file: '<path d="M13.5 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8Z"/><path d="M13.5 3v5h5"/>',
  sliders: '<path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h9M18 18h1"/><circle cx="16" cy="6" r="1.8"/><circle cx="10" cy="12" r="1.8"/><circle cx="16" cy="18" r="1.8"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 9.5v4.5"/><path d="M12 17.2v.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>',
  package: '<path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9Z"/><path d="m3.7 7.4 8.4 4.6 8.4-4.6"/><path d="M12 12v9"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  contrast: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none"/>',
  folder: '<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
  compare: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15"/>',
  minus: '<path d="M5 12h14"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 19V7a1.5 1.5 0 0 1 1.5-1.5h5"/>',
}

export const ICONS = P

export function icon(name, size = 18, strokeWidth = 1.8) {
  const body = P[name] || P.image
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
}
