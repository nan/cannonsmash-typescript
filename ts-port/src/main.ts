import * as THREE from 'three';
import { assetManager } from './AssetManager';
import { Game } from './Game';
import { UIManager } from './UIManager';
import { AMB_LIGHT_COLOR, AMB_LIGHT_INTENSITY, CAMERA_FOV, DIR_LIGHT_COLOR, DIR_LIGHT_INTENSITY, DIR_LIGHT_POSITION } from './constants';

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
    const light = new THREE.DirectionalLight(DIR_LIGHT_COLOR, DIR_LIGHT_INTENSITY);
    light.position.copy(DIR_LIGHT_POSITION);
    scene.add(light);
    const ambientLight = new THREE.AmbientLight(AMB_LIGHT_COLOR, AMB_LIGHT_INTENSITY);
    scene.add(ambientLight);
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

  document.addEventListener('gameended', () => {
    uiManager.showDemoScreen();
  });

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
