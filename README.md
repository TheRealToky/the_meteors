# Life Path (Inzira y'Ubuzima) 🇷🇼

> **An interactive 3D demographic journey through Rwanda's Civil Registration and Vital Statistics (CRVS) 2025 Report.**  
> Created by **The Meteors** for the **NISR Infographic Competition 2025**.

[![License: CC0 / MIT](https://img.shields.io/badge/License-CC0%20%2F%20MIT-emerald.svg)](ATTRIBUTION.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r170-black.svg)](https://threejs.org/)
[![D3.js](https://img.shields.io/badge/D3.js-v7.9-orange.svg)](https://d3js.org/)
[![Languages](https://img.shields.io/badge/i18n-English%20%7C%20Kinyarwanda%20%7C%20Fran%C3%A7ais-indigo.svg)](public/i18n/)

---

## 🌟 Overview

**Life Path (*Inzira y'Ubuzima*)** is a web-based 3D interactive infographic experience that immerses users in the demographic journey of an individual living in Rwanda. Rather than viewing dry tables and static charts, the player travels along a scenic mountain pathway winding through Rwanda's iconic "land of a thousand hills" (*Imisozi Igihumbi*), encountering real demographic milestones at each station:

```
[0. Intro] ➔ [1. Birth] ➔ [2. Youth] ➔ [3. Marriage] ➔ [4. Divorce] ➔ [5. Death] ➔ [6. Outro]
```

Every single visualization and figure shown throughout the experience is powered directly by data published in the **National Institute of Statistics of Rwanda (NISR) Vital Statistics Report 2025**.

---

## 🎨 Visual & Experience Design

- **Dreamlike Art Direction:** Inspired by *Sky: Children of the Light*, featuring a pastel watercolor atmospheric sky dome, procedural cloud banks, floating spore particles, and soothing lighting.
- **Rwandan Landscape & Architecture:** Procedural stepped agricultural terraces (*Amaterasi*), winding dirt roads, traditional conical royal pavilions (*Inzu y'Umwami*), thatched structures, stone cairns, and highland flora.
- **Stylized Traveler:** An animated hooded nomad character traversing the path along a smooth Catmull-Rom rail, scaling organically across life stages.
- **Glassmorphism HUD & Responsive D3 Overlays:** Real-time synchronized HUD showing age progression, station steps, accessible D3.js demographic graphs, and dual language switchers.

---

## 📊 Life Stations & NISR CRVS 2025 Data Mappings

| Station | Stage | Age | NISR Data Source | Interactive Experience |
|---|---|---|---|---|
| **0. Intro** | Population Overview | — | Figure 1, Annex 1 | Demographic pyramid (14.1M population), language choice (EN / RW / FR), sex selection. |
| **1. Birth** | Arrival & Naming | 0 | Sheet 10.3, Annex 2 | Golden-angle point cloud representing ~350,000 registered births; highlights the player's personal birth marker and reveals authentic name distributions. |
| **2. Youth** | Growing Up | 15 | Report Context | Cinematic timelapse journey through Rwandan tea terraces and homesteads. |
| **3. Marriage** | Union | 24 | Table 18, Figure 30 | Interactive age-at-marriage distribution slider; comparison between groom and bride peak marriage ages. |
| **4. Divorce** | Separation | 41 | Table 27, Table 28 | Marriage duration histogram and civil divorce trend indicators. |
| **5. Death** | Reflection | 75 | Figure 19, Table 12, Table 17 | Age-at-death distributions and side-by-side facility vs. community cause-of-death breakdowns. |
| **6. Outro** | Methodology & Caveats | — | NISR CRVS 2025 | Complete citations, methodology explanations, data caveats, and replay options. |

---

## ⚖️ Data Integrity & Statistical Rules

Our project strictly adheres to rigorous statistical ethics and validation rules:

1. **Zero Hardcoded Statistics:** Every statistic displayed is loaded at runtime from validated JSON files generated directly from the official NISR Excel tables.
2. **"Registered" vs. "Occurring":** Acknowledges registration completeness honest labels (e.g., birth registration completeness is ~93%, while death registration completeness is ~50%). We never confuse registered events with total occurrences.
3. **Divorce Ratio Distinction:** Avoids dividing 2025 registered divorces by 2025 registered marriages to prevent misleading divorce rate figures, as they originate from different marriage cohorts.
4. **Cause of Death Separation:** Keeps health facility and community verbal autopsy causes strictly distinct, as community reports reflect different diagnostic contexts.
5. **Full Trilingual Localization:** English (`en`), Kinyarwanda (`rw`), and French (`fr`) with dynamic `Intl.NumberFormat` localized number rendering.

---

## 🛠️ Tech Stack

- **3D Engine:** [Three.js](https://threejs.org/) (vanilla WebGL, procedural shaders, Catmull-Rom camera rail, instanced nature meshes).
- **Interactive Visualizations:** [D3.js](https://d3js.org/) (v7 SVG/HTML overlays).
- **Animation & Transitions:** [GSAP 3](https://greensock.com/gsap/) (smooth camera transitions and timeline sequencing).
- **Build System:** [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/) (strict mode).
- **Data Pipeline:** Python 3 (Pandas, OpenPyXL, Pandera) for clean, reproducible sheet extraction and checksum validation.
- **3D Asset Kits:** Curated CC0 assets from Kay Lousberg, Quaternius, and Kenney (see [ATTRIBUTION.md](ATTRIBUTION.md)).

---

## 📁 Repository Structure

```text
├── data/
│   └── raw/
│       └── Final_Tables_CRVS_2025_0.xlsx    # Source of truth (NISR CRVS 2025)
├── pipeline/
│   ├── extract.py                           # Python ETL: Excel -> /public/data/*.json
│   └── validate.py                          # Data sums, checksums & i18n validator
├── public/
│   ├── data/                                # Clean, pipeline-generated JSON datasets
│   │   ├── intro.json
│   │   ├── birth.json
│   │   ├── marriage.json
│   │   ├── divorce.json
│   │   ├── death.json
│   │   └── meta.json
│   ├── i18n/                                # Localized string dictionaries
│   │   ├── en.json                          # English
│   │   ├── rw.json                          # Kinyarwanda
│   │   └── fr.json                          # Français
│   ├── models/                              # Optimised CC0 3D assets (characters, nature, props)
│   └── textures/                            # Skyboxes and procedural texture maps
├── src/
│   ├── core/                                # WebGL renderer, animation loop, resize handler
│   ├── director/                            # Camera rail, state machine, GSAP timelines
│   ├── i18n/                                # i18n controller, reactive formatting, locale store
│   ├── scenes/                              # Modular scene controllers (Intro, Birth, etc.)
│   ├── ui/                                  # D3 visualizations, HUD age counter, language picker
│   ├── world/                               # Procedural terrain, path ribbon, sky dome, lighting
│   ├── main.ts                              # Application bootstrap
│   └── style.css                            # Glassmorphism design tokens & styles
├── docs/
│   └── asset-inventory.md                   # 3D asset audit, triangle counts & sources
├── ATTRIBUTION.md                           # Open-source licenses & model credits
├── CLAUDE.md                                # Architectural principles & design rules
├── package.json                             # Node.js dependencies & scripts
└── vite.config.ts                           # Vite configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **Python:** 3.10+ (for data pipeline scripts)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TheRealToky/the_meteors.git
   cd the_meteors
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Install Python pipeline requirements (optional, data is already generated):**
   ```bash
   pip install pandas openpyxl pandera
   ```

---

## 💻 Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Starts the Vite local development server (with HMR) at `http://localhost:5173`. |
| `npm run build` | Compiles TypeScript and creates optimized production assets in `/dist`. |
| `npm run preview` | Locally serves the production bundle from `/dist`. |
| `npm run typecheck` | Validates TypeScript types across the codebase with `tsc --noEmit`. |
| `python pipeline/extract.py` | Extracts statistics from `data/raw/` into clean `/public/data/*.json` files. |
| `python pipeline/validate.py` | Validates data consistency, checksums, and trilingual translation completeness. |

---

## 🔍 Deep Links & Debug Flags

You can jump directly to specific scenes, languages, or debug views using URL query parameters:

- **Direct Station Navigation:**
  - `?scene=intro` — Demographic overview & pyramid
  - `?scene=birth` — 350k birth particle cloud
  - `?scene=growing` — Youth timelapse
  - `?scene=marriage` — Marriage distribution
  - `?scene=divorce` — Divorce duration histogram
  - `?scene=death` — Mortality histogram & causes of death
  - `?scene=outro` — Citations & caveats
- **Language Preselection:** `?lang=en`, `?lang=rw`, or `?lang=fr`
- **Sex Preselection:** `?sex=female` or `?sex=male`
- **Developer Debug Tools:** `?debug=1` (activates FPS/Draw call monitor and lil-gui scene controls)

---

## 📜 Citations & Sources

- **Primary Source:** National Institute of Statistics of Rwanda (NISR), *Vital Statistics Report 2025 (Civil Registration and Vital Statistics System)*.
- **Territory Data:** NISR Population and Housing Census (RPHC5) 2022 projections.
- **Asset Attribution:** All 3D models and textures are licensed under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) by Kay Lousberg, Quaternius, and Kenney. See [ATTRIBUTION.md](ATTRIBUTION.md) for individual file details.

---

## 👥 The Team — The Meteors

Built with ❤️ for the **NISR Infographics Competition 2025** by **The Meteors** (African Leadership University — ALU).