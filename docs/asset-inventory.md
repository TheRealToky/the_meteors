# Asset Inventory — Life Path 3D Asset Integration

This inventory documents all 3D assets selected and integrated into **Life Path** (Rwanda CRVS 2025 Interactive Infographic) from the external library at:
`D:\PC DISAINE\TOKY\ALU\TERM_6\MATH_FOR_ML\NISR_INFOGRAPHICS\ASSETS`

All assets have been audited for geometry complexity, texture dependencies, compatibility, visual aesthetic cohesion with the *Sky: Children of the Light* dreamlike art direction, and licensing compliance.

---

## 1. Character & Animations (KayKit Adventurers 2.0 FREE)

- **Source Collection:** `KayKit_Adventurers_2.0_FREE\KayKit_Adventurers_2.0_FREE\`
- **Author:** Kay Lousberg (https://www.kaylousberg.com)
- **License:** Creative Commons Zero (CC0 1.0 Universal - Public Domain)

| Model / Asset | Original Path | Repo Path | Format | Size | Verts | Skeleton / Anims | Dimensions (W x H x D) | Intended Use & Integration Notes |
|---|---|---|---|---|---|---|---|---|
| **Rogue_Hooded** | `Characters\gltf\Rogue_Hooded.glb` | `public/models/characters/Rogue_Hooded.glb` | GLB (binary glTF) | 381 KB | 5,909 | Rig_Medium Skeleton | 1.94m × 2.17m × 1.10m | Traveler character model. Beautiful hooded silhouette with cloak and mask, perfectly complementing the *Sky: Children of the Light* aesthetic. Adapted with skin/robe materials, celestial eye glow, and dynamic cloth physics. |
| **rogue_texture** | `Characters\gltf\rogue_texture.png` | `public/models/characters/rogue_texture.png` | PNG | 15 KB | N/A | Texture map | 512 × 512 | Texture atlas for the hooded traveler model. |
| **Rig_Medium_MovementBasic** | `Animations\gltf\Rig_Medium\Rig_Medium_MovementBasic.glb` | `public/models/characters/Rig_Medium_MovementBasic.glb` | GLB | 689 KB | 6,675 | 11 Animations (`Walking_A`, `Walking_B`, `Walking_C`, `Running_A`, `Running_B`, etc.) | Rig_Medium | Compatible skeletal animation clips extracted for character locomotion on the path rail. |
| **Rig_Medium_General** | `Animations\gltf\Rig_Medium\Rig_Medium_General.glb` | `public/models/characters/Rig_Medium_General.glb` | GLB | 828 KB | 6,675 | 15 Animations (`Idle_A`, `Idle_B`, `Death_A`, `Spawn_Ground`, etc.) | Rig_Medium | Idle and station interaction animations matching the Rig_Medium bone hierarchy. |

---

## 2. Vegetation & Nature (Quaternius Stylized Nature MegaKit)

- **Source Collection:** `Stylized Nature MegaKit[Standard]\`
- **Author:** Quaternius (https://quaternius.com)
- **License:** Creative Commons Zero (CC0 1.0 Universal - Public Domain)

| Model / Asset | Original Path | Repo Path | Format | Size | Verts | Skeletons | Dimensions (W x H x D) | Intended Use & Integration Notes |
|---|---|---|---|---|---|---|---|---|
| **CommonTree_1** | `glTF\CommonTree_1.gltf` + `.bin` | `public/models/nature/CommonTree_1.gltf` | glTF + bin | 3.8 KB + 491 KB | 9,458 | Static | 4.31m × 7.26m × 4.58m | Majestic highland canopy tree placed along the upper ridges of the Rwandan terraced hills. Multi-instanced for high rendering performance. |
| **CommonTree_2** | `glTF\CommonTree_2.gltf` + `.bin` | `public/models/nature/CommonTree_2.gltf` | glTF + bin | 3.8 KB + 423 KB | 8,107 | Static | 4.46m × 7.64m × 4.28m | Rounded lush highland tree, varied alongside `CommonTree_1` for natural forest diversity. |
| **TwistedTree_1** | `glTF\TwistedTree_1.gltf` + `.bin` | `public/models/nature/TwistedTree_1.gltf` | glTF + bin | 3.8 KB + 732 KB | 14,064 | Static | 13.52m × 16.73m × 11.55m | Grand ancient feature tree towering over the terraced hills, framing dramatic camera transitions. |
| **DeadTree_1** | `glTF\DeadTree_1.gltf` + `.bin` | `public/models/nature/DeadTree_1.gltf` | glTF + bin | 2.2 KB + 422 KB | 8,036 | Static | 6.15m × 9.50m × 5.75m | Evocative, serene ancestral tree placed near Station 5 (Death / Ancestral memory), harmonized with cool twilight palette. |
| **Bush_Common** | `glTF\Bush_Common.gltf` + `.bin` | `public/models/nature/Bush_Common.gltf` | glTF + bin | 2.1 KB + 91 KB | 1,800 | Static | 1.91m × 1.58m × 1.97m | Lush terraced hillside shrubbery lining slope drop-offs and framing viewing vistas. |
| **Bush_Common_Flowers** | `glTF\Bush_Common_Flowers.gltf` + `.bin` | `public/models/nature/Bush_Common_Flowers.gltf` | glTF + bin | 3.6 KB + 128 KB | 2,515 | Static | 1.91m × 1.58m × 1.97m | Flowering highland bush providing vibrant pastel accents along the journey path. |
| **Flower_3_Group** | `glTF\Flower_3_Group.gltf` + `.bin` | `public/models/nature/Flower_3_Group.gltf` | glTF + bin | 3.6 KB + 27 KB | 581 | Static | 1.49m × 2.05m × 1.59m | Wildflower meadow clumps scattered along gentle grassy contours. |
| **Flower_4_Group** | `glTF\Flower_4_Group.gltf` + `.bin` | `public/models/nature/Flower_4_Group.gltf` | glTF + bin | 3.6 KB + 62 KB | 1,302 | Static | 1.78m × 2.49m × 1.37m | Golden highland blossoms marking stations and scenic overlooks. |
| **Plant_1_Big** | `glTF\Plant_1_Big.gltf` + `.bin` | `public/models/nature/Plant_1_Big.gltf` | glTF + bin | 2.0 KB + 16 KB | 360 | Static | 2.89m × 3.76m × 3.13m | Broad-leafed tropical foliage framing valley floors and water contours. |
| **Rock_Medium_1** | `glTF\Rock_Medium_1.gltf` + `.bin` | `public/models/nature/Rock_Medium_1.gltf` | glTF + bin | 1.8 KB + 13 KB | 351 | Static | 3.23m × 2.26m × 2.99m | Stylized volcanic granite boulders embedded into hill terraces with smooth shading. |
| **RockPath_Round_Small_1** | `glTF\RockPath_Round_Small_1.gltf` + `.bin` | `public/models/nature/RockPath_Round_Small_1.gltf` | glTF + bin | 1.8 KB + 71 KB | 2,036 | Static | 1.06m × 0.11m × 1.48m | Natural stone pavers used for station entrances and ceremonial ground. |
| **Nature Textures** | `glTF\*.png` | `public/models/nature/*.png` | PNG | ~24 MB | N/A | Texture maps | 512 × 512 to 2048 × 2048 | Associated diffuse and normal maps copied into local directory for resolution of glTF relative URIs. |

---

## 3. Sky & Atmosphere (Kenney Skyboxes)

- **Source Collection:** `kenney_skyboxes\Skyboxes\`
- **Author:** Kenney (https://kenney.nl)
- **License:** Creative Commons Zero (CC0 1.0 Universal - Public Domain)

| Texture Asset | Original Path | Repo Path | Format | Size | Resolution | Mapping | Intended Use & Integration Notes |
|---|---|---|---|---|---|---|---|
| **skybox-day.png** | `Skyboxes\skybox-day.png` | `public/textures/skyboxes/skybox-day.png` | PNG | 1.05 MB | 4096 × 2048 | Equirectangular | Daytime clear sky with soft clouds for Station 2 (Growing Up / Vibrant Youth). |
| **skybox-morning.png** | `Skyboxes\skybox-morning.png` | `public/textures/skyboxes/skybox-morning.png` | PNG | 899 KB | 4096 × 2048 | Equirectangular | Golden hour morning dawn for Station 1 (Birth) and Intro overview. |
| **skybox-night.png** | `Skyboxes\skybox-night.png` | `public/textures/skyboxes/skybox-night.png` | PNG | 1.09 MB | 4096 × 2048 | Equirectangular | Celestial starlit night panorama for Station 5 (Death & Legacy). |

---

## 4. Architecture, Props & Furniture (Kenney Suburban, Furniture, Roads & Car Kits)

- **Source Collections:** `kenney_city-kit-suburban_20\`, `kenney_furniture-kit\`, `kenney_car-kit\`
- **Author:** Kenney (https://kenney.nl)
- **License:** Creative Commons Zero (CC0 1.0 Universal - Public Domain)

| Model / Asset | Original Path | Repo Path | Format | Size | Verts | Dimensions (W x H x D) | Intended Use & Integration Notes |
|---|---|---|---|---|---|---|---|
| **bench** | `kenney_furniture-kit\Models\GLTF format\bench.glb` | `public/models/props/bench.glb` | GLB | 10.7 KB | 230 | 0.40m × 0.47m × 0.20m | Wooden rest bench placed near contemplation stations (Birth waiting area, Divorce reflection, Outro). |
| **desk** | `kenney_furniture-kit\Models\GLTF format\desk.glb` | `public/models/props/desk.glb` | GLB | 15.0 KB | 380 | 0.73m × 0.38m × 0.56m | Traditional registration signing desk inside the civil marriage pavilion (Station 3). |
| **books** | `kenney_furniture-kit\Models\GLTF format\books.glb` | `public/models/props/books.glb` | GLB | 6.8 KB | 424 | 0.15m × 0.10m × 0.09m | Civil registration vital statistics logbooks and registry documents on the desk. |
| **chairRounded** | `kenney_furniture-kit\Models\GLTF format\chairRounded.glb` | `public/models/props/chairRounded.glb` | GLB | 17.1 KB | 388 | 0.20m × 0.45m × 0.20m | Seating for registrars and couples inside the marriage station. |
| **fence-low** | `kenney_city-kit-suburban_20\Models\GLB format\fence-low.glb` | `public/models/props/fence-low.glb` | GLB | 18.5 KB | 328 | 1.28m × 0.17m × 0.84m | Rustic terrace boundary fencing marking safe trails and lookout points. |
| **planter** | `kenney_city-kit-suburban_20\Models\GLB format\planter.glb` | `public/models/props/planter.glb` | GLB | 20.3 KB | 360 | 0.40m × 0.18m × 0.30m | Agricultural terrace planters placed at station entrances. |
| **path-stones-messy** | `kenney_city-kit-suburban_20\Models\GLB format\path-stones-messy.glb` | `public/models/props/path-stones-messy.glb` | GLB | 5.4 KB | 72 | 0.16m × 0.01m × 0.36m | Natural scattered stepping stones along the transition between the main path and pavilions. |
| **ambulance** | `kenney_car-kit\Models\GLB format\ambulance.glb` | `public/models/props/ambulance.glb` | GLB | 233 KB | 4,328 | 1.50m × 1.90m × 3.25m | Stylized district community health vehicle placed unobtrusively in the distant background near the birth / health post, grounding the vital statistics narrative. |

---

## 5. Architectural & Narrative Cohesion Strategy

1. **Dreamlike Aesthetic (*Sky: Children of the Light*)**:
   - The primary character uses the hooded and cloaked silhouette (`Rogue_Hooded.glb`), enhanced with smooth shading, soft celestial materials, warm Rwandan skin tones, and dynamic wind-responsive cloth ripples.
   - Skyboxes from Kenney (`skybox-morning.png`, `skybox-day.png`, `skybox-night.png`) provide subtle atmospheric backdrops that blend with our custom shader dome and soft volumetric mist.
2. **Authentic Rwandan Architecture**:
   - Retained the procedural *Inzu y'Umwami* thatched conical pavilions and volcanic stone cairns as key cultural landmarks.
   - Enhanced pavilions with the imported furniture (registration desks, benches, ledger books) to narrate the 2025 civil registration process (birth certificates, marriage licenses, death records).
3. **Optimized Multi-Instancing**:
   - Repeated nature assets (`CommonTree_1`, `CommonTree_2`, `Bush_Common`, `Bush_Common_Flowers`, `Flower_3_Group`, `Rock_Medium_1`) utilize `THREE.InstancedMesh` with smooth geometry normals, keeping GPU draw calls minimal and maintaining 60 FPS on both mobile and desktop.
