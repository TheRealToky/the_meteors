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
import { i18n, t, onLanguageChange } from './i18n';
import { AgeCounter } from './ui/AgeCounter';
import { LanguagePicker } from './ui/LanguagePicker';
import { CharacterRig } from './world/CharacterRig';

// Station ages for the life path
const SCENE_AGES: Record<SceneId, number> = {
  intro: 0,
  birth: 0,
  growing: 15,
  marriage: 24,
  divorce: 41,
  death: 75,
  outro: 75,
};

// Station hint i18n keys for honest NISR CRVS context
const SCENE_HINT_KEYS: Record<SceneId, string> = {
  intro: 'intro.caption',
  birth: 'birth.caption',
  growing: 'growing.caption',
  marriage: 'marriage.caption',
  divorce: 'divorce.caption',
  death: 'death.caption',
  outro: 'outro.nisr_citation',
};

async function bootstrap() {
  // 1. Initialize i18n dictionary and active locale
  await i18n.init();

  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  const sceneContainer = document.getElementById('scene-container') as HTMLElement;
  const stationHint = document.getElementById('station-hint') as HTMLElement;
  const ageCounterSlot = document.getElementById('hud-age-counter-slot') as HTMLElement;

  // 2. Initialize HUD Age Counter
  const ageCounter = new AgeCounter({
    initialAge: SCENE_AGES.intro,
    container: ageCounterSlot,
  });

  // 3. Initialize Language Picker
  const langSelectorEl = document.querySelector('.lang-selector') as HTMLElement;
  new LanguagePicker({
    container: langSelectorEl,
    onChange: (lang) => {
      director.setLanguage(lang);
      updateStaticUI(director.getCurrentSceneId());
    },
  });

  // 4. Initialize Core Three.js Renderer, Scene, Camera
  const { renderer, scene, camera } = createRenderer({ canvas });
  setupResize(camera, renderer);

  // 5. Setup Lighting and Fog
  setupLighting(scene);

  // 6. Create Procedural Rwanda Terraced Hills Terrain
  const terrain = createTerrain();
  scene.add(terrain.mesh);

  // 7. Create Life Path Spline and 3D Ribbon Walkway
  const pathCurve = createPathCurve(terrain.getHeight);
  const pathMesh = createPathMesh(pathCurve);
  scene.add(pathMesh.mesh);

  // 8. Create Camera Rail along the path
  const cameraRail = new CameraRail(camera, pathCurve);

  // 9. Create CharacterRig — walks on the rail, snapped to terrain
  const characterRig = new CharacterRig({
    curve: pathCurve,
    scene,
    sex: 'female', // updated after start-screen sex choice below
  });
  characterRig.setLifeStage(0); // newborn at birth station
  // Load async; director.start() awaits first scene which triggers after this
  characterRig.load().catch((err) => console.warn('[CharacterRig] load error:', err));

  // 10. Create Nature Props Manager (Kenney CC0 assets)
  const propsManager = createPropsManager(scene, terrain.getHeight);
  propsManager.load().catch((err) => console.warn('Props load warning:', err));

  // 10. Helper to update static UI labels on language / scene changes
  function updateStaticUI(currentScene: SceneId) {
    const sceneKeys: Record<SceneId, string> = {
      intro: 'nav.intro',
      birth: 'nav.birth',
      growing: 'nav.growing',
      marriage: 'nav.marriage',
      divorce: 'nav.divorce',
      death: 'nav.death',
      outro: 'nav.outro',
    };

    (Object.keys(sceneKeys) as SceneId[]).forEach((id) => {
      const stepEl = document.getElementById(`btn-${id}`);
      if (stepEl) {
        const labelEl = stepEl.querySelector('.step-label');
        if (labelEl) {
          labelEl.textContent = t(sceneKeys[id]);
        }
      }
    });

    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
      btnNext.textContent = t('nav.next');
    }

    const btnPrev = document.getElementById('btn-prev');
    if (btnPrev) {
      btnPrev.textContent = t('nav.prev');
    }

    if (stationHint && SCENE_HINT_KEYS[currentScene]) {
      stationHint.textContent = t(SCENE_HINT_KEYS[currentScene]);
    }
  }

  // 11. Initialize Director (State Machine)
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

      // Smoothly update character age in HUD counter
      const targetAge = SCENE_AGES[sceneId] ?? 0;
      ageCounter.setAge(targetAge, 1.5);

      // Update station hint & labels
      updateStaticUI(sceneId);
    },
  });

  // Listen to i18n language changes to refresh global UI
  onLanguageChange(() => {
    updateStaticUI(director.getCurrentSceneId());
  });

  // Initial UI text sync
  updateStaticUI(director.getCurrentSceneId());

  // 12. Wire UI Interactions
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

  // Keyboard navigation (Left / Right arrow keys)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      director.nextScene();
    } else if (e.key === 'ArrowLeft') {
      director.prevScene();
    }
  });

  // 13. Start Director and Animation Loop
  await director.start();

  const loop = new AnimationLoop(renderer, scene, camera);
  loop.addCallback((dt, elapsed) => {
    director.update(dt, elapsed);

    // Keep character at the same rail progress as the camera rail
    characterRig.setProgress(cameraRail.getProgress());
    characterRig.update(dt);

    // Suppress the unused-variable warning on elapsed when no scene needs it
    void elapsed;
  });
  loop.start();
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => {
    console.error('Fatal initialization error:', err);
  });
});
