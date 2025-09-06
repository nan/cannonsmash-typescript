import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { inputManager } from './InputManager';
import { AREAXSIZE, AREAYSIZE, TABLE_LENGTH, SERVE_MIN, SERVE_NORMAL, SERVE_MAX, SERVEPARAM, stype, SWING_NORMAL, TABLE_HEIGHT } from './constants';
import { Ball } from './Ball';
import { AIController } from './AIController';

const FRAME_RATE = 50; // A guess from looking at animation lengths in C++ code

export type PlayerState = 'IDLE' | 'SWING_DRIVE' | 'SWING_CUT';

export class Player {
    public mesh: THREE.Group;
    public state: PlayerState = 'IDLE';
    public velocity = new THREE.Vector3();
    public targetPosition = new THREE.Vector2();
    public isAi: boolean;
    public side: number;
    public aiController?: AIController;

    // Serve-related properties
    public swingType: number = SWING_NORMAL;
    public swing: number = 0; // Animation counter for swing
    public spin = new THREE.Vector2(); // x, y spin for the upcoming shot

    private assets: GameAssets;
    private bodyParts: { [name: string]: THREE.Object3D } = {};

    private mixer: THREE.AnimationMixer;
    private animationClips: { [name: string]: THREE.AnimationClip } = {};
    private currentAction: THREE.AnimationAction | null = null;
    private rootBone: THREE.Group;

    constructor(assets: GameAssets, isAi = false, side: number = 1) {
        this.assets = assets;
        this.isAi = isAi;
        this.side = side;
        this.mesh = new THREE.Group();
        this.rootBone = new THREE.Group();
        this.rootBone.name = 'root';
        this.mesh.add(this.rootBone);

        this.mixer = new THREE.AnimationMixer(this.rootBone);

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
        let material: THREE.MeshNormalMaterial;

        if (this.isAi) {
            // AI is fully opaque
            material = new THREE.MeshNormalMaterial();
        } else {
            // Human player is semi-transparent
            material = new THREE.MeshNormalMaterial({
                transparent: true,
                opacity: 0.5
            });
        }

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
                duration = Math.max(duration, rootPositionTimes[rootPositionTimes.length - 1]);
            }

