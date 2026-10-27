import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.resolve(__dirname, '../public/models');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const ASSETS = [
  // Nature & Foliage (Kenney CC0)
  {
    name: 'tree_default.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/nature/tree_default.glb'
  },
  {
    name: 'tree_detailed.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/nature/tree_detailed.glb'
  },
  {
    name: 'tree_plateau.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/nature/tree_plateau.glb'
  },
  {
    name: 'tree_small.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/nature/tree_small.glb'
  },
  {
    name: 'tree_tall.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/nature/tree_tall.glb'
  },
  {
    name: 'plant_bush.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/nature/plant_bush.glb'
  },
  {
    name: 'rock_largeA.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/nature/rock_largeA.glb'
  },
  {
    name: 'rock_smallA.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/nature/rock_smallA.glb'
  },
  {
    name: 'flower_redA.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/nature/flower_redA.glb'
  },
  {
    name: 'flower_yellowA.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/nature/flower_yellowA.glb'
  },
  // Characters (Kenney CC0 mini-characters)
  {
    name: 'character-male-a.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/mini-characters/character-male-a.glb'
  },
  {
    name: 'character-female-a.glb',
    url: 'https://raw.githubusercontent.com/shorepine/kenney/main/3d/mini-characters/character-female-a.glb'
  }
];

async function downloadAll() {
  console.log(`Downloading ${ASSETS.length} assets to ${targetDir}...`);
  for (const asset of ASSETS) {
    const dest = path.join(targetDir, asset.name);
    if (fs.existsSync(dest)) {
      console.log(`[Exists] ${asset.name}`);
      continue;
    }
    console.log(`[Fetching] ${asset.name} from ${asset.url}`);
    try {
      const res = await fetch(asset.url);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${asset.url}: status ${res.status}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      console.log(`[Saved] ${asset.name} (${buffer.length} bytes)`);
    } catch (err) {
      console.error(`Error downloading ${asset.name}:`, err);
    }
  }
  console.log('Finished downloading 3D assets shortlist.');
}

downloadAll();
