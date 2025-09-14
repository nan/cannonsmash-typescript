import * as THREE from 'three';
import { assetManager } from './AssetManager';
import { Game } from './Game';
import { UIManager } from './UIManager';
import { CAMERA_FOV, TABLE_LENGTH, TABLE_WIDTH } from './constants';

async function main() {
  // --- Basic Three.js setup ---
  const canvas = document.querySelector('#c');
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  const clock = new THREE.Clock();

  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 100;
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, near, far);
  camera.position.set(0, 1.2, 2.5);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x333333);

  {
    // A more standard PBR-friendly lighting setup.
    // Hemisphere light for soft, global illumination.
    const skyColor = 0xB1E1FF;  // light blue
    const groundColor = 0x404040; // dark gray
    const hemisphereIntensity = 1.5;
    const hemisphereLight = new THREE.HemisphereLight(skyColor, groundColor, hemisphereIntensity);
    scene.add(hemisphereLight);

    // Point light for direct highlights and shadows.
    const pointLight = new THREE.PointLight(0xffffff, 8, 0, 2); // color, intensity, distance, decay
    pointLight.position.set(-TABLE_WIDTH, 3.0, TABLE_LENGTH / 2);
    scene.add(pointLight);
  }

  // --- Asset and Game Loading ---
  console.log("Loading assets...");
  const assets = await assetManager.loadAll();
  console.log("Assets loaded!");

  const game = new Game(scene, camera, assets);

  // --- UI and Event Handling Setup ---
  const demoScreen = document.getElementById('demo-screen');
  const pauseScreen = document.getElementById('pause-screen');

  if (!demoScreen || !pauseScreen) {
    console.error("UI elements not found!");
    return;
  }

  const uiManager = new UIManager(demoScreen, pauseScreen);

  // --- Event Listeners ---

  demoScreen.addEventListener('click', () => {
    game.start();
    uiManager.showGameScreen();
    canvas.requestPointerLock();
  });

  pauseScreen.addEventListener('click', () => {
    canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      // Lock was acquired. If the game was paused, resume it.
      if (game.getIsPaused()) {
        game.resume();
      }
      uiManager.showGameScreen();
    } else {
      // Lock was lost
      if (!game.getIsDemo()) {
        game.pause();
        uiManager.showPauseScreen();
      }
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape' && game.getIsPaused()) {
      game.returnToDemo();
      uiManager.showDemoScreen();
    }
  });

  // --- Render Loop ---

  function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  function render() {
    const deltaTime = clock.getDelta();

    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    game.update(deltaTime);

    renderer.render(scene, camera);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main().catch(console.error);