            for (const boneName in motion.boneQuaternions) {
                const boneData = motion.boneQuaternions[boneName];
                const times: number[] = [];
                const values: number[] = [];
                boneData.quaternions.forEach((q, index) => {
                    if (isNaN(q.x) || isNaN(q.y) || isNaN(q.z) || isNaN(q.w)) {
                        console.error(`Corrupt data: NaN quaternion in ${motionName}, bone ${boneName}, frame ${index}`);
                    }
                    if (q.x === 0 && q.y === 0 && q.z === 0 && q.w === 0) {
                        console.warn(`Zero quaternion in ${motionName}, bone ${boneName}, frame ${index}. This might be invalid.`);
                    }
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
                this.currentAction.stop();
            }
            newAction.reset().play();

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

    /**
     * Cycles through the available serve types.
     * Called when the user presses the space bar.
     */
    public changeServeType() {
        // This check will be more robust once Game.getService() is implemented.
        // For now, we assume we can always change serve type if not swinging.
        if (this.swing > 0) return;

        if (this.swingType < SERVE_MIN) {
            this.swingType = SERVE_NORMAL;
        } else {
            this.swingType++;
        }

        if (this.swingType > SERVE_MAX) {
            this.swingType = SERVE_MIN;
        }
    }

    /**
     * Checks if the player is in a state where they can serve the ball.
     * @param ball The ball object.
     * @returns True if the ball is tossed and ready to be hit for a serve.
     */
    public canServe(ball: Ball): boolean {
        if ((ball.status === 6 && this.side === 1) || (ball.status === 7 && this.side === -1)) {
            return true;
        }
        return false;
    }

    /**
     * Initiates the serving motion.
     * @param spinCategory The category of spin/power (1, 2, or 3) based on mouse button.
     */
    public startServe(spinCategory: number) {
        if (this.swing > 0) return false;

        this.swing = 1; // Start the swing animation

        // Find the serve parameters from the constants table
        const params = SERVEPARAM.find(p => p[0] === this.swingType);
        if (params) {
            // The C++ code uses the spinCategory (1, 2, or 3) to index into the params array
            this.spin.x = params[(spinCategory - 1) * 2 + 1];
            this.spin.y = params[(spinCategory - 1) * 2 + 2];
        } else {
            this.spin.x = 0;
            this.spin.y = 0;
        }

        this.playAnimation('Fcut', false); // Placeholder animation
        return true;
    }

    /**
     * Initiates a regular (non-serve) swing.
     * @param spinCategory The category of spin/power (1 for backhand, 3 for forehand).
     */
    public startSwing(spinCategory: number) {
        if (this.swing > 0) return false;

        // In C++, SwingType is determined by a complex function.
        // For now, we'll just use a generic drive.
        this.swingType = SWING_NORMAL; // Or SWING_DRIVE, etc.
        this.swing = 1; // Start the swing animation

        // A real implementation would calculate spin based on many factors.
        // Here we'll use a placeholder.
        this.spin.set(0, 5); // Simple topspin

        // TODO: Choose animation based on forehand/backhand (spinCategory)
        this.playAnimation('Fdrive', false);
        return true;
    }

    /**
     * Checks if the player is in a state where they can legally hit the ball.
     * @param ball The ball object.
     * @returns True if the ball can be hit.
     */
    public canHitBall(ball: Ball): boolean {
        if ((ball.status === 3 && this.side === 1) || (ball.status === 1 && this.side === -1)) {
            return true;
        }
        return false;
    }

    /**
     * Executes the logic for hitting the ball.
     * @param ball The ball object.
     */
    public hitBall(ball: Ball) {
        if (this.canServe(ball)) {
            // --- SERVE ---
            const level = 0.9;
            const velocity = ball.targetToVS(this, this.targetPosition, level, this.spin);
            ball.hit(velocity, this.spin);
        } else if (this.canHitBall(ball)) {
            // --- RALLY HIT ---
            const target = this.targetPosition;

            // Create a 3D target vector on the table surface.
            const target3D = new THREE.Vector3(target.x, TABLE_HEIGHT, target.y);

            // Calculate the direction vector from the ball to the target.
            const direction = new THREE.Vector3().subVectors(target3D, ball.mesh.position);

            // Calculate distance to target to scale speed and arc.
            const distance = direction.length();

            // Normalize the direction vector to get a unit vector.
            direction.normalize();

            // Set a base speed and add a component proportional to distance.
            const speed = 7 + distance * 3;

            // Calculate initial velocity.
            const velocity = direction.multiplyScalar(speed);

            // Add an upward component to the velocity to create an arc over the net.
            // Make the arc higher for longer shots to ensure it clears the net.
            velocity.y = 1.0 + distance * 0.8;

            // Hit the ball with the calculated velocity and player's spin.
            ball.hit(velocity, this.spin);
        }
    }

    public update(deltaTime: number, ball: Ball) {
        // --- Swing and Serve Logic ---
        if (this.swing > 0) {
            const swingParams = stype.get(this.swingType);
            if (swingParams) {
                // This logic mirrors the C++ code's Player::Move function
                if (this.canServe(ball)) {
                    // Ball is already tossed, just continue the swing
                    if (ball.velocity.y < 0) { // Wait for toss to reach apex
                        this.swing++;
                    }
                } else {
                    // This block handles both serves (before the ball is tossed) and rally swings.
                    // We need to check if a toss is required for the current swing type.
                    if (this.swingType >= SERVE_MIN && swingParams.toss > 0 && this.swing === swingParams.toss) {
                        ball.toss(this, swingParams.tossV);
                    }
                    this.swing++;
                }

                // Impact
                if (this.swing >= swingParams.hitStart && this.swing <= swingParams.hitEnd) {
                    this.hitBall(ball);
                }

                // End of swing
                if (this.swing >= swingParams.swingLength) {
                    this.swing = 0;
                    if (this.swingType >= SERVE_MIN) {
                        this.swingType = SWING_NORMAL;
                    }
                    this.setState('IDLE');
                }
            } else {
                // Invalid swing type, reset
                this.swing = 0;
            }
        }

        if (!this.isAi) {
            // Human-controlled movement based on mouse position (direct position control)
            const mousePos = inputManager.getMousePosition();
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            const targetX = (mousePos.x / screenWidth - 0.5) * AREAXSIZE;
            const targetZ = (TABLE_LENGTH / 2) + (mousePos.y / screenHeight) * (AREAYSIZE - (TABLE_LENGTH / 2));

            const lerpFactor = 0.2;
            this.mesh.position.x += (targetX - this.mesh.position.x) * lerpFactor;
            this.mesh.position.z += (targetZ - this.mesh.position.z) * lerpFactor;

            if (this.mesh.position.z < TABLE_LENGTH / 2) {
                this.mesh.position.z = TABLE_LENGTH / 2;
            }
            if (this.mesh.position.z > AREAYSIZE) {
                this.mesh.position.z = AREAYSIZE;
            }
        } else {
            // AI movement is driven by its controller
            if (this.aiController) {
                this.aiController.update(deltaTime);
            }
            // The controller sets the velocity, and we apply it here.
            this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        }

        // Common logic for both human and AI
        // Boundary checks for x
        const halfArena = AREAXSIZE / 2;
        if (this.mesh.position.x < -halfArena) {
            this.mesh.position.x = -halfArena;
            this.velocity.x = 0;
        }
        if (this.mesh.position.x > halfArena) {
            this.mesh.position.x = halfArena;
            this.velocity.x = 0;
        }

        // Boundary checks for z (depth)
        if (this.isAi) {
            // AI player boundary
            if (this.mesh.position.z > -TABLE_LENGTH / 2) {
                this.mesh.position.z = -TABLE_LENGTH / 2;
                this.velocity.z = 0;
            }
            if (this.mesh.position.z < -AREAYSIZE / 2) {
                this.mesh.position.z = -AREAYSIZE / 2;
                this.velocity.z = 0;
            }
        }

        this.mixer.update(deltaTime);
    }
}
