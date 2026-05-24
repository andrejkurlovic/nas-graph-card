/**
 * NAS Graph Card for Home Assistant
 * Supports QNAP and Synology — themes: standard | futuristic | frosted
 * https://github.com/andrejkurlovic/nas-graph-card
 */

const VERSION = '1.0.0';
const MAX_HISTORY = 30;

// ── Metric colour palette ───────────────────────────────────────────────────
const C = {
  cpu:         { label: '#a78bfa', spark: '#8b5cf6', fill: 'rgba(139,92,246,0.35)'  },
  memory:      { label: '#38bdf8', spark: '#06b6d4', fill: 'rgba(6,182,212,0.35)'   },
  temperature: { label: '#fb923c', spark: '#f97316', fill: 'rgba(249,115,22,0.35)'  },
  network_in:  { label: '#4ade80', spark: '#22c55e', fill: 'rgba(34,197,94,0.35)'   },
  network_out: { label: '#fbbf24', spark: '#f59e0b', fill: 'rgba(245,158,11,0.35)'  },
  disk_read:   { label: '#c084fc', spark: '#a855f7', fill: 'rgba(168,85,247,0.35)'  },
  disk_write:  { label: '#f472b6', spark: '#ec4899', fill: 'rgba(236,72,153,0.35)'  },
};

// ── Unique ID counter for SVG defs ──────────────────────────────────────────
let _uid = 0;
const uid = () => `n${++_uid}`;

