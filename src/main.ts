import { createRenderer } from './core/renderer';
import { AnimationLoop } from './core/loop';
import { setupResize } from './core/resize';
import { setupLighting } from './world/lighting';
import { createTerrain } from './world/terrain';
import { createPathCurve, createPathMesh } from './world/path';
import { createPropsManager } from './world/props';
import { CameraRail } from './director/cameraRail';
import { Director } from './director/director';
import { SceneId } from './director/types';

async function bootstrap() {
  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  const sceneContainer = document.getElementById('scene-container') as HTMLElement;
  const stationHint = document.getElementById('station-hint') as HTMLElement;

  // 1. Initialize Core Three.js Renderer, Scene, Camera
  const { renderer, scene, camera } = createRenderer({ canvas });
  setupResize(camera, renderer);

  // 2. Setup Lighting and Fog
  setupLighting(scene);

  // 3. Create Procedural Rwanda Terraced Hills Terrain
  const terrain = createTerrain();
  scene.add(terrain.mesh);

  // 4. Create Life Path Spline and 3D Ribbon Walkway
  const pathCurve = createPathCurve(terrain.getHeight);
  const pathMesh = createPathMesh(pathCurve);
  scene.add(pathMesh.mesh);

  // 5. Create Camera Rail along the path
  const cameraRail = new CameraRail(camera, pathCurve);

  // 6. Create Nature Props Manager (Kenney CC0 assets)
  const propsManager = createPropsManager(scene, terrain.getHeight);
  propsManager.load().catch((err) => console.warn('Props load warning:', err));

  // Station hint text map
  const STATION_HINTS: Record<SceneId, string> = {
    intro: '14.1M Rwandans. One life path through terraced hills.',
    birth: 'Station 1: 356,838 births registered in Rwanda in 2025.',
    growing: 'Station 2: Youth, childhood education, and demographic momentum.',
    marriage: 'Station 3: 50,256 marriages registered in 2025 across Rwanda.',
    divorce: 'Station 4: 4,479 registered divorces and duration patterns.',
    death: 'Station 5: 39,355 registered deaths and leading health causes.',
    outro: 'Station 6: Sources, methodology notes, and CRVS insights.',
  };

  // 7. Initialize Director (State Machine)
  const director = new Director({
    scene,
    camera,
    cameraRail,
    uiContainer: sceneContainer,
    onSceneChange: (sceneId) => {
      // Update active nav step indicator
      document.querySelectorAll('.station-step').forEach((btn) => {
        const target = (btn as HTMLElement).dataset.scene;
        if (target === sceneId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Update station hint
      if (stationHint && STATION_HINTS[sceneId]) {
        stationHint.textContent = STATION_HINTS[sceneId];
      }
    },
  });

  // 8. Wire UI Interactions
  document.querySelectorAll('.station-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetScene = (btn as HTMLElement).dataset.scene as SceneId;
      if (targetScene) {
        director.goToScene(targetScene);
      }
    });
  });

  const btnNext = document.getElementById('btn-next');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      director.nextScene();
    });
  }

  const btnPrev = document.getElementById('btn-prev');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      director.prevScene();
    });
  }

  // Language buttons
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lang-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const lang = (btn as HTMLElement).dataset.lang as 'en' | 'rw' | 'fr';
      if (lang) {
        director.setLanguage(lang);
      }
    });
  });

  // Keyboard navigation (Left / Right arrow keys)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      director.nextScene();
    } else if (e.key === 'ArrowLeft') {
      director.prevScene();
    }
  });

  // 9. Start Director and Animation Loop
  await director.start();

  const loop = new AnimationLoop(renderer, scene, camera);
  loop.addCallback((dt, elapsed) => {
    director.update(dt, elapsed);
  });
  loop.start();
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => {
    console.error('Fatal initialization error:', err);
  });
});
