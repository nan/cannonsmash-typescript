import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFAnimationPointerExtension } from '@needle-tools/three-animation-pointer';
// A structure to hold all game assets
export interface GameAssets {
    playerModel?: GLTF;
}

class AssetManager {
    private manager = new THREE.LoadingManager();
    private gltfLoader = new GLTFLoader(this.manager);

    public async loadAll(): Promise<GameAssets> {
        console.log('AssetManager: Starting asset loading...');

        // Load all assets in parallel
        const playerModel = await this.loadPlayerModel();

        console.log('AssetManager: All assets loaded.');
        return { playerModel };
    }

    private async loadPlayerModel(): Promise<GLTF> {
        const path = 'player.glb'; // The file is in the public folder
        return new Promise<GLTF>((resolve, reject) => {
            const loader = new GLTFLoader(this.manager);
            loader.register((parser) => new GLTFAnimationPointerExtension(parser));
            loader.load(path, (gltf) => {
                console.log('AssetManager: Player model loaded successfully.');
                resolve(gltf);
            }, undefined, (error) => {
                 console.error('AssetManager: An error happened while loading the player model', error);
                 reject(error);
            });
        });
    }

}

// Export a singleton instance
export const assetManager = new AssetManager();