// ── Sparkline SVG ───────────────────────────────────────────────────────────
function sparkSVG(data, strokeColor, w = 200, h = 36) {
  const id = uid();
  if (!data || data.length < 2) {
    const y = h / 2;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${strokeColor}" stroke-width="1.5" stroke-opacity="0.3"/>
    </svg>`;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - pad - ((v - min) / range) * (h - pad * 2),
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `M ${pts[0][0].toFixed(1)},${h} ` +
    pts.map(([x, y]) => `L ${x.toFixed(1)},${y.toFixed(1)}`).join(' ') +
    ` L ${pts[pts.length - 1][0].toFixed(1)},${h} Z`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#${id})"/>
    <polyline points="${line}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// ── Arc helper ──────────────────────────────────────────────────────────────
function arcD(cx, cy, r, startDeg, endDeg) {
  const clamp = endDeg >= startDeg + 360 ? startDeg + 359.9 : endDeg;
  const s = (startDeg * Math.PI) / 180;
  const e = (clamp * Math.PI) / 180;
  const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
  const large = (clamp - startDeg) % 360 > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// ── Circular gauge SVG (futuristic) ─────────────────────────────────────────
function gaugeSVG(pct, color, label, valStr, size = 108) {
  const cx = size / 2, cy = size / 2, r = size * 0.37;
  const sw = size * 0.055;
  const gid = uid();
  const START = 135, SWEEP = 270;
  const bgPath = arcD(cx, cy, r, START, START + SWEEP);
  const fgPath = pct > 0.01 ? arcD(cx, cy, r, START, START + SWEEP * Math.min(pct, 1)) : null;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="${gid}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path d="${bgPath}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${sw}" stroke-linecap="round"/>
    ${fgPath ? `<path d="${fgPath}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" filter="url(#${gid})"/>` : ''}
    <text x="${cx}" y="${cy - 3}" text-anchor="middle" fill="${color}" font-size="${Math.round(size * 0.1)}" font-family="var(--primary-font-family,sans-serif)" opacity="0.9">${label}</text>
    <text x="${cx}" y="${cy + Math.round(size * 0.145)}" text-anchor="middle" fill="white" font-size="${Math.round(size * 0.175)}" font-family="var(--primary-font-family,sans-serif)" font-weight="700">${valStr}</text>
  </svg>`;
}

// ── NAS icons ───────────────────────────────────────────────────────────────
const ICON_QNAP = `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="5" y="8" width="36" height="30" rx="4" fill="#162030" stroke="#2a4055" stroke-width="1.3"/>
  <rect x="9" y="13" width="28" height="4.5" rx="1.5" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
  <rect x="9" y="20.5" width="28" height="4.5" rx="1.5" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
  <rect x="9" y="28" width="28" height="4.5" rx="1.5" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
  <circle cx="34" cy="15.25" r="1.6" fill="#06b6d4"/>
  <circle cx="34" cy="22.75" r="1.6" fill="#06b6d4"/>
  <circle cx="34" cy="30.25" r="1.6" fill="#3a4a5c"/>
</svg>`;

const ICON_SYNOLOGY = `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="5" width="30" height="36" rx="4" fill="#152030" stroke="#283d55" stroke-width="1.3"/>
  <rect x="12" y="10" width="22" height="3.8" rx="1.3" fill="#1d3048" stroke="#344d68" stroke-width="0.7"/>
  <rect x="12" y="16.5" width="22" height="3.8" rx="1.3" fill="#1d3048" stroke="#344d68" stroke-width="0.7"/>
  <rect x="12" y="23" width="22" height="3.8" rx="1.3" fill="#1d3048" stroke="#344d68" stroke-width="0.7"/>
  <rect x="12" y="29.5" width="22" height="3.8" rx="1.3" fill="#1d3048" stroke="#344d68" stroke-width="0.7"/>
  <circle cx="14.5" cy="11.9" r="1.1" fill="#22c55e"/>
  <circle cx="14.5" cy="18.4" r="1.1" fill="#22c55e"/>
  <circle cx="14.5" cy="24.9" r="1.1" fill="#22c55e"/>
  <circle cx="14.5" cy="31.4" r="1.1" fill="#3a4a5c"/>
</svg>`;

// ── Main card class ─────────────────────────────────────────────────────────
class NasGraphCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._history = {};
    this._config  = {};
    this._hass    = null;
  }

  static getStubConfig() {
    return {
      type: 'custom:nas-graph-card',
      name: 'My NAS',
      brand: 'qnap',
      theme: 'standard',
      frosted_glass: false,
      entities: {
        status:       'binary_sensor.nas_online',
        cpu:          'sensor.nas_cpu_usage',
        memory:       'sensor.nas_memory_usage',
        temperature:  'sensor.nas_system_temp',
        network_in:   'sensor.nas_network_in',
        network_out:  'sensor.nas_network_out',
        disk_read:    'sensor.nas_disk_read',
        disk_write:   'sensor.nas_disk_write',
        disks_total:  'sensor.nas_disks_total',
        disks_healthy:'sensor.nas_disks_healthy',
        storage_free: 'sensor.nas_storage_free',
        uptime:       'sensor.nas_uptime',
      },
    };
  }

  setConfig(config) {
    if (!config.entities) throw new Error('NAS Graph Card: `entities` is required');
    this._config = {
      theme:        'standard',
      name:         'NAS',
      brand:        'qnap',
      frosted_glass: false,
      max_cpu:      100,
      max_memory:   100,
      max_temp:     80,
      ...config,
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._pushHistory();
    this._render();
  }

  // ── History tracking ──────────────────────────────────────────────────────
  _pushHistory() {
    ['cpu','memory','temperature','network_in','network_out','disk_read','disk_write'].forEach(k => {
      const id = this._config.entities?.[k];
      if (!id) return;
      const st = this._hass.states[id];
      if (!st) return;
      const v = parseFloat(st.state);
      if (isNaN(v)) return;
      if (!this._history[k]) this._history[k] = [];
      const h = this._history[k];
      if (!h.length || h[h.length - 1] !== v) {
        h.push(v);
        if (h.length > MAX_HISTORY) h.shift();
      }
    });
  }

  // ── State helpers ─────────────────────────────────────────────────────────
  _state(key, fallback = 'N/A') {
    const id = this._config.entities?.[key];
    if (!id) return fallback;
    const s = this._hass?.states[id]?.state;
    return (!s || s === 'unavailable' || s === 'unknown') ? fallback : s;
  }

  _unit(key) {
    const id = this._config.entities?.[key];
    return this._hass?.states[id]?.attributes?.unit_of_measurement ?? '';
  }

  _isOnline() {
    const id = this._config.entities?.status;
    if (!id) return true;
    return this._hass?.states[id]?.state === 'on';
  }

  // ── Format helpers ────────────────────────────────────────────────────────
  _fmtFlow(key) {
    const raw = this._state(key, '0');
    const v   = parseFloat(raw);
    if (isNaN(v)) return raw;
    const u = this._unit(key);
    if (u === 'MB/s') return `${v.toFixed(1)} MB/s`;
    if (u === 'KB/s') return `${v >= 100 ? Math.round(v) : v.toFixed(1)} KB/s`;
    if (u === 'GB/s') return `${v.toFixed(2)} GB/s`;
    if (u === 'B/s' || u === 'bytes/s') {
      if (v >= 1_048_576) return `${(v / 1_048_576).toFixed(1)} MB/s`;
      if (v >= 1_024)    return `${(v / 1_024).toFixed(1)} KB/s`;
      return `${v} B/s`;
    }
    return `${v.toFixed(1)}${u ? ' ' + u : ''}`;
  }

  _fmtUptime() {
    const raw = this._state('uptime', '?');
    if (raw === '?' || raw === 'N/A') return raw;
    const v = parseFloat(raw);
    if (isNaN(v)) return raw;
    const d = Math.floor(v / 86400);
    const h = Math.floor((v % 86400) / 3600);
    const m = Math.floor((v % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  _render() {
    const cfg  = this._config;
    const theme = cfg.theme || 'standard';
    const isFuturistic = theme === 'futuristic';
    const isFrosted    = cfg.frosted_glass || theme === 'frosted';
    const brand  = (cfg.brand || 'qnap').toLowerCase();
    const online = this._isOnline();

    // ── Theme palette ──────────────────────────────────────────────────────
    let cardBg, tileBg, cardExtra = '', tileBorder = '';

    if (isFuturistic && isFrosted) {
      cardBg    = 'var(--ha-card-background, rgba(5, 8, 25, 0.55))';
      tileBg    = 'rgba(18, 28, 70, 0.55)';
      cardExtra = 'backdrop-filter:blur(24px) saturate(200%);-webkit-backdrop-filter:blur(24px) saturate(200%);border:1px solid rgba(100,120,255,0.22);';
      tileBorder= 'border:1px solid rgba(100,120,255,0.15);';
    } else if (isFrosted) {
      cardBg    = 'var(--ha-card-background, rgba(14, 20, 42, 0.45))';
      tileBg    = 'rgba(255,255,255,0.07)';
      cardExtra = 'backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);border:1px solid rgba(255,255,255,0.13);';
      tileBorder= 'border:1px solid rgba(255,255,255,0.1);';
    } else if (isFuturistic) {
      cardBg    = '#050816';
      tileBg    = '#0a0f28';
      cardExtra = 'border:1px solid rgba(80,100,200,0.2);box-shadow:0 0 60px rgba(50,80,200,0.1),0 8px 40px rgba(0,0,0,0.7);';
      tileBorder= 'border:1px solid rgba(60,80,180,0.18);';
    } else {
      cardBg = '#0d1524';
      tileBg = '#162030';
    }

    // ── Values ─────────────────────────────────────────────────────────────
    const cpuV  = parseFloat(this._state('cpu',  '0')) || 0;
    const memV  = parseFloat(this._state('memory','0')) || 0;
    const tmpV  = parseFloat(this._state('temperature','0')) || 0;

    const diskTotal   = this._state('disks_total',   '?');
    const diskHealthy = this._state('disks_healthy',  diskTotal);
    const storageFree = this._state('storage_free',  '?');
    const storageUnit = this._unit('storage_free');

    const icon = brand === 'synology' ? ICON_SYNOLOGY : ICON_QNAP;

    // ── Top 3 tiles ────────────────────────────────────────────────────────
    const topTiles = isFuturistic
      ? [
          this._gaugeTile(cpuV, cfg.max_cpu, C.cpu, 'CPU', '%', 'cpu', tileBg, tileBorder),
          this._gaugeTile(memV, cfg.max_memory, C.memory, 'Memory', '%', 'memory', tileBg, tileBorder),
          this._gaugeTile(tmpV, cfg.max_temp, C.temperature, 'Sys Temp', '°C', 'temperature', tileBg, tileBorder),
        ].join('')
      : [
          this._stdTile('CPU', cpuV, '%', C.cpu, 'cpu', tileBg, tileBorder, isFuturistic),
          this._stdTile('Memory', memV, '%', C.memory, 'memory', tileBg, tileBorder, isFuturistic),
          this._stdTile('System Temp', tmpV, '°C', C.temperature, 'temperature', tileBg, tileBorder, isFuturistic),
        ].join('');

    // ── Mid 4 tiles ────────────────────────────────────────────────────────
    const midTiles = [
      this._flowTile('Net In',    this._fmtFlow('network_in'),  C.network_in,  'network_in',  tileBg, tileBorder, isFuturistic),
      this._flowTile('Net Out',   this._fmtFlow('network_out'), C.network_out, 'network_out', tileBg, tileBorder, isFuturistic),
      this._flowTile('Disk Read', this._fmtFlow('disk_read'),   C.disk_read,   'disk_read',   tileBg, tileBorder, isFuturistic),
      this._flowTile('Disk Write',this._fmtFlow('disk_write'),  C.disk_write,  'disk_write',  tileBg, tileBorder, isFuturistic),
    ].join('');

    // ── Arrow colour ───────────────────────────────────────────────────────
    const arrowStyle = isFuturistic
      ? `color:${C.cpu.spark};text-shadow:0 0 10px ${C.cpu.spark},0 0 20px ${C.cpu.spark};`
      : 'color:rgba(255,255,255,0.3);';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        ha-card { background:transparent!important; box-shadow:none!important; border:none!important; }

        .card {
          background: ${cardBg};
          ${cardExtra}
          border-radius: 16px;
          padding: 16px;
          color: #fff;
          font-family: var(--primary-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif);
        }

        /* ── Header ── */
        .hdr { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
        .hdr-text { flex:1; min-width:0; }
        .hdr-name {
          font-size:22px; font-weight:700; letter-spacing:.3px;
          ${isFuturistic ? 'text-shadow:0 0 20px rgba(180,200,255,0.35);' : ''}
        }
        .hdr-status { display:flex; align-items:center; gap:6px; font-size:12px; color:rgba(255,255,255,0.5); margin-top:3px; }
        .dot {
          width:8px; height:8px; border-radius:50%;
          background:${online ? '#22c55e' : '#ef4444'};
          ${isFuturistic && online ? 'box-shadow:0 0 7px #22c55e,0 0 14px rgba(34,197,94,0.35);' : ''}
        }
        .menu-btn {
          background:none; border:none; color:rgba(255,255,255,0.4);
          font-size:20px; cursor:pointer; padding:4px 8px; border-radius:6px; line-height:1; flex-shrink:0;
        }
        .menu-btn:hover { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.75); }

        /* ── Grids ── */
        .top-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:10px; }
        .mid-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:10px; }

        /* ── Bottom row ── */
        .bot-row {
          display:flex; align-items:center;
          background:${tileBg}; ${tileBorder}
          border-radius:12px; padding:10px 14px;
        }
        .bot-item { flex:1; display:flex; align-items:center; gap:9px; }
        .bot-item+.bot-item { border-left:1px solid rgba(255,255,255,0.07); padding-left:12px; }
        .bot-ico { font-size:22px; opacity:.65; flex-shrink:0; }
        .bot-lbl { font-size:10px; color:rgba(255,255,255,0.45); text-transform:uppercase; letter-spacing:.4px; }
        .bot-val { font-size:14px; font-weight:700; line-height:1.3; }
        .bot-sub { font-size:10px; color:rgba(255,255,255,0.38); }
        .arrow { flex-shrink:0; font-size:22px; padding:2px 0 2px 6px; cursor:pointer; user-select:none; ${arrowStyle} }
      </style>

      <ha-card>
        <div class="card">
          <div class="hdr">
            ${icon}
            <div class="hdr-text">
              <div class="hdr-name">${cfg.name || 'NAS'}</div>
              <div class="hdr-status"><div class="dot"></div><span>${online ? 'Online' : 'Offline'}</span></div>
            </div>
            <button class="menu-btn" title="Options">⋮</button>
          </div>

          <div class="top-grid">${topTiles}</div>
          <div class="mid-grid">${midTiles}</div>

          <div class="bot-row">
            <div class="bot-item">
              <span class="bot-ico">💿</span>
              <div>
                <div class="bot-lbl">Disks</div>
                <div class="bot-val">${diskHealthy} / ${diskTotal}</div>
                <div class="bot-sub">Healthy</div>
              </div>
            </div>
            <div class="bot-item">
              <span class="bot-ico">🗄️</span>
              <div>
                <div class="bot-lbl">Storage</div>
                <div class="bot-val">${storageFree}${storageUnit ? ' ' + storageUnit : ''}</div>
                <div class="bot-sub">Free</div>
              </div>
            </div>
            <div class="bot-item">
              <span class="bot-ico">⏱️</span>
              <div>
                <div class="bot-lbl">Uptime</div>
                <div class="bot-val">${this._fmtUptime()}</div>
                <div class="bot-sub">Up</div>
              </div>
            </div>
            <span class="arrow">›</span>
          </div>
        </div>
      </ha-card>`;
  }

  // ── Tile builders ─────────────────────────────────────────────────────────
  _stdTile(label, value, unit, colors, key, bg, border, isFuturistic) {
    const hist  = this._history[key] || [value];
    const spark = sparkSVG(hist, colors.spark, 200, 36);
    return `<div style="background:${bg};${border}border-radius:12px;padding:12px;overflow:hidden;">
      <div style="font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:${colors.label};margin-bottom:4px;">${label}</div>
      <div style="font-size:28px;font-weight:700;line-height:1.1;margin-bottom:8px;">${value}<span style="font-size:14px;font-weight:400;opacity:.8;">${unit}</span></div>
      <div style="line-height:0;">${spark}</div>
    </div>`;
  }

  _gaugeTile(value, max, colors, label, unit, key, bg, border) {
    const pct   = value / (max || 100);
    const gauge = gaugeSVG(pct, colors.spark, label, `${value}${unit}`, 108);
    const hist  = this._history[key] || [value];
    const spark = sparkSVG(hist, colors.spark, 120, 24);
    return `<div style="background:${bg};${border}border-radius:12px;padding:10px 8px 8px;display:flex;flex-direction:column;align-items:center;overflow:hidden;">
      ${gauge}
      <div style="width:100%;line-height:0;margin-top:4px;">${spark}</div>
    </div>`;
  }

  _flowTile(label, value, colors, key, bg, border, isFuturistic) {
    const hist  = this._history[key] || [0];
    const spark = sparkSVG(hist, colors.spark, 120, 26);
    const glow  = isFuturistic ? `text-shadow:0 0 8px ${colors.label};` : '';
    return `<div style="background:${bg};${border}border-radius:10px;padding:9px 10px;overflow:hidden;">
      <div style="font-size:10px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:${colors.label};${glow}margin-bottom:3px;">${label}</div>
      <div style="font-size:13px;font-weight:700;margin-bottom:5px;white-space:nowrap;">${value}</div>
      <div style="line-height:0;">${spark}</div>
    </div>`;
  }

  getCardSize() { return 4; }
}

customElements.define('nas-graph-card', NasGraphCard);

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'nas-graph-card')) {
  window.customCards.push({
    type:             'nas-graph-card',
    name:             'NAS Graph Card',
    description:      'Real-time NAS monitoring for QNAP & Synology — sparklines, gauges, frosted glass',
    preview:          true,
    documentationURL: 'https://github.com/andrejkurlovic/nas-graph-card',
  });
}

console.info(
  `%c NAS-GRAPH-CARD %c v${VERSION} `,
  'background:#0d1524;color:#06b6d4;padding:2px 8px;border-radius:3px 0 0 3px;font-weight:bold',
  'background:#06b6d4;color:#fff;padding:2px 8px;border-radius:0 3px 3px 0;font-weight:bold',
);
