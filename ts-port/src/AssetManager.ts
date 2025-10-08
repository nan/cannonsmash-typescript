import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DATLoader } from './DATLoader';
// A structure to hold all game assets
export interface GameAssets {
    baseModels: { [modelName: string]: THREE.BufferGeometry };
    playerModel?: GLTF;
}

class AssetManager {
    private manager = new THREE.LoadingManager();
    private datLoader = new DATLoader(this.manager);
    private gltfLoader = new GLTFLoader(this.manager);

    private readonly modelNames = [
        "head", "chest", "hip", "racket",
        "Rshoulder", "Rarm", "Relbow", "Rforearm", "Rhand",
        "Rthigh", "Rshin", "Rfoot",
        "Lshoulder", "Larm", "Lelbow", "Lforearm", "Lhand",
        "Lthigh", "Lshin", "Lfoot"
    ];

    public async loadAll(): Promise<GameAssets> {
        console.log('AssetManager: Starting asset loading...');

        // Load all assets in parallel
        const [baseModels, playerModel] = await Promise.all([
            this.loadBaseModels(),
            this.loadPlayerModel()
        ]);

        console.log('AssetManager: All assets loaded.');
        return { baseModels, playerModel };
    }

    private async loadPlayerModel(): Promise<GLTF> {
        const path = 'player.glb'; // The file is in the public folder
        return new Promise<GLTF>((resolve, reject) => {
            this.gltfLoader.load(path, (gltf) => {
                console.log('AssetManager: Player model loaded successfully.');
                resolve(gltf);
            }, undefined, (error) => {
                 console.error('AssetManager: An error happened while loading the player model', error);
                 reject(error);
            });
        });
    }

    private async loadBaseModels(): Promise<{ [modelName: string]: THREE.BufferGeometry }> {
        const models: { [modelName: string]: THREE.BufferGeometry } = {};
        const promises: Promise<void>[] = [];

        for (const name of this.modelNames) {
            const path = `Parts/model/${name}01.dat`;
            const promise = new Promise<void>((resolve, reject) => {
                this.datLoader.load(path, (geometry) => {
                    models[name] = geometry;
                    resolve();
                }, undefined, reject);
            });
            promises.push(promise);
        }

        await Promise.all(promises);
        return models;
    }

}

// Export a singleton instance
export const assetManager = new AssetManager();
