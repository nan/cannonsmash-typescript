import * as THREE from 'three';
import { assetManager } from './AssetManager';
import { Game } from './Game';
import { UIManager } from './UIManager';
import { CAMERA_FOV } from './CameraManager';
import { AILevel, TICK } from './constants';

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
  scene.background = new THREE.Color(0xaaaaaa);

  // --- Asset and Game Loading ---
  console.log("Loading assets...");
  const assets = await assetManager.loadAll();
  console.log("Assets loaded!");

  // --- UI and Event Handling Setup ---
  const demoScreen = document.getElementById('demo-screen');
  const pauseScreen = document.getElementById('pause-screen');

  if (!demoScreen || !pauseScreen) {
    console.error("UI elements not found!");
    return;
  }

  const uiManager = new UIManager(demoScreen, pauseScreen);

  const game = new Game(scene, camera, assets, uiManager);

  // --- Event Listeners ---

  document.addEventListener('gameended', () => {
    uiManager.showDemoScreen();
  });

  demoScreen.addEventListener('click', (event) => {
    // Prevent starting if clicking on the select element itself
    if ((event.target as HTMLElement).tagName === 'SELECT' || (event.target as HTMLElement).tagName === 'LABEL') {
      return;
    }

    const levelSelect = document.getElementById('level-select') as HTMLSelectElement;
    const p1TypeSelect = document.getElementById('p1-type-select') as HTMLSelectElement;
    const p2TypeSelect = document.getElementById('p2-type-select') as HTMLSelectElement;

    const level = parseInt(levelSelect.value) as AILevel;
    const p1Type = parseInt(p1TypeSelect.value);
    const p2Type = parseInt(p2TypeSelect.value);

    game.start(level, p1Type as any, p2Type as any);
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
      if (!game.isDemo()) {
        game.pause();
        uiManager.showPauseScreen();
      }
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      if (document.pointerLockElement === canvas) {
        // If pointer is locked, pressing Esc should release it, which triggers the pause screen
        document.exitPointerLock();
      } else if (game.getIsPaused()) {
        // If the game is paused, pressing Esc again should return to the demo screen.
        game.returnToDemo();
      }
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

  let accumulatedTime = 0;
  let totalRealTime = 0;
  let totalGameTime = 0;

  function render() {
    const deltaTime = clock.getDelta();
    accumulatedTime += deltaTime;
    totalRealTime += deltaTime;

    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    // Fixed time step update
    // Prevent spiral of death by clamping max steps per frame
    let steps = 0;
    const MAX_STEPS = 5;
    while (accumulatedTime >= TICK && steps < MAX_STEPS) {
      // Save current positions as previous for interpolation
      game.ball.prevPosition.copy(game.ball.mesh.position);
      game.player1.prevPosition.copy(game.player1.mesh.position);
      game.player2.prevPosition.copy(game.player2.mesh.position);

      game.update(TICK);
      totalGameTime += TICK;
      accumulatedTime -= TICK;
      steps++;
    }

    // If we are still behind, just discard the time to avoid spiraling
    if (accumulatedTime >= TICK) {
      accumulatedTime = 0;
    }

    // --- Interpolation for smooth rendering ---
    const alpha = Math.max(0, Math.min(1, accumulatedTime / TICK));
    
    // Store true physics positions using temp vectors to avoid GC
    const ballTruePos = game.ball.mesh.position.clone();
    const p1TruePos = game.player1.mesh.position.clone();
    const p2TruePos = game.player2.mesh.position.clone();

    // Interpolate mesh positions for this frame
    game.ball.mesh.position.lerpVectors(game.ball.prevPosition, ballTruePos, alpha);
    game.player1.mesh.position.lerpVectors(game.player1.prevPosition, p1TruePos, alpha);
    game.player2.mesh.position.lerpVectors(game.player2.prevPosition, p2TruePos, alpha);

    renderer.render(scene, camera);

    // Restore true physics positions for the next update
    game.ball.mesh.position.copy(ballTruePos);
    game.player1.mesh.position.copy(p1TruePos);
    game.player2.mesh.position.copy(p2TruePos);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main().catch(console.error);
