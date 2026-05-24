/**
 * NAS Graph Card for Home Assistant
 * Works with any device that exposes sensors: NAS, server, desktop,
 * container, Raspberry Pi, etc.
 *
 * Themes: standard | futuristic
 * Frosted glass is handled by the active HA theme — the card never
 * overrides ha-card's background, border, shadow or backdrop-filter.
 * https://github.com/andrejkurlovic/nas-graph-card
 */

const VERSION = '1.3.0';
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
  const pad = 2;
  if (!data || data.length < 2) {
    const y = h / 2;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${strokeColor}" stroke-width="1.5" stroke-opacity="0.3"/>
    </svg>`;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
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
const _isFlow    = u => /[KMGT]?B\/s|bps/i.test(u);
const _isStorage = u => /^[KMGT]?B$/i.test(u);
const _has       = (id, ...terms) => terms.some(t => id.includes(t));

const MATCHERS = [
  { key: 'cpu',          test: (id, u)     => _has(id, 'cpu') && u === '%' },
  { key: 'memory',       test: (id, u)     => _has(id, 'memory', 'ram') && u === '%' },
  { key: 'temperature',  test: (id, u, dc) => dc === 'temperature' },
  { key: 'network_in',   test: (id, u)     => _has(id, '_rx', 'net_in', 'download', 'network_in') && _isFlow(u) },
  { key: 'network_out',  test: (id, u)     => _has(id, '_tx', 'net_out', 'upload', 'network_out') && _isFlow(u) },
  { key: 'disk_read',    test: (id, u)     => _has(id, 'read', 'disk_r') && _isFlow(u) },
  { key: 'disk_write',   test: (id, u)     => _has(id, 'write', 'disk_w') && _isFlow(u) },
  { key: 'storage_free', test: (id, u)     => _has(id, 'free', 'available', 'volume') && _isStorage(u) },
  { key: 'uptime',       test: (id, u, dc) => _has(id, 'uptime', 'up_time') || dc === 'duration' },
  { key: 'disks_total',  test: (id, u)     => _has(id, 'disk', 'drive') && _has(id, 'total', 'count') },
  { key: 'disks_healthy',test: (id, u)     => _has(id, 'disk', 'drive') && _has(id, 'healthy', 'good', 'normal', 'ready') },
  { key: 'status',       test: (id, u, dc) => id.startsWith('binary_sensor.') && _has(id, 'online', 'status', 'connected', 'running') },
];

// ── Action sections (for per-tile interaction config) ────────────────────────
const ACTION_SECTIONS = [
  { key: 'cpu',           label: 'CPU'          },
  { key: 'memory',        label: 'Memory'        },
  { key: 'temperature',   label: 'Temperature'   },
  { key: 'network_in',    label: 'Network In'    },
  { key: 'network_out',   label: 'Network Out'   },
  { key: 'disk_read',     label: 'Disk Read'     },
  { key: 'disk_write',    label: 'Disk Write'    },
  { key: 'disks_healthy', label: 'Disks'         },
  { key: 'storage_free',  label: 'Storage'       },
  { key: 'uptime',        label: 'Uptime'        },
];

const ACTION_FORM_SCHEMA = [
  { name: 'tap_action',        label: 'Tap Action',        selector: { ui_action: {} } },
  { name: 'hold_action',       label: 'Hold Action',       selector: { ui_action: {} } },
  { name: 'double_tap_action', label: 'Double Tap Action', selector: { ui_action: {} } },
];

// ── GUI editor schema ─────────────────────────────────────────────────────────
const EDITOR_SCHEMA = [
  { name: 'name',  label: 'Card Name', selector: { text: {} } },
  {
    name: 'brand', label: 'Device Icon',
    selector: {
      select: {
        options: [
          { value: 'qnap',         label: 'QNAP NAS'       },
          { value: 'synology',     label: 'Synology NAS'   },
          { value: 'server',       label: 'Server'         },
          { value: 'desktop',      label: 'Desktop / PC'   },
          { value: 'container',    label: 'Container'      },
          { value: 'raspberry_pi', label: 'Raspberry Pi'   },
          { value: 'generic',      label: 'Generic Device' },
        ],
      },
    },
  },
  {
    name: 'theme', label: 'Visual Style',
    selector: {
      select: {
        options: [
          { value: 'standard',   label: 'Standard (Vibrant)' },
          { value: 'futuristic', label: 'Futuristic (Neon)'  },
        ],
      },
    },
  },
  { name: 'device',     label: 'HA Device (auto-discovers all sensors)', selector: { device: {} } },
  { name: 'max_cpu',    label: 'CPU gauge max (%)',      selector: { number: { min: 1, max: 200, step: 1, mode: 'box' } } },
  { name: 'max_memory', label: 'Memory gauge max (%)',   selector: { number: { min: 1, max: 200, step: 1, mode: 'box' } } },
  { name: 'max_temp',   label: 'Temperature gauge max (°)', selector: { number: { min: 1, max: 150, step: 1, mode: 'box' } } },
  {
    name: 'history_hours',
    label: 'Sparkline history',
    selector: {
      select: {
        options: [
          { value: 1,   label: 'Last 1 hour'   },
          { value: 24,  label: 'Last 24 hours' },
          { value: 168, label: 'Last 7 days'   },
        ],
      },
    },
  },
  {
    name: 'exclude_sections',
    label: 'Hide sections',
    selector: {
      select: {
        multiple: true,
        options: [
          { value: 'header', label: 'Header (icon / name / status)'       },
          { value: 'top',    label: 'Top row (CPU / Memory / Temp)'       },
          { value: 'mid',    label: 'Mid row (Network / Disk I/O)'        },
          { value: 'bot',    label: 'Bottom row (Disks / Storage / Uptime)' },
        ],
      },
    },
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

// ── GUI editor class ──────────────────────────────────────────────────────────
class NasGraphCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config        = {};
    this._hass          = null;
    this._mainForm      = null;
    this._pickerMap     = {};
    this._actionFormMap = {};
  }

  connectedCallback() {
    if (!this.shadowRoot.children.length) this._buildDOM();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._mainForm) this._mainForm.hass = hass;
    for (const p of Object.values(this._pickerMap))     p.hass = hass;
    for (const f of Object.values(this._actionFormMap)) f.hass = hass;
  }

  setConfig(config) {
    this._config = { ...config };
    if (!this._mainForm) return;
    this._mainForm.data = this._flatData();
    for (const f of ENTITY_FIELDS) {
      if (this._pickerMap[f.key]) this._pickerMap[f.key].value = config.entities?.[f.key] ?? '';
    }
    for (const s of ACTION_SECTIONS) {
      if (this._actionFormMap[s.key]) this._actionFormMap[s.key].data = this._actionData(s.key);
    }
  }

  _flatData() {
    const { entities: _e, actions: _a, ...flat } = this._config;
    return flat;
  }

  _actionData(key) {
    return {
      tap_action:        this._config.actions?.[key]?.tap_action        ?? { action: 'more-info' },
      hold_action:       this._config.actions?.[key]?.hold_action       ?? { action: 'none' },
      double_tap_action: this._config.actions?.[key]?.double_tap_action ?? { action: 'none' },
    };
  }

  _buildDOM() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-expansion-panel { margin-top: 8px; }
        .hint { font-size: 12px; color: var(--secondary-text-color); padding: 4px 4px 8px; }
        .entity-row { margin-bottom: 8px; }
        .action-section { margin: 4px 0 12px; }
        .action-section-lbl {
          font-size: 12px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .5px; color: var(--secondary-text-color);
          padding: 8px 0 6px;
          border-bottom: 1px solid var(--divider-color);
          margin-bottom: 4px;
        }
        .action-section-lbl:first-child { padding-top: 2px; }
      </style>
      <div id="main-slot"></div>
      <div id="entity-slot"></div>
      <div id="action-slot"></div>`;

    // ── Main ha-form ──────────────────────────────────────────────────────
    const form = document.createElement('ha-form');
    form.hass   = this._hass;
    form.data   = this._flatData();
    form.schema = EDITOR_SCHEMA;
    form.computeLabel = s => s.label ?? s.name;
    form.addEventListener('value-changed', e => {
      this._config = { ...this._config, ...e.detail.value };
      this._fire();
    });
    this.shadowRoot.querySelector('#main-slot').appendChild(form);
    this._mainForm = form;

    // ── Entity overrides panel ────────────────────────────────────────────
    const entityPanel = document.createElement('ha-expansion-panel');
    entityPanel.header = 'Entity overrides (optional)';
    entityPanel.setAttribute('outlined', '');

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Use overrides only when auto-discovery picks the wrong entity.';
    entityPanel.appendChild(hint);

    for (const field of ENTITY_FIELDS) {
      const row    = document.createElement('div');
      row.className = 'entity-row';
      const picker = document.createElement('ha-entity-picker');
      picker.hass              = this._hass;
      picker.label             = field.label;
      picker.value             = this._config.entities?.[field.key] ?? '';
      picker.includeDomains    = [field.domain];
      picker.allowCustomEntity = true;
      picker.style.width       = '100%';
      picker.addEventListener('value-changed', e => {
        const entities = { ...(this._config.entities ?? {}) };
        const v = e.detail.value;
        if (v) entities[field.key] = v; else delete entities[field.key];
        this._config = { ...this._config, entities };
        this._fire();
      });
      row.appendChild(picker);
      entityPanel.appendChild(row);
      this._pickerMap[field.key] = picker;
    }
    this.shadowRoot.querySelector('#entity-slot').appendChild(entityPanel);

    // ── Interactions panel ────────────────────────────────────────────────
    const actionPanel = document.createElement('ha-expansion-panel');
    actionPanel.header = 'Interactions';
    actionPanel.setAttribute('outlined', '');

    const actionHint = document.createElement('p');
    actionHint.className = 'hint';
    actionHint.textContent = 'Configure what happens when you tap, hold, or double-tap each tile.';
    actionPanel.appendChild(actionHint);

    for (const section of ACTION_SECTIONS) {
      const lbl = document.createElement('div');
      lbl.className = 'action-section-lbl';
      lbl.textContent = section.label;
      actionPanel.appendChild(lbl);

      const aForm = document.createElement('ha-form');
      aForm.hass         = this._hass;
      aForm.data         = this._actionData(section.key);
      aForm.schema       = ACTION_FORM_SCHEMA;
      aForm.computeLabel = s => s.label ?? s.name;
      aForm.addEventListener('value-changed', e => {
        const actions = { ...(this._config.actions ?? {}) };
        actions[section.key] = { ...(actions[section.key] ?? {}), ...e.detail.value };
        this._config = { ...this._config, actions };
        this._fire();
      });
      actionPanel.appendChild(aForm);
      this._actionFormMap[section.key] = aForm;
    }
    this.shadowRoot.querySelector('#action-slot').appendChild(actionPanel);
  }

  _fire() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config } },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('nas-graph-card-editor', NasGraphCardEditor);

