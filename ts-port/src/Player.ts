import * as THREE from 'three';
import type { GameAssets } from './AssetManager';

const FRAME_RATE = 50; // A guess from looking at animation lengths in C++ code

export type PlayerState = 'IDLE' | 'SWING_DRIVE' | 'SWING_CUT';

const thighLength = 0.396;
const shinLength = 0.430;

const RHIPORIGINX = 0.1;
const RHIPORIGINY = -0.16;
const RHIPORIGINZ = 0.77;
const LHIPORIGINX = -0.1;
const RFOOTORIGINX = 0.25;
const RFOOTORIGINY = 0;
const RFOOTORIGINZ = 0;
const LFOOTORIGINX = -0.25;

// This is the hardcoded offset from the C++ code
const LEG_OFFSET = new THREE.Vector3(0.0, 0.159459, -1.010000);

export class Player {
    public mesh: THREE.Group;
    public state: PlayerState = 'IDLE';

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

        const boneHierarchy: { [child: string]: string } = {
            "chest": "hip", "head": "chest",
            "Lshoulder": "chest", "Rshoulder": "chest",
            "Larm": "Lshoulder", "Lelbow": "Larm", "Lforearm": "Lelbow", "Lhand": "Lforearm",
            "Rarm": "Rshoulder", "Relbow": "Rarm", "Rforearm": "Relbow", "Rhand": "Rforearm",
            "racket": "Rhand",
            "Lthigh": "hip", "Rthigh": "hip",
            "Lshin": "Lthigh", "Rshin": "Rthigh",
            "Lfoot": "Lshin", "Rfoot": "Rshin",
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
        this.mixer.update(deltaTime);
        this.updateLegsIK();
    }

    private updateLegsIK() {
        const hip = this.bodyParts['hip'];
        if (!hip) return;
        this.solveIKForLeg('R');
        this.solveIKForLeg('L');
    }

    private solveIKForLeg(side: 'R' | 'L') {
        const thigh = this.bodyParts[side + 'thigh'];
        const shin = this.bodyParts[side + 'shin'];
        const foot = this.bodyParts[side + 'foot'];
        if (!thigh || !shin || !foot) return;

        const hip = this.bodyParts['hip'];

        // The C++ code applies a hardcoded translation before drawing the legs.
        // We can simulate this by creating a temporary parent object for the hip.
        const legRoot = new THREE.Object3D();
        hip.getWorldQuaternion(legRoot.quaternion);
        hip.getWorldPosition(legRoot.position);
        legRoot.position.add(LEG_OFFSET.clone().applyQuaternion(legRoot.quaternion));
        legRoot.updateWorldMatrix(true);

        const thighPosition = new THREE.Vector3(
            side === 'R' ? RHIPORIGINX : LHIPORIGINX,
            RHIPORIGINY,
            RHIPORIGINZ
        );

        // Transform thigh position into world space
        const thighWorldPosition = thighPosition.clone().applyMatrix4(legRoot.matrixWorld);

        const toePosition = new THREE.Vector3(
            side === 'R' ? RFOOTORIGINX : LFOOTORIGINX,
            RFOOTORIGINY,
            RFOOTORIGINZ
        );

        // Transform toe position into world space
        const toeWorldPosition = toePosition.clone().applyMatrix4(legRoot.matrixWorld);

        const hipToToe = new THREE.Vector3().subVectors(toeWorldPosition, thighWorldPosition);
        const distance = hipToToe.length();

        if (distance > thighLength + shinLength || distance < 0.01) {
            return; // Cannot solve
        }

        const kneeAngle = -Math.acos(THREE.MathUtils.clamp((thighLength * thighLength + shinLength * shinLength - distance * distance) / (2 * thighLength * shinLength), -1, 1));
        const thighAngle = Math.acos(THREE.MathUtils.clamp((distance * distance + thighLength * thighLength - shinLength * shinLength) / (2 * distance * thighLength), -1, 1));

        const axis = new THREE.Vector3().crossVectors(hipToToe, new THREE.Vector3(0, 1, 0)).normalize();
        if (axis.length() === 0) {
            axis.set(1, 0, 0); // Default axis if hipToToe is aligned with up vector
        }

        const alignThigh = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), hipToToe.normalize());
        const bendThigh = new THREE.Quaternion().setFromAxisAngle(axis, thighAngle);
        const finalThighQuaternion = new THREE.Quaternion().multiplyQuaternions(bendThigh, alignThigh);

        // Apply the rotation
        thigh.quaternion.copy(finalThighQuaternion);

        const shinRotation = new THREE.Quaternion().setFromAxisAngle(axis, kneeAngle);
        shin.quaternion.copy(shinRotation);

        foot.quaternion.identity();
    }
}
