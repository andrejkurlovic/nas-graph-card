# NAS Graph Card for Home Assistant

A real-time monitoring card for NAS devices (and servers, desktops, containers, Raspberry Pis) with live sparkline graphs, circular gauges, and full Home Assistant theme support including frosted glass.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![HA minimum version](https://img.shields.io/badge/Home%20Assistant-%E2%89%A52023.1-blue.svg)](https://www.home-assistant.io/)

---

## Preview

| Standard (Vibrant) | Futuristic (Neon) |
|---|---|
| Dark card with coloured labels and sparkline history charts | Neon circular arc gauges with glowing sparklines |

> The card background, border, shadow and frosted-glass blur are controlled entirely by your active HA theme — no card-level option needed. Switch themes and the card follows automatically.

---

## Installation

### Option A — HACS (recommended)

1. Make sure [HACS](https://hacs.xyz) is installed in your Home Assistant.
2. Click the button below to add this repository:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=andrejkurlovic&repository=nas-graph-card&category=plugin)

3. Search for **NAS Graph Card** and click **Download**.
4. Restart Home Assistant.
5. Add the card to any dashboard — it will appear in the card picker.

---

### Option B — Manual

1. Download [`nas-graph-card.js`](https://github.com/andrejkurlovic/nas-graph-card/raw/main/nas-graph-card.js).

2. Copy it into your HA config folder:
   ```
   /config/www/nas-graph-card/nas-graph-card.js
   ```

3. Register it as a Lovelace resource.

   **GUI:** Settings → Dashboards → ⋮ menu → Resources → **+ Add Resource**
   - URL: `/local/nas-graph-card/nas-graph-card.js`
   - Resource type: **JavaScript module**

   **YAML** (`configuration.yaml` or `ui-lovelace.yaml`):
   ```yaml
   lovelace:
     resources:
       - url: /local/nas-graph-card/nas-graph-card.js
         type: module
   ```

4. Restart Home Assistant (or reload Lovelace resources).

---

## Adding the card

Open any dashboard, click **+ Add Card**, scroll to the bottom and pick **NAS Graph Card**.

The visual editor opens automatically. Pick your HA device from the **HA Device** dropdown and all sensors are discovered automatically. Done.

---

## Configuration

### GUI editor (recommended)

| Field | Description |
|---|---|
| **Card Name** | Label shown in the header |
| **Device Icon** | QNAP · Synology · Server · Desktop · Container · Raspberry Pi · Generic |
| **Visual Style** | Standard (Vibrant) or Futuristic (Neon) |
| **HA Device** | Your NAS / server device — sensors are auto-discovered |
| **CPU / Memory / Temp max** | Top of the gauge scale (default 100 / 100 / 80) |
| **Entity overrides** | Optional — correct any sensor the auto-discovery got wrong |

### YAML

**Minimal (auto-discovery):**
```yaml
type: custom:nas-graph-card
name: QNAP
brand: qnap
theme: standard
device: "My QNAP NAS"   # device name as shown in Settings → Devices
```

**Futuristic theme:**
```yaml
type: custom:nas-graph-card
name: Synology
brand: synology
theme: futuristic
device: "Synology DS923+"
max_temp: 70
```

**Override a single entity discovered incorrectly:**
```yaml
type: custom:nas-graph-card
name: QNAP
brand: qnap
theme: standard
device: "My QNAP NAS"
entities:
  storage_free: sensor.qnap_volume_2_free_space   # override only this one
```

**Fully manual (no device needed):**
```yaml
type: custom:nas-graph-card
name: QNAP
brand: qnap
theme: standard
entities:
  status:        binary_sensor.qnap_online
  cpu:           sensor.qnap_cpu_usage
  memory:        sensor.qnap_memory_usage
  temperature:   sensor.qnap_system_temperature
  network_in:    sensor.qnap_network_rx
  network_out:   sensor.qnap_network_tx
  disk_read:     sensor.qnap_disk_read
  disk_write:    sensor.qnap_disk_write
  disks_total:   sensor.qnap_total_disks
  disks_healthy: sensor.qnap_healthy_disks
  storage_free:  sensor.qnap_volume_free
  uptime:        sensor.qnap_uptime
```

### All config options

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | string | `NAS` | Header title |
| `brand` | string | `qnap` | Icon: `qnap` `synology` `server` `desktop` `container` `raspberry_pi` `generic` |
| `theme` | string | `standard` | `standard` or `futuristic` |
| `device` | string | — | HA device name or device ID for auto-discovery |
| `max_cpu` | number | `100` | CPU gauge scale maximum |
| `max_memory` | number | `100` | Memory gauge scale maximum |
| `max_temp` | number | `80` | Temperature gauge scale maximum |
| `entities` | map | `{}` | Entity overrides (see keys below) |

**Entity keys:** `status` · `cpu` · `memory` · `temperature` · `network_in` · `network_out` · `disk_read` · `disk_write` · `disks_total` · `disks_healthy` · `storage_free` · `uptime`

---

## Frosted glass

There is no `frosted_glass` option — the card never overrides `ha-card`'s background, border or `backdrop-filter`. Install any glass theme (e.g. **Mushroom**, **iOS Dark**, or any theme that sets `--ha-card-background` to a semi-transparent value) and the card inherits it automatically.

---

## Supported integrations

Auto-discovery works with any HA integration that creates sensor entities for the device. Tested with:

- **QNAP** (built-in HA integration)
- **Synology DSM** (built-in HA integration)
- **Glances** (server / desktop)
- **System Monitor** (local machine)
- Any integration that exposes CPU %, memory %, temperature, and network sensors

---

## Requirements

- Home Assistant **2023.1** or newer
- HACS **1.6** or newer (for HACS install)