// ── Main card class ───────────────────────────────────────────────────────────
class NasGraphCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._history           = {};
    this._config            = {};
    this._hass              = null;
    this._resolvedEntities  = {};
    this._lastHistoryFetch  = 0;
    this._fetchingHistory   = false;

    // ── Delegated tap / hold / double-tap listeners ───────────────────────
    let _holdTimer = null;
    let _holdFired = false;
    let _tapCount  = 0;
    let _tapTimer  = null;

    const _clearHold = () => {
      if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
    };

    this.shadowRoot.addEventListener('pointerdown', e => {
      const tile = e.target.closest('[data-action]');
      if (!tile) return;
      _holdFired = false;
      _holdTimer = setTimeout(() => {
        _holdFired = true;
        this._dispatchAction(tile, 'hold');
      }, 500);
    }, { passive: true });

    this.shadowRoot.addEventListener('pointerup',     _clearHold, { passive: true });
    this.shadowRoot.addEventListener('pointerleave',  _clearHold, { passive: true });
    this.shadowRoot.addEventListener('pointercancel', _clearHold, { passive: true });

    this.shadowRoot.addEventListener('click', e => {
      if (_holdFired) { _holdFired = false; return; }
      const tile = e.target.closest('[data-action]');
      if (!tile) return;

      const key     = tile.dataset.action;
      const dta     = this._config.actions?.[key]?.double_tap_action;
      const hasDoubleTap = dta && dta.action !== 'none';

      if (hasDoubleTap) {
        _tapCount++;
        clearTimeout(_tapTimer);
        if (_tapCount >= 2) {
          _tapCount = 0;
          this._dispatchAction(tile, 'double_tap');
        } else {
          _tapTimer = setTimeout(() => {
            _tapCount = 0;
            this._dispatchAction(tile, 'tap');
          }, 250);
        }
      } else {
        this._dispatchAction(tile, 'tap');
      }
    });
  }

  _dispatchAction(element, actionType) {
    const key      = element.dataset.action;
    const entityId = element.dataset.entity || undefined;

    const sectionActions = this._config.actions?.[key] ?? {};
    const defaultAction  = actionType === 'tap' ? (entityId ? 'more-info' : 'none') : 'none';
    const actionCfg      = sectionActions[`${actionType}_action`] ?? { action: defaultAction };

    if (!actionCfg || actionCfg.action === 'none') return;

    const config = {
      entity:            entityId,
      tap_action:        sectionActions.tap_action        ?? { action: entityId ? 'more-info' : 'none' },
      hold_action:       sectionActions.hold_action       ?? { action: 'none' },
      double_tap_action: sectionActions.double_tap_action ?? { action: 'none' },
    };

    this.dispatchEvent(new CustomEvent('hass-action', {
      bubbles: true, composed: true,
      detail: { config, action: actionType },
    }));
  }

  static getConfigElement() {
    return document.createElement('nas-graph-card-editor');
  }

  static getStubConfig() {
    return { name: 'My NAS', brand: 'qnap', theme: 'standard', entities: {} };
  }

  setConfig(config) {
    const prevHours = this._config.history_hours;
    this._config = {
      theme:            'standard',
      name:             'NAS',
      brand:            'qnap',
      max_cpu:          100,
      max_memory:       100,
      max_temp:         80,
      history_hours:    1,
      entities:         {},
      exclude_sections: [],
      actions:          {},
      ...config,
    };
    if (Number(config.history_hours) !== Number(prevHours)) {
      this._lastHistoryFetch = 0;
      this._history = {};
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._buildResolvedEntities();
    this._pushHistory();

    const hours     = Number(this._config.history_hours) || 1;
    const refreshMs = hours <= 1 ? 2 * 60_000 : 5 * 60_000;
    const now       = Date.now();
    if (now - this._lastHistoryFetch > refreshMs) {
      this._lastHistoryFetch = now;
      this._fetchHistory();  // async — re-renders when done
    }

    this._render();
  }

  // ── History from HA API ───────────────────────────────────────────────────
  async _fetchHistory() {
    if (this._fetchingHistory || !this._hass) return;
    this._fetchingHistory = true;
    try {
      const hours = Number(this._config.history_hours) || 1;
      const start = new Date(Date.now() - hours * 3_600_000).toISOString();
      const NUMERIC_KEYS = ['cpu','memory','temperature','network_in','network_out','disk_read','disk_write'];
      const entityIds    = NUMERIC_KEYS.map(k => this._resolvedEntities[k]).filter(Boolean);
      if (!entityIds.length) return;

      const qs   = `minimal_response=true&no_attributes=true&filter_entity_id=${entityIds.join(',')}`;
      const data = await this._hass.callApi('GET', `history/period/${start}?${qs}`);
      if (!Array.isArray(data)) return;

      for (const entityHistory of data) {
        if (!Array.isArray(entityHistory) || !entityHistory.length) continue;
        const entityId = entityHistory[0].entity_id;
        if (!entityId) continue;
        const key = NUMERIC_KEYS.find(k => this._resolvedEntities[k] === entityId);
        if (!key) continue;
        const values = entityHistory.map(s => parseFloat(s.state)).filter(v => !isNaN(v));
        if (values.length) this._history[key] = this._resample(values, MAX_HISTORY);
      }
      this._render();
    } catch (_) {
      // fall back to in-memory history pushed by _pushHistory()
    } finally {
      this._fetchingHistory = false;
    }
  }

  _resample(values, n) {
    if (!values.length) return [];
    if (values.length <= n) return values;
    const bucketSize = values.length / n;
    return Array.from({ length: n }, (_, i) => {
      const s     = Math.floor(i * bucketSize);
      const e     = Math.ceil((i + 1) * bucketSize);
      const slice = values.slice(s, e);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
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

  // ── History tracking ──────────────────────────────────────────────────────
  _pushHistory() {
    ['cpu','memory','temperature','network_in','network_out','disk_read','disk_write'].forEach(k => {
      const id = this._resolvedEntities[k];
      if (!id) return;
      const st = this._hass.states[id];
      if (!st) return;
      const v = parseFloat(st.state);
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
      if (v >= 1_024)     return `${(v / 1_024).toFixed(1)} KB/s`;
      return `${v} B/s`;
    }
    return `${v.toFixed(1)}${u ? ' ' + u : ''}`;
  }

  _fmtUptime() {
    const raw = this._state('uptime', null);
    if (!raw || raw === 'N/A') return '?';
    const v = parseFloat(raw);
    if (isNaN(v)) return raw;
    const d = Math.floor(v / 86400);
    const h = Math.floor((v % 86400) / 3600);
    const m = Math.floor((v % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  _fmtStorage() {
    const raw = this._state('storage_free', null);
    if (!raw || raw === 'N/A') return null;
    const v = parseFloat(raw);
    if (isNaN(v)) return raw;
    const u = (this._unit('storage_free') || '').trim().toUpperCase();
    const MULT = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15 };
    const bytes = v * (MULT[u] ?? 1);
    if (bytes >= 1e15) return `${(bytes / 1e15).toFixed(2)} PB`;
    if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
    if (bytes >= 1e9)  return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6)  return `${(bytes / 1e6).toFixed(0)} MB`;
    return `${Math.round(bytes / 1e3)} KB`;
  }

  _getDiskStats() {
    const t = this._state('disks_total', null);
    const h = this._state('disks_healthy', null);
    if (t) return { total: t, healthy: h ?? t };

    const deviceId = this._config.device ? this._resolveDeviceId(this._config.device) : null;
    if (!deviceId || !this._hass.entities) return null;

    const drives = Object.entries(this._hass.entities).filter(([eid, info]) => {
      if (info.device_id !== deviceId) return false;
      const id = eid.toLowerCase();
      return _has(id, 'drive', 'disk', 'hdd', 'ssd') &&
             _has(id, 'health', 'status', 'smart', 'temp', 'condition');
    });
    if (!drives.length) return null;

    const GOOD    = new Set(['ready', 'ok', 'good', 'normal', 'healthy', 'active', 'passed']);
    const healthy = drives.filter(([eid]) => GOOD.has((this._hass.states[eid]?.state ?? '').toLowerCase())).length;
    return { total: drives.length, healthy };
  }

  // ── Cursor helper ─────────────────────────────────────────────────────────
  _cursor(key, entityId) {
    const tapCfg = this._config.actions?.[key]?.tap_action
      ?? { action: entityId ? 'more-info' : 'none' };
    return tapCfg.action !== 'none' ? 'pointer' : 'default';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  _render() {
    const cfg          = this._config;
    const isFuturistic = (cfg.theme || 'standard') === 'futuristic';
    const brand        = (cfg.brand || 'qnap').toLowerCase();
    const online       = this._isOnline();
    const excluded     = new Set(cfg.exclude_sections ?? []);

    const tileBg     = isFuturistic ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.20)';
    const tileBorder = isFuturistic ? 'border:1px solid rgba(60,80,180,0.18);' : '';

    const cpuV = parseFloat(this._state('cpu',         '0')) || 0;
    const memV = parseFloat(this._state('memory',      '0')) || 0;
    const tmpV = parseFloat(this._state('temperature', '0')) || 0;

    const diskStats  = this._getDiskStats();
    const storageFmt = this._fmtStorage();
    const uptimeFmt  = this._fmtUptime();
    const icon       = ICONS[brand] ?? ICONS.generic;

    // ── Top 3 tiles ────────────────────────────────────────────────────────
    const topTiles = isFuturistic
      ? [
          this._gaugeTile(cpuV, cfg.max_cpu,    C.cpu,         'CPU',      '%',  'cpu',         tileBg, tileBorder),
          this._gaugeTile(memV, cfg.max_memory,  C.memory,      'Memory',   '%',  'memory',      tileBg, tileBorder),
          this._gaugeTile(tmpV, cfg.max_temp,    C.temperature, 'Sys Temp', '°C', 'temperature', tileBg, tileBorder),
        ].join('')
      : [
          this._stdTile('CPU',         cpuV, '%',  C.cpu,         'cpu',         tileBg, tileBorder),
          this._stdTile('Memory',      memV, '%',  C.memory,      'memory',      tileBg, tileBorder),
          this._stdTile('System Temp', tmpV, '°C', C.temperature, 'temperature', tileBg, tileBorder),
        ].join('');

    // ── Mid row ────────────────────────────────────────────────────────────
    const MID_METRICS = [
      { key: 'network_in',  label: 'Net In',    color: C.network_in  },
      { key: 'network_out', label: 'Net Out',   color: C.network_out },
      { key: 'disk_read',   label: 'Disk Read', color: C.disk_read   },
      { key: 'disk_write',  label: 'Disk Write',color: C.disk_write  },
    ].filter(m => this._resolvedEntities[m.key]);

    const midTiles = MID_METRICS.map(m =>
      this._flowTile(m.label, this._fmtFlow(m.key), m.color, m.key, tileBg, tileBorder, isFuturistic)
    ).join('');
    const midCols = MID_METRICS.length || 2;

    // ── Bottom row items ───────────────────────────────────────────────────
    const disksEid   = this._resolvedEntities.disks_healthy   || '';
    const storageEid = this._resolvedEntities.storage_free    || '';
    const uptimeEid  = this._resolvedEntities.uptime          || '';

    const botItems = [
      diskStats  ? `<div class="bot-item" data-action="disks_healthy" data-entity="${disksEid}" style="cursor:${this._cursor('disks_healthy', disksEid)}">
          <span class="bot-ico">💿</span>
          <div><div class="bot-lbl">Disks</div><div class="bot-val">${diskStats.healthy} / ${diskStats.total}</div><div class="bot-sub">Healthy</div></div>
        </div>` : '',
      storageFmt ? `<div class="bot-item" data-action="storage_free" data-entity="${storageEid}" style="cursor:${this._cursor('storage_free', storageEid)}">
          <span class="bot-ico">🗄️</span>
          <div><div class="bot-lbl">Storage</div><div class="bot-val">${storageFmt}</div><div class="bot-sub">Free</div></div>
        </div>` : '',
      uptimeFmt !== '?' ? `<div class="bot-item" data-action="uptime" data-entity="${uptimeEid}" style="cursor:${this._cursor('uptime', uptimeEid)}">
          <span class="bot-ico">⏱️</span>
          <div><div class="bot-lbl">Uptime</div><div class="bot-val">${uptimeFmt}</div><div class="bot-sub">Up</div></div>
        </div>` : '',
    ].filter(Boolean).join('');

    const arrowStyle = isFuturistic
      ? `color:${C.cpu.spark};text-shadow:0 0 10px ${C.cpu.spark},0 0 20px ${C.cpu.spark};`
      : 'color:rgba(255,255,255,0.3);';

    // ── styles.card injection ──────────────────────────────────────────────
    const cardStyles = cfg.styles?.card
      ? Object.entries(cfg.styles.card).map(([k, v]) => `${k}:${v};`).join('')
      : '';

    this.shadowRoot.innerHTML = `
      ${cardStyles ? `<style>ha-card{${cardStyles}}</style>` : ''}
      <style>
        :host { display:block; }
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        ha-card {
          overflow: hidden;
          ${isFuturistic ? '--ha-card-border-color: rgba(80,100,200,0.25);' : ''}
        }
        .card {
          background: transparent;
          padding: 16px;
          color: var(--primary-text-color, #fff);
          font-family: var(--primary-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif);
        }
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
        .top-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:10px; }
        .mid-grid { display:grid; grid-template-columns:repeat(${midCols},1fr); gap:8px; margin-bottom:10px; }
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
        .arrow { flex-shrink:0; font-size:22px; padding:2px 0 2px 6px; user-select:none; ${arrowStyle} }
      </style>

      <ha-card>
        <div class="card">
          ${!excluded.has('header') ? `
          <div class="hdr">
            ${icon}
            <div class="hdr-text">
              <div class="hdr-name">${cfg.name || 'NAS'}</div>
              <div class="hdr-status"><div class="dot"></div><span>${online ? 'Online' : 'Offline'}</span></div>
            </div>
          </div>` : ''}

          ${!excluded.has('top') ? `<div class="top-grid">${topTiles}</div>` : ''}

          ${!excluded.has('mid') && midTiles ? `<div class="mid-grid">${midTiles}</div>` : ''}

          ${!excluded.has('bot') && botItems ? `
          <div class="bot-row">
            ${botItems}
            <span class="arrow">›</span>
          </div>` : ''}
        </div>
      </ha-card>`;
  }

  // ── Tile builders ─────────────────────────────────────────────────────────
  _stdTile(label, value, unit, colors, key, bg, border) {
    const entityId = this._resolvedEntities[key] || '';
    const hist     = this._history[key] || [value];
    const spark    = sparkSVG(hist, colors.spark, 200, 36);
    const cursor   = this._cursor(key, entityId);
    return `<div data-action="${key}" data-entity="${entityId}" style="background:${bg};${border}border-radius:12px;padding:12px;overflow:hidden;cursor:${cursor};">
      <div style="font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:${colors.label};margin-bottom:4px;">${label}</div>
      <div style="font-size:28px;font-weight:700;line-height:1.1;margin-bottom:8px;">${value}<span style="font-size:14px;font-weight:400;opacity:.8;">${unit}</span></div>
      <div style="line-height:0;">${spark}</div>
    </div>`;
  }

  _gaugeTile(value, max, colors, label, unit, key, bg, border) {
    const entityId = this._resolvedEntities[key] || '';
    const pct      = value / (max || 100);
    const gauge    = gaugeSVG(pct, colors.spark, label, `${value}${unit}`, 108);
    const hist     = this._history[key] || [value];
    const spark    = sparkSVG(hist, colors.spark, 120, 24);
    const cursor   = this._cursor(key, entityId);
    return `<div data-action="${key}" data-entity="${entityId}" style="background:${bg};${border}border-radius:12px;padding:10px 8px 8px;display:flex;flex-direction:column;align-items:center;overflow:hidden;cursor:${cursor};">
      ${gauge}
      <div style="width:100%;line-height:0;margin-top:4px;">${spark}</div>
    </div>`;
  }

  _flowTile(label, value, colors, key, bg, border, isFuturistic) {
    const entityId = this._resolvedEntities[key] || '';
    const hist     = this._history[key] || [0];
    const spark    = sparkSVG(hist, colors.spark, 120, 26);
    const glow     = isFuturistic ? `text-shadow:0 0 8px ${colors.label};` : '';
    const cursor   = this._cursor(key, entityId);
    return `<div data-action="${key}" data-entity="${entityId}" style="background:${bg};${border}border-radius:10px;padding:9px 10px;overflow:hidden;cursor:${cursor};">
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
    description:      'Real-time NAS monitoring for QNAP & Synology — sparklines, circular gauges, theme-aware',
    preview:          true,
    documentationURL: 'https://github.com/andrejkurlovic/nas-graph-card',
  });
}

console.info(
  `%c NAS-GRAPH-CARD %c v${VERSION} `,
  'background:#0d1524;color:#06b6d4;padding:2px 8px;border-radius:3px 0 0 3px;font-weight:bold',
  'background:#06b6d4;color:#fff;padding:2px 8px;border-radius:0 3px 3px 0;font-weight:bold',
);
