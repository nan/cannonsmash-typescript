import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFAnimationPointerExtension } from '@needle-tools/three-animation-pointer';
import { DATLoader } from './DATLoader';
// A structure to hold all game assets
export interface GameAssets {
    baseModels: { [modelName: string]: THREE.BufferGeometry };
    playerModel?: GLTF;
}

class AssetManager {
    private manager = new THREE.LoadingManager();
    private datLoader = new DATLoader(this.manager);
    private gltfLoader = new GLTFLoader(this.manager).register(parser => new GLTFAnimationPointerExtension(parser));

    private readonly modelNames = [
        "head", "chest", "hip", "racket",
        "Rshoulder", "Rarm", "Relbow", "Rforearm", "Rhand",
        "Rthigh", "Rshin", "Rfoot",
        "Lshoulder", "Larm", "Lelbow", "Lforearm", "Lhand",
        "Lthigh", "Lshin", "Lfoot"
    ];

    public async loadAll(): Promise<GameAssets> {
        // Load all assets in parallel
        const [baseModels, playerModel] = await Promise.all([
            this.loadBaseModels(),
            this.loadPlayerModel()
        ]);

        return { baseModels, playerModel };
    }

    private async loadPlayerModel(): Promise<GLTF> {
        const path = 'player.glb'; // The file is in the public folder
        return new Promise<GLTF>((resolve, reject) => {
            this.gltfLoader.load(path, (gltf) => {
                resolve(gltf);
            }, undefined, reject);
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
