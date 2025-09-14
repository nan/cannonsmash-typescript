import * as THREE from 'three';
import { assetManager } from './AssetManager';
import { Game } from './Game';
import { CAMERA_FOV } from './constants';

async function main() {
  const canvas = document.querySelector('#c');
  if (!canvas) {
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
    const color = 0xFFFFFF;
    const intensity = 3;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(-1, 2, 4);
    scene.add(light);
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
  }

  console.log("Loading assets...");
  const assets = await assetManager.loadAll();
  console.log("Assets loaded!");

  const game = new Game(scene, camera, assets);

  const demoScreen = document.getElementById('demo-screen');
  const pauseScreen = document.getElementById('pause-screen');

  if (demoScreen) {
    demoScreen.addEventListener('click', () => {
      game.isDemo = false;
      demoScreen.classList.add('hidden');
      (canvas as HTMLCanvasElement).requestPointerLock();
    });
  }

  // Handle pointer lock changes
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      // Lock acquired
      if (!game.isDemo) {
        game.isPaused = false;
        pauseScreen?.classList.add('hidden');
      }
    } else {
      // Lock lost
      if (!game.isDemo) {
        game.isPaused = true;
        pauseScreen?.classList.remove('hidden');
      }
    }
  });

  // Handle click on pause screen to resume
  if (pauseScreen) {
    pauseScreen.addEventListener('click', () => {
      if (game.isPaused) {
        (canvas as HTMLCanvasElement).requestPointerLock();
      }
    });
  }

  // Handle ESC key press during pause to return to demo
  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape' && game.isPaused) {
      game.isDemo = true;
      game.isPaused = false;
      pauseScreen?.classList.add('hidden');
      demoScreen?.classList.remove('hidden');
    }
  });


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
