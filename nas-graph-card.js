/**
 * NAS Graph Card for Home Assistant  v2.0.0
 * Works with any device that exposes sensors: NAS, server, desktop,
 * container, Raspberry Pi, Beszel — and more.
 *
 * Themes: standard | futuristic
 * Frosted glass is handled by the active HA theme — the card never
 * overrides ha-card's background, border, shadow or backdrop-filter.
 * https://github.com/andrejkurlovic/nas-graph-card
 */

const VERSION = '2.0.1';
const MAX_HISTORY = 30;

// ── Metric colour palette ───────────────────────────────────────────────────
const C = {
  cpu:         { label: '#a78bfa', spark: '#8b5cf6' },
  memory:      { label: '#38bdf8', spark: '#06b6d4' },
  temperature: { label: '#fb923c', spark: '#f97316' },
  network_in:  { label: '#4ade80', spark: '#22c55e' },
  network_out: { label: '#fbbf24', spark: '#f59e0b' },
  disk_read:   { label: '#c084fc', spark: '#a855f7' },
  disk_write:  { label: '#f472b6', spark: '#ec4899' },
};

// ── Unique ID counter for SVG gradient defs ─────────────────────────────────
let _uid = 0;
const uid = () => `n${++_uid}`;

// ── Sparkline SVG ───────────────────────────────────────────────────────────
// loading=true → dashed placeholder while waiting for HA history API response
function sparkSVG(data, strokeColor, w = 200, h = 36, loading = false) {
  const id = uid();
  const pad = 2;
  if (loading || !data || data.length < 2) {
    const y = h / 2;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${strokeColor}" stroke-width="1.5"
        stroke-opacity="${loading ? 0.15 : 0.3}" stroke-dasharray="${loading ? '4 3' : 'none'}"/>
    </svg>`;
  }
  const min = Math.min(...data), max = Math.max(...data), range = max - min;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    range === 0 ? h / 2 : h - pad - ((v - min) / range) * (h - pad * 2),
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
  const s = (startDeg * Math.PI) / 180, e = (clamp * Math.PI) / 180;
  const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${(clamp - startDeg) % 360 > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// ── Circular gauge SVG (futuristic) ─────────────────────────────────────────
function gaugeSVG(pct, color, label, valStr, size = 108) {
  const cx = size / 2, cy = size / 2, r = size * 0.37, sw = size * 0.055;
  const gid = uid(), START = 135, SWEEP = 270;
  const bgPath = arcD(cx, cy, r, START, START + SWEEP);
  const fgPath = pct > 0.01 ? arcD(cx, cy, r, START, START + SWEEP * Math.min(pct, 1)) : null;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="${gid}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter></defs>
    <path d="${bgPath}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${sw}" stroke-linecap="round"/>
    ${fgPath ? `<path d="${fgPath}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" filter="url(#${gid})"/>` : ''}
    <text x="${cx}" y="${cy - 3}" text-anchor="middle" fill="${color}" font-size="${Math.round(size * 0.1)}" font-family="var(--primary-font-family,sans-serif)" opacity="0.9">${label}</text>
    <text x="${cx}" y="${cy + Math.round(size * 0.145)}" text-anchor="middle" fill="white" font-size="${Math.round(size * 0.175)}" font-family="var(--primary-font-family,sans-serif)" font-weight="700">${valStr}</text>
  </svg>`;
}

// ── Device icons ─────────────────────────────────────────────────────────────
const ICONS = {
  qnap: `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="8" width="36" height="30" rx="4" fill="#162030" stroke="#2a4055" stroke-width="1.3"/>
    <rect x="9" y="13" width="28" height="4.5" rx="1.5" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
    <rect x="9" y="20.5" width="28" height="4.5" rx="1.5" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
    <rect x="9" y="28" width="28" height="4.5" rx="1.5" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
    <circle cx="34" cy="15.25" r="1.6" fill="#06b6d4"/>
    <circle cx="34" cy="22.75" r="1.6" fill="#06b6d4"/>
    <circle cx="34" cy="30.25" r="1.6" fill="#3a4a5c"/>
  </svg>`,
  synology: `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="5" width="30" height="36" rx="4" fill="#152030" stroke="#283d55" stroke-width="1.3"/>
    <rect x="12" y="10" width="22" height="3.8" rx="1.3" fill="#1d3048" stroke="#344d68" stroke-width="0.7"/>
    <rect x="12" y="16.5" width="22" height="3.8" rx="1.3" fill="#1d3048" stroke="#344d68" stroke-width="0.7"/>
    <rect x="12" y="23" width="22" height="3.8" rx="1.3" fill="#1d3048" stroke="#344d68" stroke-width="0.7"/>
    <rect x="12" y="29.5" width="22" height="3.8" rx="1.3" fill="#1d3048" stroke="#344d68" stroke-width="0.7"/>
    <circle cx="14.5" cy="11.9" r="1.1" fill="#22c55e"/>
    <circle cx="14.5" cy="18.4" r="1.1" fill="#22c55e"/>
    <circle cx="14.5" cy="24.9" r="1.1" fill="#22c55e"/>
    <circle cx="14.5" cy="31.4" r="1.1" fill="#3a4a5c"/>
  </svg>`,
  server: `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="7" width="38" height="9" rx="2.5" fill="#162030" stroke="#2a4055" stroke-width="1.2"/>
    <rect x="4" y="19" width="38" height="9" rx="2.5" fill="#162030" stroke="#2a4055" stroke-width="1.2"/>
    <rect x="4" y="31" width="38" height="9" rx="2.5" fill="#162030" stroke="#2a4055" stroke-width="1.2"/>
    <circle cx="36" cy="11.5" r="1.4" fill="#22c55e"/>
    <circle cx="36" cy="23.5" r="1.4" fill="#22c55e"/>
    <circle cx="36" cy="35.5" r="1.4" fill="#3a4a5c"/>
    <rect x="8" y="10" width="14" height="3" rx="1" fill="#1d3048" stroke="#304a65" stroke-width="0.6"/>
    <rect x="8" y="22" width="14" height="3" rx="1" fill="#1d3048" stroke="#304a65" stroke-width="0.6"/>
    <rect x="8" y="34" width="14" height="3" rx="1" fill="#1d3048" stroke="#304a65" stroke-width="0.6"/>
  </svg>`,
  desktop: `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="5" width="38" height="26" rx="3" fill="#162030" stroke="#2a4055" stroke-width="1.2"/>
    <rect x="7" y="8" width="32" height="20" rx="1.5" fill="#1d3048"/>
    <rect x="18" y="31" width="10" height="5" rx="1" fill="#1d3048" stroke="#2a4055" stroke-width="1"/>
    <rect x="13" y="36" width="20" height="2.5" rx="1.2" fill="#162030" stroke="#2a4055" stroke-width="1"/>
    <circle cx="23" cy="18" r="5" fill="#0a1828" stroke="#304a65" stroke-width="0.8"/>
    <circle cx="23" cy="18" r="2" fill="#06b6d4" opacity="0.6"/>
  </svg>`,
  container: `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="34" height="34" rx="4" fill="#162030" stroke="#2a4055" stroke-width="1.2"/>
    <rect x="11" y="11" width="11" height="11" rx="2" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
    <rect x="24" y="11" width="11" height="11" rx="2" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
    <rect x="11" y="24" width="11" height="11" rx="2" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
    <rect x="24" y="24" width="11" height="11" rx="2" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
    <circle cx="16.5" cy="16.5" r="2" fill="#06b6d4" opacity="0.7"/>
    <circle cx="29.5" cy="16.5" r="2" fill="#22c55e" opacity="0.7"/>
    <circle cx="16.5" cy="29.5" r="2" fill="#a855f7" opacity="0.7"/>
    <circle cx="29.5" cy="29.5" r="2" fill="#3a4a5c"/>
  </svg>`,
  raspberry_pi: `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="7" width="32" height="32" rx="4" fill="#162030" stroke="#2a4055" stroke-width="1.2"/>
    <rect x="13" y="13" width="20" height="20" rx="2" fill="#1d3048" stroke="#304a65" stroke-width="0.8"/>
    <rect x="3" y="14" width="4" height="3" rx="1" fill="#2a4055"/>
    <rect x="3" y="20" width="4" height="3" rx="1" fill="#2a4055"/>
    <rect x="39" y="14" width="4" height="3" rx="1" fill="#2a4055"/>
    <rect x="39" y="20" width="4" height="3" rx="1" fill="#2a4055"/>
    <rect x="14" y="3" width="5" height="4" rx="1" fill="#2a4055"/>
    <rect x="27" y="3" width="5" height="4" rx="1" fill="#2a4055"/>
    <circle cx="23" cy="23" r="4" fill="#c00" opacity="0.8"/>
    <circle cx="23" cy="23" r="1.5" fill="#ff4444"/>
  </svg>`,
  // Beszel — live sparkline chart aesthetic
  beszel: `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="40" height="40" rx="5" fill="#0a1628" stroke="#1e3a5f" stroke-width="1.3"/>
    <line x1="7" y1="15" x2="39" y2="15" stroke="#1a3050" stroke-width="0.8"/>
    <line x1="7" y1="24" x2="39" y2="24" stroke="#1a3050" stroke-width="0.8"/>
    <line x1="7" y1="33" x2="39" y2="33" stroke="#1a3050" stroke-width="0.8"/>
    <polyline points="7,30 12,23 17,26 22,17 27,21 31,13 36,17 39,11"
      stroke="#06b6d4" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="39" cy="11" r="3" fill="#06b6d4"/>
    <circle cx="39" cy="11" r="5.5" fill="#06b6d4" opacity="0.18"/>
  </svg>`,

  generic: `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="10" width="36" height="26" rx="4" fill="#162030" stroke="#2a4055" stroke-width="1.2"/>
    <circle cx="23" cy="23" r="8" fill="#1d3048" stroke="#304a65" stroke-width="1"/>
    <circle cx="23" cy="23" r="3" fill="#06b6d4" opacity="0.7"/>
    <circle cx="13" cy="15" r="1.5" fill="#22c55e" opacity="0.8"/>
    <circle cx="33" cy="15" r="1.5" fill="#3a4a5c"/>
    <rect x="9" y="31" width="8" height="1.5" rx=".75" fill="#304a65"/>
    <rect x="19" y="31" width="8" height="1.5" rx=".75" fill="#304a65"/>
    <rect x="29" y="31" width="8" height="1.5" rx=".75" fill="#304a65"/>
  </svg>`,
};

// ── Entity auto-discovery matchers ───────────────────────────────────────────
const _isFlow    = u => /[KMGT]?B\/s|bps|bit\/s/i.test(u);
const _isStorage = u => /^[KMGT]?B$/i.test(u);
// Beszel reports network/disk as per-interval bytes (kB, MB) not per-second rates
const _isBytes   = u => /^[KMGT]i?B$/i.test(u);
const _isRate    = u => _isFlow(u) || _isBytes(u);
const _has       = (id, ...terms) => terms.some(t => id.includes(t));

const MATCHERS = [
  { key: 'cpu',          test: (id, u)     => _has(id, 'cpu') && u === '%' },
  { key: 'memory',       test: (id, u)     => _has(id, 'memory', 'ram') && u === '%' },
  { key: 'temperature',  test: (id, u, dc) => dc === 'temperature' },
  // network_in: standard names + Beszel (network_receive, recv)
  { key: 'network_in',   test: (id, u) => _has(id, '_rx','net_in','download','network_in','network_receive','recv') && _isRate(u) },
  // network_out: standard names + Beszel (network_send, _send)
  { key: 'network_out',  test: (id, u) => _has(id, '_tx','net_out','upload','network_out','network_send','_send') && _isRate(u) },
  // disk I/O: explicit disk_read / disk_write names for Beszel
  { key: 'disk_read',    test: (id, u) => _has(id, 'disk_read','disk_r','_read') && _isRate(u) && !_has(id,'write') },
  { key: 'disk_write',   test: (id, u) => _has(id, 'disk_write','disk_w','_write') && _isRate(u) && !_has(id,'read') },
  { key: 'storage_free', test: (id, u) => _has(id, 'free', 'available', 'volume') && _isStorage(u) },
  { key: 'uptime',       test: (id, u, dc) => _has(id, 'uptime', 'up_time', 'boot') || dc === 'duration' },
  { key: 'disks_total',  test: (id, u)     => _has(id, 'disk', 'drive') && _has(id, 'total', 'count') && !_isStorage(u) },
  { key: 'disks_healthy',test: (id, u)     => _has(id, 'disk', 'drive') && _has(id, 'healthy', 'good', 'normal', 'ready') },
  { key: 'status',       test: (id, u, dc) => id.startsWith('binary_sensor.') && _has(id, 'online', 'status', 'connected', 'running') },
];

// ── Editor schema ─────────────────────────────────────────────────────────────
// All select option values are strings — ha-form requires this
const EDITOR_SCHEMA = [
  { name: 'name',  label: 'Card Name',   selector: { text: {} } },
  {
    name: 'brand', label: 'Device Icon',
    selector: { select: { options: [
      { value: 'qnap',         label: 'QNAP NAS'       },
      { value: 'synology',     label: 'Synology NAS'   },
      { value: 'beszel',       label: 'Beszel'         },
      { value: 'server',       label: 'Server'         },
      { value: 'desktop',      label: 'Desktop / PC'   },
      { value: 'container',    label: 'Container'      },
      { value: 'raspberry_pi', label: 'Raspberry Pi'   },
      { value: 'generic',      label: 'Generic Device' },
    ] } },
  },
  {
    name: 'theme', label: 'Visual Style',
    selector: { select: { options: [
      { value: 'standard',   label: 'Standard (Vibrant)' },
      { value: 'futuristic', label: 'Futuristic (Neon)'  },
    ] } },
  },
  { name: 'device',     label: 'HA Device (auto-discovers sensors)',  selector: { device: {} } },
  { name: 'max_cpu',    label: 'CPU gauge max (%)',    selector: { number: { min: 1, max: 200, step: 1, mode: 'box' } } },
  { name: 'max_memory', label: 'Memory gauge max (%)', selector: { number: { min: 1, max: 200, step: 1, mode: 'box' } } },
  { name: 'max_temp',   label: 'Temp gauge max (°)',   selector: { number: { min: 1, max: 150, step: 1, mode: 'box' } } },
  {
    name: 'visible_metrics', label: 'Visible metrics (blank = show all with sensors)',
    selector: { select: { multiple: true, options: [
      { value: 'cpu',         label: 'CPU'          },
      { value: 'memory',      label: 'Memory'       },
      { value: 'temperature', label: 'Temperature'  },
      { value: 'network_in',  label: 'Network In'   },
      { value: 'network_out', label: 'Network Out'  },
      { value: 'disk_read',   label: 'Disk Read'    },
      { value: 'disk_write',  label: 'Disk Write'   },
      { value: 'disks',       label: 'Disk Health'  },
      { value: 'storage',     label: 'Storage Free' },
      { value: 'uptime',      label: 'Uptime'       },
    ] } },
  },
  {
    name: 'storage_unit', label: 'Storage display unit',
    selector: { select: { options: [
      { value: 'auto', label: 'Auto (best fit)' },
      { value: 'GB',   label: 'Gigabytes (GB)' },
      { value: 'TB',   label: 'Terabytes (TB)' },
    ] } },
  },
  {
    name: 'history_hours', label: 'Sparkline history',
    selector: { select: { options: [
      { value: '1',   label: 'Last 1 hour'   },
      { value: '24',  label: 'Last 24 hours' },
      { value: '168', label: 'Last 7 days'   },
    ] } },
  },
  {
    name: 'exclude_sections', label: 'Hide sections',
    selector: { select: { multiple: true, options: [
      { value: 'header', label: 'Header (icon / name / status)'         },
      { value: 'top',    label: 'Top row (CPU / Memory / Temp)'         },
      { value: 'mid',    label: 'Mid row (Network / Disk I/O)'          },
      { value: 'bot',    label: 'Bottom row (Disks / Storage / Uptime)' },
    ] } },
  },
];

const ENTITY_FIELDS = [
  { key: 'status',        label: 'Online / Offline status', domain: 'binary_sensor' },
  { key: 'cpu',           label: 'CPU Usage (%)',           domain: 'sensor' },
  { key: 'memory',        label: 'Memory Usage (%)',        domain: 'sensor' },
  { key: 'temperature',   label: 'System Temperature',      domain: 'sensor' },
  { key: 'network_in',    label: 'Network In',              domain: 'sensor' },
  { key: 'network_out',   label: 'Network Out',             domain: 'sensor' },
  { key: 'disk_read',     label: 'Disk Read Speed',         domain: 'sensor' },
  { key: 'disk_write',    label: 'Disk Write Speed',        domain: 'sensor' },
  { key: 'disks_total',   label: 'Total Disks',             domain: 'sensor' },
  { key: 'disks_healthy', label: 'Healthy Disks',           domain: 'sensor' },
  { key: 'storage_free',  label: 'Storage Free',            domain: 'sensor' },
  { key: 'uptime',        label: 'Uptime',                  domain: 'sensor' },
];

// ── GUI editor ─────────────────────────────────────────────────────────────────
// Uses plain HTMLElement (no LitElement dependency).
// _build() is called from BOTH setConfig AND connectedCallback so it works
// regardless of whether HA connects the element before or after calling setConfig.
class NasGraphCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config    = {};
    this._hass      = null;
    this._built     = false;
    this._form      = null;
    this._pickers   = {};
  }

  set hass(h) {
    this._hass = h;
    if (this._form) this._form.hass = h;
    Object.values(this._pickers).forEach(p => { if (p) p.hass = h; });
  }

  setConfig(config) {
    this._config = { ...config };
    if (!this._built) {
      this._build();
    } else {
      if (this._form) this._form.data = this._formData();
      for (const f of ENTITY_FIELDS) {
        if (this._pickers[f.key]) this._pickers[f.key].value = config.entities?.[f.key] ?? '';
      }
    }
  }

  connectedCallback() {
    this._build();
  }

  _build() {
    if (this._built) return;
    this._built = true;

    this.shadowRoot.innerHTML = `<style>
      :host { display:block }
      .sep { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.6px;
             color:var(--secondary-text-color); padding:14px 2px 6px; border-top:1px solid var(--divider-color); margin-top:6px; }
      .sep:first-of-type { border-top:none; padding-top:4px; }
      .hint { font-size:11px; color:var(--secondary-text-color); padding:0 2px 8px; line-height:1.5; }
      .er { margin-bottom:6px; }
    </style>
    <div id="f"></div>
    <div class="sep">Entity overrides <span style="font-weight:400;text-transform:none">(optional)</span></div>
    <div class="hint">Leave blank — the card discovers sensors automatically from the selected device.</div>
    <div id="e"></div>`;

    // ── ha-form (main settings) ───────────────────────────────────────────
    const form = document.createElement('ha-form');
    form.hass         = this._hass;
    form.data         = this._formData();
    form.schema       = EDITOR_SCHEMA;
    form.computeLabel = s => s.label ?? s.name;
    form.addEventListener('value-changed', e => {
      this._config = { ...this._config, ...e.detail.value };
      this._fire();
    });
    this.shadowRoot.getElementById('f').appendChild(form);
    this._form = form;

    // ── Entity pickers ────────────────────────────────────────────────────
    const slot = this.shadowRoot.getElementById('e');
    for (const f of ENTITY_FIELDS) {
      const row    = document.createElement('div');
      row.className = 'er';
      const p      = document.createElement('ha-entity-picker');
      p.hass              = this._hass;
      p.label             = f.label;
      p.value             = this._config.entities?.[f.key] ?? '';
      p.includeDomains    = [f.domain];
      p.allowCustomEntity = true;
      p.style.width       = '100%';
      p.addEventListener('value-changed', e => {
        const entities = { ...(this._config.entities ?? {}) };
        if (e.detail.value) entities[f.key] = e.detail.value;
        else delete entities[f.key];
        this._config = { ...this._config, entities };
        this._fire();
      });
      row.appendChild(p);
      slot.appendChild(row);
      this._pickers[f.key] = p;
    }
  }

  // Strip entities/actions from the flat form data so ha-form doesn't see them
  _formData() {
    const schemaKeys = new Set(EDITOR_SCHEMA.map(s => s.name));
    return Object.fromEntries(Object.entries(this._config).filter(([k]) => schemaKeys.has(k)));
  }

  _fire() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config } },
      bubbles: true, composed: true,
    }));
  }
}

