import * as THREE from 'three';
import type { GameAssets, Motion } from './AssetManager';

const FRAME_RATE = 50; // A guess from looking at animation lengths in C++ code

export enum PlayerState {
    IDLE,
    SWING_DRIVE,
    SWING_CUT,
}

export class Player {
    public mesh: THREE.Group;
    public state: PlayerState = PlayerState.IDLE;

    private assets: GameAssets;
    private bodyParts: { [name: string]: THREE.Object3D } = {};

    private mixer: THREE.AnimationMixer;
    private animationClips: { [name: string]: THREE.AnimationClip } = {};
    private currentAction: THREE.AnimationAction | null = null;
    private rootBone: THREE.Group;

    constructor(assets: GameAssets) {
        this.assets = assets;
        this.mesh = new THREE.Group();
        this.rootBone = new THREE.Group();
        this.rootBone.name = 'root';
        this.mesh.add(this.rootBone);

        this.mixer = new THREE.AnimationMixer(this.rootBone);

        console.log("Player class instantiated");
        this.buildModel();
        this.createAnimationClips();

        this.setState(PlayerState.IDLE);
    }

    public setState(newState: PlayerState) {
        if (this.state === newState) return;
        this.state = newState;

        switch (this.state) {
            case PlayerState.IDLE:
                this.playAnimation('Fnormal', true);
                break;
            case PlayerState.SWING_DRIVE:
                this.playAnimation('Fdrive', false);
                break;
            case PlayerState.SWING_CUT:
                this.playAnimation('Fcut', false);
                break;
        }
    }

    private buildModel() {
        const material = new THREE.MeshNormalMaterial();

        // A helper function to create a bone with its mesh
        const createBone = (name: string): THREE.Group | undefined => {
            const geometry = this.assets.baseModels[name];
            if (!geometry) {
                console.warn(`Geometry for ${name} not found!`);
                return undefined;
            }
            const partMesh = new THREE.Mesh(geometry, material);
            partMesh.name = name;

            const bone = new THREE.Group();
            bone.name = name;
            bone.add(partMesh);

            this.bodyParts[name] = bone;
            return bone;
        };

        // Define the skeletal hierarchy
        const hierarchy = {
            "hip": { parent: this.rootBone, children: ["chest", "Lthigh", "Rthigh"] },
            "chest": { parentName: "hip", children: ["head", "Lshoulder", "Rshoulder"] },
            "head": { parentName: "chest", children: [] },
            "Lshoulder": { parentName: "chest", children: ["Larm"] },
            "Larm": { parentName: "Lshoulder", children: ["Lelbow"] },
            "Lelbow": { parentName: "Larm", children: ["Lforearm"] },
            "Lforearm": { parentName: "Lelbow", children: ["Lhand"] },
            "Lhand": { parentName: "Lforearm", children: [] },
            "Rshoulder": { parentName: "chest", children: ["Rarm"] },
            "Rarm": { parentName: "Rshoulder", children: ["Relbow"] },
            "Relbow": { parentName: "Rarm", children: ["Rforearm"] },
            "Rforearm": { parentName: "Relbow", children: ["Rhand"] },
            "Rhand": { parentName: "Rforearm", children: [] },
            "Lthigh": { parentName: "hip", children: ["Lshin"] },
            "Lshin": { parentName: "Lthigh", children: ["Lfoot"] },
            "Lfoot": { parentName: "Lshin", children: [] },
            "Rthigh": { parentName: "hip", children: ["Rshin"] },
            "Rshin": { parentName: "Rthigh", children: ["Rfoot"] },
            "Rfoot": { parentName: "Rshin", children: [] },
            "racket": { parentName: "Rhand", children: [] },
        };

        // Create all the bones first
        for (const name of Object.keys(hierarchy)) {
            createBone(name);
        }

        // Parent them according to the hierarchy
        for (const name in hierarchy) {
            const bone = this.bodyParts[name];
            if (!bone) continue;

            const def = (hierarchy as any)[name];
            if (def.parent) { // For the root bone's direct child
                def.parent.add(bone);
            } else if (def.parentName) {
                const parentBone = this.bodyParts[def.parentName];
                if (parentBone) {
                    parentBone.add(bone);
                }
            }
        }
    }

