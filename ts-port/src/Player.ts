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

        // First, create all the bone Groups and Meshes, and store them.
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

        // Create hip socket groups for correct leg positioning
        const lHipSocket = new THREE.Group();
        lHipSocket.name = 'L_hip_socket';
        this.bodyParts['L_hip_socket'] = lHipSocket;

        const rHipSocket = new THREE.Group();
        rHipSocket.name = 'R_hip_socket';
        this.bodyParts['R_hip_socket'] = rHipSocket;

        // Define the bone hierarchy. 'child': 'parent'
        const boneHierarchy: { [child: string]: string } = {
            "chest": "hip",
            "head": "chest",
            "Lshoulder": "chest",
            "Rshoulder": "chest",
            "Larm": "Lshoulder",
            "Lelbow": "Larm",
            "Lforearm": "Lelbow",
            "Lhand": "Lforearm",
            "Rarm": "Rshoulder",
            "Relbow": "Rarm",
            "Rforearm": "Relbow",
            "Rhand": "Rforearm",
            "racket": "Rhand",
            "L_hip_socket": "hip",
            "R_hip_socket": "hip",
            "Lthigh": "L_hip_socket",
            "Rthigh": "R_hip_socket",
            "Lshin": "Lthigh",
            "Rshin": "Rthigh",
            "Lfoot": "Lshin",
            "Rfoot": "Rshin",
        };

        // Connect the bones to form the hierarchy
        for (const childName in boneHierarchy) {
            const parentName = boneHierarchy[childName];
            const childBone = this.bodyParts[childName];
            const parentBone = this.bodyParts[parentName];

            if (childBone && parentBone) {
                parentBone.add(childBone);
            }
        }

        // Set the position of the hip sockets relative to the hip bone
        lHipSocket.position.set(LHIPORIGINX, RHIPORIGINY, RHIPORIGINZ);
        rHipSocket.position.set(RHIPORIGINX, RHIPORIGINY, RHIPORIGINZ);

        // Finally, add the root of the skeleton ('hip') to the player's root bone
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

        // The thigh is a child of the hip socket, so its origin is (0,0,0) in the socket's space.
        const hipSocketPosition = new THREE.Vector3(
            side === 'R' ? RHIPORIGINX : LHIPORIGINX,
            RHIPORIGINY,
            RHIPORIGINZ
        );

        // The toe position is defined in world space, but we need it relative to the hip socket.
        const toePosition = new THREE.Vector3(
            side === 'R' ? RFOOTORIGINX : LFOOTORIGINX,
            RFOOTORIGINY,
            RFOOTORIGINZ
        );

        const hipToToe = new THREE.Vector3().subVectors(toePosition, hipSocketPosition);

        // --- Yaw rotation (around Y axis) ---
        // This rotation points the leg towards the target in the XZ plane.
        const yawAngle = Math.atan2(hipToToe.x, hipToToe.z);
        const yawRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);

        // --- Pitch rotation (2D IK in YZ plane) ---
        // We project the hip-to-toe vector onto the YZ plane to solve the 2D IK.
        const distance2D = new THREE.Vector2(hipToToe.y, hipToToe.z).length();

        // Safety check for reachability and division by zero
        if (distance2D > thighLength + shinLength || distance2D === 0) {
            // Target is too far or at the same location, stretch the leg
            const stretchRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(hipToToe.x, hipToToe.y, hipToToe.z).normalize()
            );
            thigh.quaternion.copy(stretchRotation);
            shin.quaternion.identity();
            foot.quaternion.identity();
            return;
        }

        // Law of cosines to find the angles of the thigh and knee.
        // We use the 2D distance for this calculation and clamp the input to acos to prevent NaN.
        const cosThighAngle = (distance2D * distance2D + thighLength * thighLength - shinLength * shinLength) / (2 * distance2D * thighLength);
        const thighAngle = Math.acos(THREE.MathUtils.clamp(cosThighAngle, -1, 1));

        const cosKneeAngle = (thighLength * thighLength + shinLength * shinLength - distance2D * distance2D) / (2 * thighLength * shinLength);
        const kneeAngle = Math.acos(THREE.MathUtils.clamp(cosKneeAngle, -1, 1));

        // The initial angle of the hip-to-toe vector in the YZ plane.
        const baseAngle = Math.atan2(hipToToe.y, hipToToe.z);

        // Combine angles for the thigh's pitch.
        const thighPitchAngle = baseAngle - thighAngle;

        const thighPitchRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), thighPitchAngle);

        // The shin's rotation is relative to the thigh.
        const shinPitchRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), kneeAngle - Math.PI);

        // Combine yaw and pitch for the final thigh rotation.
        thigh.quaternion.multiplyQuaternions(yawRotation, thighPitchRotation);
        shin.quaternion.copy(shinPitchRotation);

        // For now, let's keep the foot straight relative to the shin.
        foot.quaternion.identity();
    }
}
