import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { inputManager } from './InputManager';
import { AREAXSIZE, AREAYSIZE, TABLE_LENGTH, SERVE_MIN, SERVE_NORMAL, SERVE_MAX, SERVEPARAM, stype, SWING_NORMAL } from './constants';
import { Ball } from './Ball';

const FRAME_RATE = 50; // A guess from looking at animation lengths in C++ code

export type PlayerState = 'IDLE' | 'SWING_DRIVE' | 'SWING_CUT';

export class Player {
    public mesh: THREE.Group;
    public state: PlayerState = 'IDLE';
    public velocity = new THREE.Vector3();
    public targetPosition = new THREE.Vector2();
    public isAi: boolean;
    public side: number;

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
     * Initiates a return swing motion for the AI.
     * @param ball The predicted ball state at the time of impact.
     */
    public startSwing(ball: Ball) {
        if (this.swing > 0) return false;

        this.swing = 1; // Start the swing animation
        this.swingType = SWING_DRIVE;

        // For now, AI aims for the middle of the opponent's court
        this.targetPosition.set(0, -this.side * TABLE_LENGTH / 4);

        // Give it a bit of topspin
        this.spin.set(0, 0.2);

        // TODO: Choose animation based on forehand/backhand
        this.playAnimation('Fdrive', false);
        return true;
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
     * Executes the logic for hitting the ball during a serve.
     * @param ball The ball object.
     */
    public hitBall(ball: Ball) {
        if (this.canServe(ball)) {
            // SERVE logic
            const level = 0.9; // Use a fixed difficulty for serves for now
            const velocity = ball.targetToVS(this, this.targetPosition, level, this.spin);
            ball.hit(velocity, this.spin);
        } else {
            // RETURN SHOT logic
            // This is a simplified calculation for a return shot.
            // A more advanced implementation would use a method similar to targetToVS.
            const target = new THREE.Vector3(this.targetPosition.x, TABLE_HEIGHT, this.targetPosition.y);
            const ballPos = ball.mesh.position;

            // Calculate a velocity vector to get the ball to the target
            const direction = target.clone().sub(ballPos).normalize();
            const speed = 10; // A reasonable speed for a return drive
            const velocity = direction.multiplyScalar(speed);

            // Give it some upward velocity to ensure it clears the net
            velocity.y = 2.5;

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
                    // Ball is not yet tossed. Check if it's time to toss.
                    if (swingParams.toss > 0 && this.swing === swingParams.toss) {
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

            // Map mouse X to player X position
            // Mouse X from 0 to screenWidth -> Player X from -AREAXSIZE/2 to AREAXSIZE/2
            const targetX = (mousePos.x / screenWidth - 0.5) * AREAXSIZE;

            // Map mouse Y to player Z position
            // Mouse Y from 0 (top) to screenHeight (bottom) -> Player Z from TABLE_LENGTH/2 (near) to AREAYSIZE (far)
            const targetZ = (TABLE_LENGTH / 2) + (mousePos.y / screenHeight) * (AREAYSIZE - (TABLE_LENGTH / 2));

            // Smoothly move the player towards the target position using linear interpolation (lerp)
            const lerpFactor = 0.2;
            this.mesh.position.x += (targetX - this.mesh.position.x) * lerpFactor;
            this.mesh.position.z += (targetZ - this.mesh.position.z) * lerpFactor;

            // Boundary for z (still useful as a safeguard)
            if (this.mesh.position.z < TABLE_LENGTH / 2) {
                this.mesh.position.z = TABLE_LENGTH / 2;
            }
            if (this.mesh.position.z > AREAYSIZE) {
                this.mesh.position.z = AREAYSIZE;
            }
        } else {
            // --- AI LOGIC ---

            // 1. AI Predictive Swing Logic (Auto Backswing)
            // The AI should attempt to predict a return if it's idle and the ball is in play.
            // The flawed `isBallApproaching` check is removed in favor of this more general condition.
            if (this.swing === 0 && ball.status >= 0 && ball.status !== 8) {
                const predictedBall = ball.clone();

                for (let i = 0; i < 30; i++) { // Predict up to 30 frames ahead
                    predictedBall.predictiveUpdate();

                    // A ball is hittable if it's in a rally (status 1 or 3)
                    // OR if it's a serve return (status 0 or 2) and still on the AI's side.
                    const isRallyHittable =
                        (predictedBall.status === 1 && this.side === 1) ||
                        (predictedBall.status === 3 && this.side === -1);

                    const isServeReturnHittable =
                        (predictedBall.status === 2 && this.side === 1 && predictedBall.mesh.position.z * this.side < 0) ||
                        (predictedBall.status === 0 && this.side === -1 && predictedBall.mesh.position.z * this.side < 0);

                    if (isRallyHittable || isServeReturnHittable) {
                        // Check if ball is in a hittable zone (Z-axis)
                        const zDiff = this.mesh.position.z - predictedBall.mesh.position.z;
                        if (zDiff * this.side < 0.3 && zDiff * this.side > -0.05) {
                            this.startSwing(predictedBall);
                            break; // Exit prediction loop once a swing is decided
                        }
                    }
                    if (predictedBall.status < 0) {
                        break; // Stop predicting if the ball is dead
                    }
                }
            }


            // 2. AI Movement Logic
            // Simple AI: follow the ball's x position
            const targetX = ball.mesh.position.x;
            const currentX = this.mesh.position.x;
            const speed = 2; // AI movement speed

            if (Math.abs(targetX - currentX) > 0.1) {
                this.velocity.x = Math.sign(targetX - currentX) * speed;
            } else {
                this.velocity.x = 0;
            }
            this.mesh.position.x += this.velocity.x * deltaTime;
        }

        // Common logic for both human and AI
        // Boundary checks for x
        const halfArena = AREAXSIZE / 2;
        if (this.mesh.position.x < -halfArena) {
            this.mesh.position.x = -halfArena;
        }
        if (this.mesh.position.x > halfArena) {
            this.mesh.position.x = halfArena;
        }

        this.mixer.update(deltaTime);
    }
}
