import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { inputManager } from './InputManager';
import { AREAXSIZE, AREAYSIZE, TABLE_LENGTH } from './constants';

const FRAME_RATE = 50; // A guess from looking at animation lengths in C++ code

export type PlayerState = 'IDLE' | 'SWING_DRIVE' | 'SWING_CUT';

export class Player {
    public mesh: THREE.Group;
    public state: PlayerState = 'IDLE';
    public velocity = new THREE.Vector3();
    public targetPosition = new THREE.Vector2();

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

        this.setState('IDLE');
    }

    public setState(newState: PlayerState) {
        if (this.state === newState) return;
        this.state = newState;

        switch (this.state) {
            case 'IDLE':
                this.playAnimation('Fnormal', true);
                break;
            case 'SWING_DRIVE':
                this.playAnimation('Fdrive', false);
                break;
            case 'SWING_CUT':
                this.playAnimation('Fcut', false);
                break;
        }
    }

    private buildModel() {
        const material = new THREE.MeshNormalMaterial();

        for (const modelName in this.assets.baseModels) {
            const geometry = this.assets.baseModels[modelName];
            if (geometry) {
                const partMesh = new THREE.Mesh(geometry, material);
                partMesh.name = modelName;
                const bone = new THREE.Group();
                bone.name = modelName;
                bone.add(partMesh);
                this.bodyParts[modelName] = bone;
            }
        }

        // Define the bone hierarchy. 'child': 'parent'
        // Lower body parts are excluded to hide them.
        const boneHierarchy: { [child: string]: string } = {
            "chest": "hip", "head": "chest",
            "Lshoulder": "chest", "Rshoulder": "chest",
            "Larm": "Lshoulder", "Lelbow": "Larm", "Lforearm": "Lelbow", "Lhand": "Lforearm",
            "Rarm": "Rshoulder", "Relbow": "Rarm", "Rforearm": "Relbow", "Rhand": "Rforearm",
            "racket": "Rhand",
        };

        for (const childName in boneHierarchy) {
            const parentName = boneHierarchy[childName];
            const childBone = this.bodyParts[childName];
            const parentBone = this.bodyParts[parentName];
            if (childBone && parentBone) {
                parentBone.add(childBone);
            }
        }

        if (this.bodyParts['hip']) {
            this.rootBone.add(this.bodyParts['hip']);
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
        for (const boneName in fNormalMotion.boneQuaternions) {
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
            if (!loop) {
                this.mixer.addEventListener('finished', (e) => {
                    if (e.action === this.currentAction) {
                        this.setState('IDLE');
                    }
                });
            }
        } else {
            console.warn(`Animation clip not found: ${name}`);
        }
    }

    public update(deltaTime: number) {
        // Based on HumanController.cpp logic
        const mousePos = inputManager.getMousePosition();
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // Calculate velocity based on mouse position relative to center
        // The scaling factors are adjusted from the C++ code
        this.velocity.x = (mousePos.x - screenWidth / 2) / (screenWidth / 10);
        this.velocity.z = (mousePos.y - screenHeight / 2) / (screenHeight / 10); // z is depth in our scene

        // Apply velocity to mesh position
        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.z += this.velocity.z * deltaTime;

        // Boundary checks (simplified from C++ code)
        const halfArena = AREAXSIZE / 2;
        if (this.mesh.position.x < -halfArena) {
            this.mesh.position.x = -halfArena;
        }
        if (this.mesh.position.x > halfArena) {
            this.mesh.position.x = halfArena;
        }

        // Simple boundary for z, player should stay on their side
        if (this.mesh.position.z < TABLE_LENGTH / 2) {
             this.mesh.position.z = TABLE_LENGTH / 2;
        }
        if (this.mesh.position.z > AREAYSIZE) { // A reasonable far boundary
            this.mesh.position.z = AREAYSIZE;
        }


        this.mixer.update(deltaTime);
    }
}
