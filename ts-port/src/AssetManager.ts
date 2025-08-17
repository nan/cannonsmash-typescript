import * as THREE from 'three';
import { DATLoader } from './DATLoader';
import { AffineLoader } from './AffineLoader';
import type { AffineData } from './AffineLoader';
import { QuaternionLoader } from './QuaternionLoader';
import type { QuaternionData } from './QuaternionLoader';

// A structure to hold the data for a single motion (e.g., Fnormal)
export interface Motion {
    centerAffine: AffineData;
    boneQuaternions: { [boneName: string]: QuaternionData };
}

// A structure to hold all game assets
export interface GameAssets {
    baseModels: { [modelName: string]: THREE.BufferGeometry };
    motions: { [motionName: string]: Motion };
}

class AssetManager {
    private manager = new THREE.LoadingManager();
    private datLoader = new DATLoader(this.manager);
    private affineLoader = new AffineLoader(this.manager);
    private quaternionLoader = new QuaternionLoader(this.manager);

    private readonly modelNames = [
        "head", "chest", "hip", "racket",
        "Rshoulder", "Rarm", "Relbow", "Rforearm", "Rhand",
        "Rthigh", "Rshin", "Rfoot",
        "Lshoulder", "Larm", "Lelbow", "Lforearm", "Lhand",
        "Lthigh", "Lshin", "Lfoot"
    ];

    private readonly motionNames = [
        "Fnormal", "Bnormal", "Fdrive", "Fcut", "Bcut",
        "Fpeck", "Bpeck", "Fsmash"
    ];

    public async loadAll(): Promise<GameAssets> {
        console.log('AssetManager: Starting asset loading...');

        const baseModels = await this.loadBaseModels();
        const motions = await this.loadAllMotions();

        console.log('AssetManager: All assets loaded.');
        return { baseModels, motions };
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

    private async loadAllMotions(): Promise<{ [motionName: string]: Motion }> {
        const motions: { [motionName: string]: Motion } = {};
        const promises: Promise<void>[] = [];

        for (const name of this.motionNames) {
            const promise = this.loadSingleMotion(name).then(motion => {
                motions[name] = motion;
            });
            promises.push(promise);
        }

        await Promise.all(promises);
        return motions;
    }

    private async loadSingleMotion(motionName: string): Promise<Motion> {
        const basePath = `Parts/${motionName}/${motionName}`;

        // Load the main -center.affine file
        const affinePromise = new Promise<AffineData>((resolve, reject) => {
            this.affineLoader.load(`${basePath}-center.affine`, resolve, undefined, reject);
        });

        // Load all the bone .quaternion files
        const quaternionPromises: Promise<{ boneName: string, data: QuaternionData }>[] = [];
        for (const boneName of this.modelNames) {
             // As seen in C++ code, some quaternion files are skipped
            if (["racket", "Rarm", "Rforearm", "Rthigh", "Rshin", "Rfoot", "Larm", "Lforearm", "Lthigh", "Lshin", "Lfoot"].includes(boneName)) {
                continue;
            }
            const promise = new Promise<{ boneName: string, data: QuaternionData }>((resolve, reject) => {
                const path = `${basePath}-${boneName}.quaternion`;
                this.quaternionLoader.load(path, (data) => {
                    resolve({ boneName, data });
                }, undefined, reject);
            });
            quaternionPromises.push(promise);
        }

        const [centerAffine, ...boneQuaternionsResolved] = await Promise.all([affinePromise, ...quaternionPromises]);

        const boneQuaternions: { [boneName: string]: QuaternionData } = {};
        for (const result of boneQuaternionsResolved) {
            boneQuaternions[result.boneName] = result.data;
        }

        return { centerAffine, boneQuaternions };
    }
}

// Export a singleton instance
export const assetManager = new AssetManager();
