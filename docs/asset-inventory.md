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
| **Fern_1** | `glTF\Fern_1.gltf` + `.bin` | `public/models/nature/Fern_1.gltf` | glTF + bin | 2.8 KB + 34 KB | 720 | Static | 2.20m × 0.85m × 2.10m | Forest ferns layered under trees and along terrace banks (matching reference image). |
| **Mushroom_Common** | `glTF\Mushroom_Common.gltf` + `.bin` | `public/models/nature/Mushroom_Common.gltf` | glTF + bin | 2.2 KB + 18 KB | 432 | Static | 0.56m × 0.46m × 0.78m | Bright orange button mushroom clumps lining path edges and boulder roots (signature reference image detail). |
| **Mushroom_Laetiporus** | `glTF\Mushroom_Laetiporus.gltf` + `.bin` | `public/models/nature/Mushroom_Laetiporus.gltf` | glTF + bin | 2.0 KB + 14 KB | 312 | Static | 0.45m × 0.32m × 0.38m | Shelf mushrooms growing on rocks and tree trunks. |
| **Grass_Common_Short** | `glTF\Grass_Common_Short.gltf` + `.bin` | `public/models/nature/Grass_Common_Short.gltf` | glTF + bin | 1.8 KB + 12 KB | 288 | Static | 0.64m × 1.33m × 0.74m | Dense 3D grass tufts lining both sides of the main path rail. |
| **Pebble_Round_1** | `glTF\Pebble_Round_1.gltf` + `.bin` | `public/models/nature/Pebble_Round_1.gltf` | glTF + bin | 1.6 KB + 8 KB | 180 | Static | 0.45m × 0.22m × 0.42m | Scattered smooth river/trail pebbles. |
| **Rock_Medium_1** | `glTF\Rock_Medium_1.gltf` + `.bin` | `public/models/nature/Rock_Medium_1.gltf` | glTF + bin | 1.8 KB + 13 KB | 351 | Static | 3.23m × 2.26m × 2.99m | Stylized volcanic granite boulders embedded into hill terraces with smooth shading. |
| **Rock_Medium_2** | `glTF\Rock_Medium_2.gltf` + `.bin` | `public/models/nature/Rock_Medium_2.gltf` | glTF + bin | 1.8 KB + 15 KB | 384 | Static | 3.05m × 1.90m × 2.48m | Angular cliff rock formation boulder. |
| **RockPath_Round_Small_1** | `glTF\RockPath_Round_Small_1.gltf` + `.bin` | `public/models/nature/RockPath_Round_Small_1.gltf` | glTF + bin | 1.8 KB + 71 KB | 2,036 | Static | 1.06m × 0.11m × 1.48m | Natural stone pavers used for station entrances and ceremonial ground. |
| **Nature Textures** | `glTF\*.png` | `public/models/nature/*.png` | PNG | ~24 MB | N/A | Texture maps | 512 × 512 to 2048 × 2048 | Associated diffuse and normal maps (`Mushrooms.png`, `Grass.png`, `Leaves.png`, etc.). |

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

## 4. Architecture, Props & Built Environment (Kenney Suburban, Roads, Furniture & Car Kits)