    private createAnimationClips() {
        for (const motionName in this.assets.motions) {
            const motion = this.assets.motions[motionName];
            const tracks: THREE.KeyframeTrack[] = [];
            let duration = 0;

            // Root motion from center.affine
            const rootPositionTimes: number[] = [];
            const rootPositionValues: number[] = [];
            const rootQuaternionTimes: number[] = [];
            const rootQuaternionValues: number[] = [];
            motion.centerAffine.matrices.forEach((matrix, index) => {
                const time = index / FRAME_RATE;
                rootPositionTimes.push(time);
                rootQuaternionTimes.push(time);
                const pos = new THREE.Vector3();
                const quat = new THREE.Quaternion();
                const scale = new THREE.Vector3();
                matrix.decompose(pos, quat, scale);
                rootPositionValues.push(pos.x, pos.y, pos.z);
                rootQuaternionValues.push(quat.x, quat.y, quat.z, quat.w);
                duration = Math.max(duration, time);
            });
            if (rootPositionTimes.length > 0) {
                tracks.push(new THREE.VectorKeyframeTrack('root.position', rootPositionTimes, rootPositionValues));
                tracks.push(new THREE.QuaternionKeyframeTrack('root.quaternion', rootQuaternionTimes, rootQuaternionValues));
            }

            // Bone rotations from .quaternion files
            for (const boneName in motion.boneQuaternions) {
                const boneData = motion.boneQuaternions[boneName];
                const times: number[] = [];
                const values: number[] = [];
                boneData.quaternions.forEach((q, index) => {
                    times.push(index / FRAME_RATE);
                    values.push(q.x, q.y, q.z, q.w);
                    duration = Math.max(duration, times[times.length - 1]);
                });
                if (times.length > 0) {
                    tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values));
                }
            }

            // Bone transforms from .affine files
            for (const boneName in motion.boneAffineData) {
                const boneData = motion.boneAffineData[boneName];
                const positionTimes: number[] = [];
                const positionValues: number[] = [];
                const quaternionTimes: number[] = [];
                const quaternionValues: number[] = [];

                boneData.matrices.forEach((matrix, index) => {
                    const time = index / FRAME_RATE;
                    const pos = new THREE.Vector3();
                    const quat = new THREE.Quaternion();
                    const scale = new THREE.Vector3();
                    matrix.decompose(pos, quat, scale);

                    positionTimes.push(time);
                    positionValues.push(pos.x, pos.y, pos.z);
                    quaternionTimes.push(time);
                    quaternionValues.push(quat.x, quat.y, quat.z, quat.w);
                    duration = Math.max(duration, time);
                });

                if (positionTimes.length > 0) {
                    tracks.push(new THREE.VectorKeyframeTrack(`${boneName}.position`, positionTimes, positionValues));
                    tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, quaternionTimes, quaternionValues));
                }
            }

            if (tracks.length > 0) {
                const clip = new THREE.AnimationClip(motionName, duration, tracks);
                this.animationClips[motionName] = clip;
            }
        }
    }

    public playAnimation(name: string, loop = true) {
        if (this.currentAction?.getClip()?.name === name && this.currentAction.isRunning()) {
            return;
        }

        const clip = this.animationClips[name];
        if (clip) {
            const newAction = this.mixer.clipAction(clip);
            newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
            newAction.clampWhenFinished = !loop;

            if (this.currentAction) {
                this.currentAction.fadeOut(0.1);
            }

            newAction.reset().fadeIn(0.1).play();
            this.currentAction = newAction;

            // When a non-looping animation finishes, return to idle
            if (!loop) {
                this.mixer.addEventListener('finished', (e) => {
                    if (e.action === this.currentAction) {
                        this.setState(PlayerState.IDLE);
                    }
                });
            }
        } else {
            console.warn(`Animation clip not found: ${name}`);
        }
    }

    public update(deltaTime: number) {
        this.mixer.update(deltaTime);
    }
}