customElements.define('nas-graph-card-editor', NasGraphCardEditor);

// ── Keys that have sparklines and should navigate to history on tap ──────────
const HISTORY_KEYS = new Set(['cpu','memory','temperature','network_in','network_out','disk_read','disk_write']);

// ── Main card ──────────────────────────────────────────────────────────────────
class NasGraphCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._history          = {};
    this._historyReady     = {};  // key → true once API has returned data
    this._config           = {};
    this._hass             = null;
    this._resolvedEntities = {};
    this._lastHistoryFetch = 0;
    this._fetchingHistory  = false;
    this._renderKey        = null;

    // ── Delegated tap / hold / double-tap ─────────────────────────────────
    let _holdTimer = null, _holdFired = false, _tapCount = 0, _tapTimer = null;
    const _clearHold = () => { if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; } };

    this.shadowRoot.addEventListener('pointerdown', e => {
      const tile = e.target.closest('[data-action]');
      if (!tile) return;
      _holdFired = false;
      _holdTimer = setTimeout(() => { _holdFired = true; this._dispatchAction(tile, 'hold'); }, 500);
    }, { passive: true });
    this.shadowRoot.addEventListener('pointerup',     _clearHold, { passive: true });
    this.shadowRoot.addEventListener('pointerleave',  _clearHold, { passive: true });
    this.shadowRoot.addEventListener('pointercancel', _clearHold, { passive: true });

    this.shadowRoot.addEventListener('click', e => {
      if (_holdFired) { _holdFired = false; return; }
      const tile = e.target.closest('[data-action]');
      if (!tile) return;
      const key = tile.dataset.action;
      const dta = this._config.actions?.[key]?.double_tap_action;
      if (dta && dta.action !== 'none') {
        _tapCount++;
        clearTimeout(_tapTimer);
        if (_tapCount >= 2) { _tapCount = 0; this._dispatchAction(tile, 'double_tap'); }
        else _tapTimer = setTimeout(() => { _tapCount = 0; this._dispatchAction(tile, 'tap'); }, 250);
      } else {
        this._dispatchAction(tile, 'tap');
      }
    });
  }

  // ── History navigation action ─────────────────────────────────────────────
  _historyNav(entityId) {
    if (!entityId) return { action: 'none' };
    const hours = parseInt(String(this._config.history_hours), 10) || 1;
    const end   = new Date();
    const start = new Date(end.getTime() - hours * 3_600_000);
    return {
      action: 'navigate',
      navigation_path: `/history?entity_id=${entityId}&start_date=${start.toISOString().slice(0, 19)}&end_date=${end.toISOString().slice(0, 19)}`,
    };
  }

  _dispatchAction(el, actionType) {
    const key      = el.dataset.action;
    const entityId = el.dataset.entity || undefined;
    const sa       = this._config.actions?.[key] ?? {};

    // Default tap for sparkline tiles: navigate to history with the same time window
    const defTap = HISTORY_KEYS.has(key) && entityId
      ? this._historyNav(entityId)
      : { action: entityId ? 'more-info' : 'none' };

    const tap  = sa.tap_action        ?? defTap;
    const hold = sa.hold_action       ?? { action: 'none' };
    const dbl  = sa.double_tap_action ?? { action: 'none' };

    const actionCfg = actionType === 'tap' ? tap : actionType === 'hold' ? hold : dbl;
    if (!actionCfg || actionCfg.action === 'none') return;

    this.dispatchEvent(new CustomEvent('hass-action', {
      bubbles: true, composed: true,
      detail: {
        config: { entity: entityId, tap_action: tap, hold_action: hold, double_tap_action: dbl },
        action: actionType,
      },
    }));
  }

  static getConfigElement() { return document.createElement('nas-graph-card-editor'); }
  static getStubConfig()    { return { name: 'My NAS', brand: 'qnap', theme: 'standard', entities: {} }; }

  setConfig(config) {
    const prevHours = this._config.history_hours;
    this._config = {
      theme:            'standard',
      name:             'NAS',
      brand:            'qnap',
      max_cpu:          100,
      max_memory:       100,
      max_temp:         80,
      history_hours:    '1',
      storage_unit:     'auto',
      visible_metrics:  [],
      entities:         {},
      exclude_sections: [],
      actions:          {},
      ...config,
    };
    if (String(config.history_hours ?? '1') !== String(prevHours ?? '')) {
      this._lastHistoryFetch = 0;
      this._history      = {};
      this._historyReady = {};
      this._renderKey    = null;
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._buildResolvedEntities();
    this._pushHistory();
    const hours     = parseInt(String(this._config.history_hours), 10) || 1;
    const refreshMs = hours <= 1 ? 2 * 60_000 : 5 * 60_000;
    if (Date.now() - this._lastHistoryFetch > refreshMs) {
      this._lastHistoryFetch = Date.now();
      this._fetchHistory();
    }
    this._render();
  }

  // ── History from HA API ───────────────────────────────────────────────────
  async _fetchHistory() {
    if (this._fetchingHistory || !this._hass) return;
    this._fetchingHistory = true;
    try {
      const hours = parseInt(String(this._config.history_hours), 10) || 1;
      const start = new Date(Date.now() - hours * 3_600_000).toISOString();
      const NUMERIC = ['cpu','memory','temperature','network_in','network_out','disk_read','disk_write'];
      const ids     = NUMERIC.map(k => this._resolvedEntities[k]).filter(Boolean);
      if (!ids.length) return;
      const data = await this._hass.callApi('GET',
        `history/period/${start}?minimal_response=true&no_attributes=true&filter_entity_id=${ids.join(',')}`);
      if (!Array.isArray(data)) return;
      for (const hist of data) {
        if (!Array.isArray(hist) || !hist.length) continue;
        const eid = hist[0].entity_id;
        if (!eid) continue;
        const key = NUMERIC.find(k => this._resolvedEntities[k] === eid);
        if (!key) continue;
        const vals = hist.map(s => parseFloat(s.state)).filter(v => !isNaN(v));
        if (!vals.length) continue;
        // Merge: resample API data into the buffer front, keep any live tail
        const live    = this._history[key] ?? [];
        const resampled = this._resample(vals, MAX_HISTORY - live.length);
        this._history[key]      = [...resampled, ...live].slice(-MAX_HISTORY);
        this._historyReady[key] = true;
      }
      this._render();
    } catch (_) { /* fall back to in-memory */ } finally {
      this._fetchingHistory = false;
    }
  }

  _resample(values, n) {
    if (!values.length) return [];
    if (values.length <= n) return values;
    const sz = values.length / n;
    return Array.from({ length: n }, (_, i) => {
      const s = Math.floor(i * sz), e = Math.ceil((i + 1) * sz);
      const sl = values.slice(s, e);
      return sl.reduce((a, b) => a + b, 0) / sl.length;
    });
  }

  // ── Entity resolution ─────────────────────────────────────────────────────
  _buildResolvedEntities() {
    const discovered = this._config.device ? this._discoverEntities() : {};
    this._resolvedEntities = { ...discovered, ...this._config.entities };
  }

  _discoverEntities() {
    const deviceId = this._resolveDeviceId(this._config.device);
    if (!deviceId || !this._hass.entities) return {};
    const result = {};
    for (const [entityId, info] of Object.entries(this._hass.entities)) {
      if (info.device_id !== deviceId) continue;
      const state = this._hass.states[entityId];
      if (!state) continue;
      const id = entityId.toLowerCase();
      const u  = state.attributes?.unit_of_measurement ?? '';
      const dc = state.attributes?.device_class ?? '';
      for (const { key, test } of MATCHERS) {
        if (!result[key] && test(id, u, dc)) { result[key] = entityId; break; }
      }
    }
    return result;
  }

  _resolveDeviceId(ref) {
    if (!ref || !this._hass.devices) return null;
    if (this._hass.devices[ref]) return ref;
    const lower = ref.toLowerCase();
    for (const [id, dev] of Object.entries(this._hass.devices)) {
      if ((dev.name_by_user || dev.name || '').toLowerCase() === lower) return id;
    }
    return null;
  }

  // ── History tracking (live values) ───────────────────────────────────────
  _pushHistory() {
    ['cpu','memory','temperature','network_in','network_out','disk_read','disk_write'].forEach(k => {
      const id = this._resolvedEntities[k];
      if (!id) return;
      const v = parseFloat(this._hass.states[id]?.state);
      if (isNaN(v)) return;
      if (!this._history[k]) this._history[k] = [];
      this._history[k].push(v);
      if (this._history[k].length > MAX_HISTORY) this._history[k].shift();
    });
  }

  // ── State helpers ─────────────────────────────────────────────────────────
  _state(key, fallback = 'N/A') {
    const id = this._resolvedEntities[key];
    if (!id) return fallback;
    const s = this._hass?.states[id]?.state;
    return (!s || s === 'unavailable' || s === 'unknown') ? fallback : s;
  }
  _unit(key) {
    const id = this._resolvedEntities[key];
    return this._hass?.states[id]?.attributes?.unit_of_measurement ?? '';
  }
  _isOnline() {
    const id = this._resolvedEntities.status;
    if (!id) return true;
    return this._hass?.states[id]?.state === 'on';
  }

  // ── Visibility: visible_metrics (empty = show all) ────────────────────────
  _isVisible(key) {
    const vm = this._config.visible_metrics;
    if (!vm || !vm.length) return true;
    const vmKey = { disks_healthy: 'disks', storage_free: 'storage' }[key] ?? key;
    return vm.includes(vmKey);
  }

  // ── Format helpers ────────────────────────────────────────────────────────
  _fmtFlow(key) {
    const v = parseFloat(this._state(key, '0'));
    if (isNaN(v)) return '—';
    const u = this._unit(key);
    if (/MB\/s|MiB\/s/i.test(u))    return `${v.toFixed(1)} MB/s`;
    if (/[Kk]B\/s|KiB\/s/i.test(u)) return `${v >= 100 ? Math.round(v) : v.toFixed(1)} KB/s`;
    if (/GB\/s/i.test(u))            return `${v.toFixed(2)} GB/s`;
    if (/^B\/s$|^bytes\/s$/i.test(u)) {
      if (v >= 1_048_576) return `${(v / 1_048_576).toFixed(1)} MB/s`;
      if (v >= 1_024)     return `${(v / 1_024).toFixed(1)} KB/s`;
      return `${Math.round(v)} B/s`;
    }
    // Beszel: per-interval bytes — kB or MB per poll window (not a rate)
    if (/^[Kk]B$/.test(u)) return v >= 1024 ? `${(v / 1024).toFixed(1)} MB` : `${Math.round(v)} kB`;
    if (/^MB$/i.test(u))   return `${v.toFixed(2)} MB`;
    if (/^GB$/i.test(u))   return `${v.toFixed(3)} GB`;
    return `${v.toFixed(1)}${u ? ' ' + u : ''}`;
  }

  _fmtUptime() {
    const raw = this._state('uptime', null);
    if (!raw || raw === 'N/A') return null;
    const v = parseFloat(raw);
    if (isNaN(v)) return String(raw).trim() || null;

    const u = this._unit('uptime').toLowerCase();
    let secs = v;
    if      (u === 'days' || u === 'd')                  secs = v * 86400;
    else if (u === 'hours' || u === 'h' || u === 'hr')   secs = v * 3600;
    else if (u === 'minutes' || u === 'min' || u === 'm') secs = v * 60;

    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    // Suppress trailing zero components: "1d" not "1d 0h", "2h" not "2h 0m"
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
  }

  _fmtStorage() {
    const raw = this._state('storage_free', null);
    if (!raw || raw === 'N/A') return null;
    const v = parseFloat(raw);
    if (isNaN(v)) return String(raw);
    const u     = (this._unit('storage_free') || '').trim().toUpperCase();
    const MULT  = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15 };
    const bytes = v * (MULT[u] ?? 1);
    const forced = (this._config.storage_unit ?? 'auto').toUpperCase();
    if (forced === 'TB') return `${(bytes / 1e12).toFixed(2)} TB`;
    if (forced === 'GB') return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e15) return `${(bytes / 1e15).toFixed(2)} PB`;
    if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
    if (bytes >= 1e9)  return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6)  return `${(bytes / 1e6).toFixed(0)} MB`;
    return `${Math.round(bytes / 1e3)} KB`;
  }

  _getDiskStats() {
    const t = this._state('disks_total',   null);
    const h = this._state('disks_healthy', null);
    if (t) return { total: parseInt(t) || t, healthy: h ?? t };

    const deviceId = this._config.device ? this._resolveDeviceId(this._config.device) : null;
    if (!deviceId || !this._hass.entities) return null;

    const drives = Object.entries(this._hass.entities).filter(([eid, info]) => {
      if (info.device_id !== deviceId) return false;
      const id = eid.toLowerCase();
      return (
        /drive_\d+|disk_\d+|hdd_\d+|ssd_\d+/.test(id) &&
        _has(id, 'smart', 'health', 'status', 'condition')
      ) || (
        _has(id, 'drive', 'disk', 'hdd', 'ssd') &&
        _has(id, 'health', 'status', 'smart', 'condition')
      );
    });
    if (!drives.length) return null;

    const GOOD    = new Set(['ready','ok','good','normal','healthy','active','passed','online','warning']);
    const healthy = drives.filter(([eid]) => GOOD.has((this._hass.states[eid]?.state ?? '').toLowerCase())).length;
    return { total: drives.length, healthy };
  }

  // ── Cursor helper ─────────────────────────────────────────────────────────
  _cursor(key, entityId) {
    const defTap = HISTORY_KEYS.has(key) && entityId ? { action: 'navigate' } : { action: entityId ? 'more-info' : 'none' };
    const tap = this._config.actions?.[key]?.tap_action ?? defTap;
    return tap.action !== 'none' ? 'pointer' : 'default';
  }

  // ── Smart render: only rebuild DOM when structure changes ─────────────────
  _needsFullRender(topDefs, midDefs, hasDiskStats, hasStorage, hasUptime) {
    if (!this.shadowRoot.querySelector('ha-card')) return true;
    const key = JSON.stringify([
      this._config.theme,
      this._config.brand,
      (this._config.exclude_sections || []).slice().sort().join(','),
      topDefs.map(m => m.key).join(','),
      midDefs.map(m => m.key).join(','),
      hasDiskStats,
      hasStorage,
      hasUptime,
    ]);
    if (key !== this._renderKey) { this._renderKey = key; return true; }
    return false;
  }

  // ── In-place value patch (called when structure hasn't changed) ───────────
  _patchValues(isFuturistic, cv, topDefs, midDefs) {
    const sr = this.shadowRoot;

    // Online status dot + text
    const dot = sr.querySelector('.dot');
    if (dot) {
      dot.style.background = cv.online ? '#22c55e' : '#ef4444';
      dot.style.boxShadow  = isFuturistic && cv.online
        ? '0 0 7px #22c55e,0 0 14px rgba(34,197,94,0.35)' : 'none';
    }
    const statusText = sr.querySelector('.status-text');
    if (statusText) statusText.textContent = cv.online ? 'Online' : 'Offline';

    // Top tiles
    for (const m of topDefs) {
      const tile = sr.querySelector(`[data-action="${m.key}"]`);
      if (!tile) continue;
      const gaugeEl = tile.querySelector('.tile-gauge');
      if (gaugeEl) {
        gaugeEl.innerHTML = gaugeSVG(m.val / (m.max || 100), m.colors.spark, m.label, `${m.val}${m.unit}`, 108);
      }
      const valEl = tile.querySelector('.tile-val');
      if (valEl) {
        valEl.innerHTML = `${m.val}<span style="font-size:14px;font-weight:400;opacity:.8;">${m.unit}</span>`;
      }
      const sparkEl = tile.querySelector('.tile-spark');
      if (sparkEl) {
        const w = gaugeEl ? 120 : 200, h = gaugeEl ? 24 : 36;
        sparkEl.innerHTML = sparkSVG(this._history[m.key], m.colors.spark, w, h, !this._historyReady[m.key]);
      }
    }

    // Mid tiles
    for (const m of midDefs) {
      const tile = sr.querySelector(`[data-action="${m.key}"]`);
      if (!tile) continue;
      const valEl = tile.querySelector('.tile-val');
      if (valEl) valEl.textContent = this._fmtFlow(m.key);
      const sparkEl = tile.querySelector('.tile-spark');
      if (sparkEl) sparkEl.innerHTML = sparkSVG(this._history[m.key], m.colors.spark, 120, 26, !this._historyReady[m.key]);
    }

    // Bottom row values
    const disksEl = sr.querySelector('[data-action="disks_healthy"] .bot-val');
    if (disksEl && cv.diskStats) disksEl.textContent = `${cv.diskStats.healthy}/${cv.diskStats.total}`;

    const storageEl = sr.querySelector('[data-action="storage_free"] .bot-val');
    if (storageEl && cv.storageFmt) storageEl.textContent = cv.storageFmt;

    const uptimeEl = sr.querySelector('[data-action="uptime"] .bot-val');
    if (uptimeEl && cv.uptimeFmt) uptimeEl.textContent = cv.uptimeFmt;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  _render() {
    const cfg          = this._config;
    const isFuturistic = (cfg.theme || 'standard') === 'futuristic';

    const cpuV = parseFloat(this._state('cpu',         '0')) || 0;
    const memV = parseFloat(this._state('memory',      '0')) || 0;
    const tmpV = parseFloat(this._state('temperature', '0')) || 0;
    const online     = this._isOnline();
    const diskStats  = this._getDiskStats();
    const storageFmt = this._fmtStorage();
    const uptimeFmt  = this._fmtUptime();

    const cv = { cpuV, memV, tmpV, online, diskStats, storageFmt, uptimeFmt };

    // Read the actual unit from the sensor — auto-detects °F vs °C
    const tempUnit = this._unit('temperature') || '°C';
    // When using the default max_temp (80) with a °F sensor, scale to 176°F automatically
    const tempMax  = (tempUnit === '°F' && (cfg.max_temp === 80 || !cfg.max_temp)) ? 176 : (cfg.max_temp || 80);

    const topDefs = [
      { key: 'cpu',         label: 'CPU',         unit: '%',      val: cpuV, max: cfg.max_cpu,    colors: C.cpu         },
      { key: 'memory',      label: 'Memory',      unit: '%',      val: memV, max: cfg.max_memory, colors: C.memory      },
      { key: 'temperature', label: 'System Temp', unit: tempUnit, val: tmpV, max: tempMax,        colors: C.temperature },
    ].filter(m => (m.key !== 'temperature' || !!this._resolvedEntities.temperature) && this._isVisible(m.key));

    const midDefs = [
      { key: 'network_in',  label: 'Net In',    colors: C.network_in  },
      { key: 'network_out', label: 'Net Out',   colors: C.network_out },
      { key: 'disk_read',   label: 'Disk Read', colors: C.disk_read   },
      { key: 'disk_write',  label: 'Disk Write',colors: C.disk_write  },
    ].filter(m => this._resolvedEntities[m.key] && this._isVisible(m.key));

    if (this._needsFullRender(topDefs, midDefs, !!diskStats, !!storageFmt, !!uptimeFmt)) {
      this._fullRender(cfg, isFuturistic, cv, topDefs, midDefs);
    } else {
      this._patchValues(isFuturistic, cv, topDefs, midDefs);
    }
  }

  // ── Full DOM rebuild (only when layout/structure changes) ─────────────────
  _fullRender(cfg, isFuturistic, cv, topDefs, midDefs) {
    const brand    = (cfg.brand || 'qnap').toLowerCase();
    const excluded = new Set(cfg.exclude_sections ?? []);
    const online   = cv.online;

    const tileBg     = isFuturistic ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.20)';
    const tileBorder = isFuturistic ? 'border:1px solid rgba(60,80,180,0.18);' : '';

    const topCols  = topDefs.length || 1;
    const topTiles = topDefs.map(m => isFuturistic
      ? this._gaugeTile(m.val, m.max, m.colors, m.label, m.unit, m.key, tileBg, tileBorder)
      : this._stdTile(m.label, m.val, m.unit, m.colors, m.key, tileBg, tileBorder)
    ).join('');

    const midTiles = midDefs.map(m =>
      this._flowTile(m.label, this._fmtFlow(m.key), m.colors, m.key, tileBg, tileBorder, isFuturistic)
    ).join('');
    const midCols  = midDefs.length || 2;

    const disksEid   = this._resolvedEntities.disks_healthy || '';
    const storageEid = this._resolvedEntities.storage_free  || '';
    const uptimeEid  = this._resolvedEntities.uptime        || '';

    const botItems = [
      cv.diskStats  && this._isVisible('disks_healthy') ? `
        <div class="bot-item" data-action="disks_healthy" data-entity="${disksEid}" style="cursor:${this._cursor('disks_healthy',disksEid)}">
          <span class="bot-ico">💿</span>
          <div><div class="bot-lbl">Disks</div><div class="bot-val">${cv.diskStats.healthy}/${cv.diskStats.total}</div><div class="bot-sub">Healthy</div></div>
        </div>` : '',
      cv.storageFmt && this._isVisible('storage_free') ? `
        <div class="bot-item" data-action="storage_free" data-entity="${storageEid}" style="cursor:${this._cursor('storage_free',storageEid)}">
          <span class="bot-ico">🗄️</span>
          <div><div class="bot-lbl">Storage</div><div class="bot-val">${cv.storageFmt}</div><div class="bot-sub">Free</div></div>
        </div>` : '',
      cv.uptimeFmt && this._isVisible('uptime') ? `
        <div class="bot-item" data-action="uptime" data-entity="${uptimeEid}" style="cursor:${this._cursor('uptime',uptimeEid)}">
          <span class="bot-ico">⏱️</span>
          <div><div class="bot-lbl">Uptime</div><div class="bot-val">${cv.uptimeFmt}</div><div class="bot-sub">Up</div></div>
        </div>` : '',
    ].filter(Boolean).join('');

    const cardStyles = cfg.styles?.card
      ? Object.entries(cfg.styles.card).map(([k, v]) => `${k}:${v};`).join('') : '';

    const arrowStyle = isFuturistic
      ? `color:${C.cpu.spark};text-shadow:0 0 10px ${C.cpu.spark},0 0 20px ${C.cpu.spark};`
      : 'color:rgba(255,255,255,0.3);';

    this.shadowRoot.innerHTML = `
      ${cardStyles ? `<style>ha-card{${cardStyles}}</style>` : ''}
      <style>
        :host{display:block}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ha-card{overflow:hidden;${isFuturistic ? '--ha-card-border-color:rgba(80,100,200,0.25);' : ''}}
        .card{background:transparent;padding:16px;color:var(--primary-text-color,#fff);
          font-family:var(--primary-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif)}
        .hdr{display:flex;align-items:center;gap:12px;margin-bottom:14px}
        .hdr-text{flex:1;min-width:0}
        .hdr-name{font-size:22px;font-weight:700;letter-spacing:.3px;${isFuturistic ? 'text-shadow:0 0 20px rgba(180,200,255,0.35);' : ''}}
        .hdr-status{display:flex;align-items:center;gap:6px;font-size:12px;color:rgba(255,255,255,0.5);margin-top:3px}
        .dot{width:8px;height:8px;border-radius:50%;background:${online ? '#22c55e' : '#ef4444'};
          ${isFuturistic && online ? 'box-shadow:0 0 7px #22c55e,0 0 14px rgba(34,197,94,0.35);' : ''}}
        .top-grid{display:grid;grid-template-columns:repeat(${topCols},1fr);gap:10px;margin-bottom:10px}
        .mid-grid{display:grid;grid-template-columns:repeat(${midCols},1fr);gap:8px;margin-bottom:10px}
        .bot-row{display:flex;align-items:center;background:${tileBg};${tileBorder}border-radius:12px;padding:10px 14px}
        .bot-item{flex:1;display:flex;align-items:center;gap:9px}
        .bot-item+.bot-item{border-left:1px solid rgba(255,255,255,0.07);padding-left:12px}
        .bot-ico{font-size:22px;opacity:.65;flex-shrink:0}
        .bot-lbl{font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.4px}
        .bot-val{font-size:14px;font-weight:700;line-height:1.3}
        .bot-sub{font-size:10px;color:rgba(255,255,255,0.38)}
        .arrow{flex-shrink:0;font-size:22px;padding:2px 0 2px 6px;user-select:none;${arrowStyle}}
      </style>
      <ha-card>
        <div class="card">
          ${!excluded.has('header') ? `
          <div class="hdr">
            ${ICONS[brand] ?? ICONS.generic}
            <div class="hdr-text">
              <div class="hdr-name">${cfg.name || 'NAS'}</div>
              <div class="hdr-status"><div class="dot"></div><span class="status-text">${online ? 'Online' : 'Offline'}</span></div>
            </div>
          </div>` : ''}
          ${!excluded.has('top') && topTiles ? `<div class="top-grid">${topTiles}</div>` : ''}
          ${!excluded.has('mid') && midTiles  ? `<div class="mid-grid">${midTiles}</div>`  : ''}
          ${!excluded.has('bot') && botItems  ? `<div class="bot-row">${botItems}<span class="arrow">›</span></div>` : ''}
        </div>
      </ha-card>`;
  }

  // ── Tile builders ─────────────────────────────────────────────────────────
  _stdTile(label, value, unit, colors, key, bg, border) {
    const entityId = this._resolvedEntities[key] || '';
    const loading  = !this._historyReady[key];
    const spark    = sparkSVG(this._history[key], colors.spark, 200, 36, loading);
    return `<div data-action="${key}" data-entity="${entityId}" style="background:${bg};${border}border-radius:12px;padding:12px;overflow:hidden;cursor:${this._cursor(key,entityId)};">
      <div style="font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:${colors.label};margin-bottom:4px;">${label}</div>
      <div class="tile-val" style="font-size:28px;font-weight:700;line-height:1.1;margin-bottom:8px;">${value}<span style="font-size:14px;font-weight:400;opacity:.8;">${unit}</span></div>
      <div class="tile-spark" style="line-height:0;">${spark}</div>
    </div>`;
  }

  _gaugeTile(value, max, colors, label, unit, key, bg, border) {
    const entityId = this._resolvedEntities[key] || '';
    const loading  = !this._historyReady[key];
    const gauge    = gaugeSVG(value / (max || 100), colors.spark, label, `${value}${unit}`, 108);
    const spark    = sparkSVG(this._history[key], colors.spark, 120, 24, loading);
    return `<div data-action="${key}" data-entity="${entityId}" style="background:${bg};${border}border-radius:12px;padding:10px 8px 8px;display:flex;flex-direction:column;align-items:center;overflow:hidden;cursor:${this._cursor(key,entityId)};">
      <div class="tile-gauge">${gauge}</div>
      <div class="tile-spark" style="width:100%;line-height:0;margin-top:4px;">${spark}</div>
    </div>`;
  }

  _flowTile(label, value, colors, key, bg, border, isFuturistic) {
    const entityId = this._resolvedEntities[key] || '';
    const loading  = !this._historyReady[key];
    const spark    = sparkSVG(this._history[key], colors.spark, 120, 26, loading);
    const glow     = isFuturistic ? `text-shadow:0 0 8px ${colors.label};` : '';
    return `<div data-action="${key}" data-entity="${entityId}" style="background:${bg};${border}border-radius:10px;padding:9px 10px;overflow:hidden;cursor:${this._cursor(key,entityId)};">
      <div style="font-size:10px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:${colors.label};${glow}margin-bottom:3px;">${label}</div>
      <div class="tile-val" style="font-size:13px;font-weight:700;margin-bottom:5px;white-space:nowrap;">${value}</div>
      <div class="tile-spark" style="line-height:0;">${spark}</div>
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
    description:      'Real-time NAS / server monitoring — sparklines, circular gauges, HA history graphs',
    preview:          true,
    documentationURL: 'https://github.com/andrejkurlovic/nas-graph-card',
  });
}

console.info(
  `%c NAS-GRAPH-CARD %c v${VERSION} `,
  'background:#0d1524;color:#06b6d4;padding:2px 8px;border-radius:3px 0 0 3px;font-weight:bold',
  'background:#06b6d4;color:#fff;padding:2px 8px;border-radius:0 3px 3px 0;font-weight:bold',
);
