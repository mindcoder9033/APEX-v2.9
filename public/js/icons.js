/**
 * APEX Pit-Wall Telemetry - Technical Iconography System
 * Minimalist, motorsport-grade vector SVG icons (1.5px stroke, clean geometry).
 */

const ICONS = {
  // Navigation & Core Systems
  'flag': `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>`,
  'map': `<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line>`,
  'trophy': `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>`,
  'zap': `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>`,
  'layout': `<rect x="3" y="3" width="18" height="18" rx="1"></rect><path d="M3 9h18"></path><path d="M9 21V9"></path>`,
  'settings': `<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>`,

  // Motorsport & Telemetry Specific
  'target': `<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>`,
  'crosshair': `<circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line>`,
  'arc': `<path d="M3 21 A18 18 0 0 1 21 3"></path><path d="M15 3h6v6"></path><circle cx="12" cy="12" r="2"></circle>`,
  'balance': `<circle cx="12" cy="12" r="9"></circle><path d="M12 3v18"></path><path d="M3 12h18"></path><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3"></circle>`,
  'brake': `<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4"></circle><path d="M4 8l3 2"></path><path d="M4 16l3-2"></path><path d="M20 8l-3 2"></path><path d="M20 16l-3-2"></path>`,
  'gauge': `<path d="M12 2v2"></path><path d="M5.64 5.64l1.41 1.41"></path><path d="M18.36 5.64l-1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M4.93 19.07A10 10 0 1 1 19.07 19.07"></path><path d="M12 12l4-4"></path>`,
  'car': `<path d="M5 17h14v-4l-2-6H7L5 13v4z"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="16.5" cy="17.5" r="2.5"></circle><path d="M7 11h10"></path>`,
  'pin': `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>`,
  'rocket': `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 9V4s3.03.55 4 2c1.08 1.62 0 5 0 5"></path>`,
  'book': `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>`,
  'clipboard': `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 12h6"></path><path d="M9 16h6"></path>`,
  'lock': `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`,
  'droplet': `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>`,

  // Alerts, Hazards & Feedback
  'alert': `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>`,
  'alert-octagon': `<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>`,
  'check': `<polyline points="20 6 9 17 4 12"></polyline>`,
  'check-circle': `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>`,
  'info': `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>`,
  'lightbulb': `<line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path>`,
  'refresh': `<polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>`,

  // Actions & Files
  'search': `<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>`,
  'download': `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>`,
  'file-text': `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>`,
  'trend-up': `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>`,
  'trend-down': `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>`,
  'layer': `<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>`,
  'shield': `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>`,
  'play': `<polygon points="5 3 19 12 5 21 5 3"></polygon>`,
  'clock': `<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>`,
  'loader': `<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>`
};

/**
 * Mapping legacy / emoji strings to minimal vector icons
 */
const EMOJI_TO_ICON_MAP = {
  '🏁': 'flag',
  '🗺️': 'map',
  '🏆': 'trophy',
  '⚡': 'zap',
  '📐': 'arc',
  '⚙️': 'settings',
  '🎯': 'target',
  '🏎️': 'car',
  '📍': 'pin',
  '📖': 'book',
  '📚': 'book',
  '📋': 'clipboard',
  '🔒': 'lock',
  '🚀': 'rocket',
  '💧': 'droplet',
  '⚠️': 'alert',
  '🛑': 'alert-octagon',
  '✅': 'check-circle',
  '✓': 'check',
  '🔍': 'search',
  '📄': 'file-text',
  '📥': 'download',
  '💡': 'lightbulb',
  '🧠': 'target',
  '🔄': 'refresh',
  '🔁': 'refresh',
  '📈': 'trend-up',
  '📉': 'trend-down',
  '⚖️': 'balance',
  '⏳': 'clock',
  '⌛': 'clock',
  'ℹ️': 'info'
};

/**
 * Generates an inline SVG string for the specified icon key
 * @param {string} name - Icon identifier (e.g. 'flag', 'zap', 'target' or mapped emoji)
 * @param {object} options - Sizing, class, stroke, and color options
 * @returns {string} SVG HTML markup
 */
export function getIcon(name, options = {}) {
  if (!name) return '';
  
  // Resolve mapped emoji or normalized name
  const resolvedKey = EMOJI_TO_ICON_MAP[name] || String(name).toLowerCase().trim();
  const iconPath = ICONS[resolvedKey] || ICONS['zap']; // Graceful fallback
  
  const size = options.size || 14;
  const strokeWidth = options.strokeWidth || 1.6;
  const className = options.className ? `apex-icon ${options.className}` : 'apex-icon';
  const color = options.color || 'currentColor';
  const style = options.style ? ` style="${options.style}"` : '';
  
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${style} aria-hidden="true">${iconPath}</svg>`;
}

// Global browser window availability
if (typeof window !== 'undefined') {
  window.APEX_ICONS = ICONS;
  window.getIcon = getIcon;
}
