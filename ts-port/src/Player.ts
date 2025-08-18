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
        this.applyInitialPose();

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
        // ... (rest of the file is unchanged, so I will omit it for brevity)
        const material = new THREE.MeshNormalMaterial();

        for (const modelName in this.assets.baseModels) {
            const geometry = this.assets.baseModels[modelName];
            if (geometry) {
                const partMesh = new THREE.Mesh(geometry, material);
                partMesh.name = modelName;

                const bone = new THREE.Group();
                bone.name = modelName;
                bone.add(partMesh);

                // Add a debug axis helper to each bone
                const axesHelper = new THREE.AxesHelper(0.1);
                bone.add(axesHelper);

                this.bodyParts[modelName] = bone;
                this.rootBone.add(bone);
            }
        }
    }

    private createAnimationClips() {
        for (const motionName in this.assets.motions) {
            const motion = this.assets.motions[motionName];
            const tracks: THREE.KeyframeTrack[] = [];
            let duration = 0;

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
            });

            if (rootPositionTimes.length > 0) {
                tracks.push(new THREE.VectorKeyframeTrack('root.position', rootPositionTimes, rootPositionValues));
                tracks.push(new THREE.QuaternionKeyframeTrack('root.quaternion', rootQuaternionTimes, rootQuaternionValues));
                duration = Math.max(duration, rootPositionTimes[rootPositionTimes.length - 1]);
            }

            for (const boneName in motion.boneQuaternions) {
                const boneData = motion.boneQuaternions[boneName];
                const times: number[] = [];
                const values: number[] = [];

                boneData.quaternions.forEach((q, index) => {
                    times.push(index / FRAME_RATE);
                    values.push(q.x, q.y, q.z, q.w);
                });

                if (times.length > 0) {
                    const trackName = `${boneName}.quaternion`;
                    tracks.push(new THREE.QuaternionKeyframeTrack(trackName, times, values));
                    duration = Math.max(duration, times[times.length - 1]);
                }
            }

            if (tracks.length > 0) {
                const clip = new THREE.AnimationClip(motionName, duration, tracks);
                this.animationClips[motionName] = clip;
            }
        }
    }

    private applyInitialPose() {
        const fNormalMotion = this.assets.motions['Fnormal'];
        if (!fNormalMotion) return;

        for(const boneName in fNormalMotion.boneQuaternions) {
            const bone = this.bodyParts[boneName];
            const boneData = fNormalMotion.boneQuaternions[boneName];
            if (bone && boneData) {
                bone.position.copy(boneData.origin);
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