- **Source Collections:** `kenney_city-kit-suburban_20\`, `kenney_city-kit-roads\`, `kenney_car-kit\`, `kenney_furniture-kit\`
- **Author:** Kenney (https://kenney.nl)
- **License:** Creative Commons Zero (CC0 1.0 Universal - Public Domain)

| Model / Asset | Original Path | Repo Path | Format | Size | Verts | Dimensions (W x H x D) | Intended Use & Integration Notes |
|---|---|---|---|---|---|---|---|
| **building-type-a** | `kenney_city-kit-suburban_20\Models\GLB format\building-type-a.glb` | `public/models/props/building-type-a.glb` | GLB | 22 KB | 480 | 2.0m × 2.0m × 2.0m | Rural Rwandan hillside homestead cottage in Urugwiro village. |
| **building-type-b** | `kenney_city-kit-suburban_20\Models\GLB format\building-type-b.glb` | `public/models/props/building-type-b.glb` | GLB | 25 KB | 520 | 2.0m × 2.0m × 2.0m | Village homestead and community building. |
| **building-type-e** | `kenney_city-kit-suburban_20\Models\GLB format\building-type-e.glb` | `public/models/props/building-type-e.glb` | GLB | 24 KB | 490 | 2.0m × 2.1m × 2.0m | Terraced hillside residence with warm terracotta roof. |
| **building-type-f** | `kenney_city-kit-suburban_20\Models\GLB format\building-type-f.glb` | `public/models/props/building-type-f.glb` | GLB | 26 KB | 540 | 2.0m × 2.1m × 2.0m | Administrative civil sector building near Marriage station. |
| **van** | `kenney_car-kit\Models\GLB format\van.glb` | `public/models/props/van.glb` | GLB | 185 KB | 3,840 | 2.0m × 2.1m × 2.75m | Rwandan minibus taxi (Matatu / Twegerane) parked along the village road. |
| **truck** | `kenney_car-kit\Models\GLB format\truck.glb` | `public/models/props/truck.glb` | GLB | 192 KB | 3,920 | 2.0m × 2.1m × 2.95m | Agricultural farm pickup truck transporting produce crates. |
| **sedan** | `kenney_car-kit\Models\GLB format\sedan.glb` | `public/models/props/sedan.glb` | GLB | 178 KB | 3,650 | 2.0m × 1.8m × 2.8m | Community civil registration staff vehicle. |
| **ambulance** | `kenney_car-kit\Models\GLB format\ambulance.glb` | `public/models/props/ambulance.glb` | GLB | 233 KB | 4,328 | 1.5m × 1.9m × 3.25m | District community health vehicle near birth station. |
| **road-straight** | `kenney_city-kit-roads\Models\GLB format\road-straight.glb` | `public/models/props/road-straight.glb` | GLB | 12 KB | 240 | 2.0m × 0.2m × 2.0m | Paved rural road spur connecting villages along the terrace shelf. |
| **road-bend** | `kenney_city-kit-roads\Models\GLB format\road-bend.glb` | `public/models/props/road-bend.glb` | GLB | 14 KB | 260 | 2.0m × 0.2m × 2.0m | Road curve segment following natural terrace contours. |
| **light-curved** | `kenney_city-kit-roads\Models\GLB format\light-curved.glb` | `public/models/props/light-curved.glb` | GLB | 16 KB | 310 | 0.4m × 2.8m × 0.8m | Curved rural streetlamp near village entrance. |
| **electricity-pole-single** | `kenney_city-kit-roads\Models\GLB format\electricity-pole-single.glb` | `public/models/props/electricity-pole-single.glb` | GLB | 14 KB | 280 | 0.3m × 3.6m × 0.3m | Wooden telegraph / electrical utility pole across agricultural terraces. |
| **fence** | `kenney_city-kit-suburban_20\Models\GLB format\fence.glb` | `public/models/props/fence.glb` | GLB | 15 KB | 310 | 2.0m × 0.9m × 0.2m | Homestead boundary fence. |
| **fence-1x3** | `kenney_city-kit-suburban_20\Models\GLB format\fence-1x3.glb` | `public/models/props/fence-1x3.glb` | GLB | 12 KB | 240 | 1.5m × 0.9m × 0.2m | Garden boundary fencing. |
| **driveway-short** | `kenney_city-kit-suburban_20\Models\GLB format\driveway-short.glb` | `public/models/props/driveway-short.glb` | GLB | 10 KB | 180 | 2.0m × 0.1m × 1.0m | Stone driveway paving. |
| **tableRound** | `kenney_furniture-kit\Models\GLTF format\tableRound.glb` | `public/models/props/tableRound.glb` | GLB | 12 KB | 280 | 1.0m × 0.7m × 1.0m | Outdoor village gathering table. |
| **cardboardBoxClosed** | `kenney_furniture-kit\Models\GLTF format\cardboardBoxClosed.glb` | `public/models/props/cardboardBoxClosed.glb` | GLB | 6 KB | 120 | 0.5m × 0.5m × 0.5m | Harvest market produce crates. |
| **bench** | `kenney_furniture-kit\Models\GLTF format\bench.glb` | `public/models/props/bench.glb` | GLB | 10.7 KB | 230 | 0.40m × 0.47m × 0.20m | Wooden rest bench placed near contemplation stations. |
| **desk** | `kenney_furniture-kit\Models\GLTF format\desk.glb` | `public/models/props/desk.glb` | GLB | 15.0 KB | 380 | 0.73m × 0.38m × 0.56m | Traditional registration signing desk inside the civil marriage pavilion. |
| **books** | `kenney_furniture-kit\Models\GLTF format\books.glb` | `public/models/props/books.glb` | GLB | 6.8 KB | 424 | 0.15m × 0.10m × 0.09m | Civil registration vital statistics logbooks. |
| **chairRounded** | `kenney_furniture-kit\Models\GLTF format\chairRounded.glb` | `public/models/props/chairRounded.glb` | GLB | 17.1 KB | 388 | 0.20m × 0.45m × 0.20m | Seating for registrars and couples. |
| **fence-low** | `kenney_city-kit-suburban_20\Models\GLB format\fence-low.glb` | `public/models/props/fence-low.glb` | GLB | 18.5 KB | 328 | 1.28m × 0.17m × 0.84m | Terrace overlook boundary fence. |
| **planter** | `kenney_city-kit-suburban_20\Models\GLB format\planter.glb` | `public/models/props/planter.glb` | GLB | 20.3 KB | 360 | 0.40m × 0.18m × 0.30m | Agricultural terrace planters. |

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
