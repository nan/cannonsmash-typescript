import * as THREE from 'three';
import { assetManager } from './AssetManager';
import { Game } from './Game';

async function main() {
  const canvas = document.querySelector('#c');
  if (!canvas) {
    return;
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  const clock = new THREE.Clock();

  const fov = 75;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 100;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 2;
  camera.position.y = 1;

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

  const game = new Game(scene, assets);


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
