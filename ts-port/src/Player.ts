import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { inputManager } from './InputManager';
import { AREAXSIZE, AREAYSIZE, TABLE_LENGTH, SERVE_MIN, SERVE_NORMAL, SERVE_MAX, SERVEPARAM, stype, SWING_NORMAL, TABLE_HEIGHT, SWING_DRIVE, SWING_CUT, TABLE_WIDTH, NET_HEIGHT, SWING_POKE, SWING_SMASH, SPIN_NORMAL, SPIN_POKE, SPIN_DRIVE, SPIN_SMASH, PLAYER_MOVE_SENSITIVITY_X, PLAYER_MOVE_SENSITIVITY_Z } from './constants';
import { Ball } from './Ball';
import { AIController } from './AIController';
import type { Game } from './Game';

const FRAME_RATE = 50; // A guess from looking at animation lengths in C++ code

export type PlayerState = 'IDLE' | 'SWING_DRIVE' | 'SWING_CUT';

export class Player {
    public mesh: THREE.Group;
    public state: PlayerState = 'IDLE';
    public velocity = new THREE.Vector3();
    public targetPosition: THREE.Vector2;
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
        this.targetPosition = new THREE.Vector2(0, -this.side * TABLE_LENGTH / 4);
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

        this.swingType = SERVE_NORMAL;
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
     * Determines the best swing type based on the ball's position and spin.
     * This is a port of the logic from PenAttack::SwingType in the C++ source.
     * @param ball The ball to be hit.
     * @param isForehand Whether the swing is forehand or backhand.
     */
    private determineSwingType(ball: Ball, isForehand: boolean): number {
        this.spin.x = 0.0; // Side spin is not implemented for these swings yet

        if (this.canHitBall(ball)) {
            const ballPos = ball.mesh.position;
            const ballSpinY = ball.spin.y;

            // low ball on the table
            if (Math.abs(ballPos.x) < TABLE_WIDTH / 2 &&
                Math.abs(ballPos.z) < TABLE_LENGTH / 2 &&
                (ballPos.y - TABLE_HEIGHT - NET_HEIGHT) / Math.abs(ballPos.z) < NET_HEIGHT / (TABLE_LENGTH / 2) * 0.5) {
                if (ballSpinY < 0) { // backspin
                    this.spin.y = SPIN_POKE;
                    return SWING_POKE;
                } else {
                    this.spin.y = SPIN_NORMAL;
                    return SWING_NORMAL;
                }
            } else if (ballPos.y < TABLE_HEIGHT + NET_HEIGHT) { // under the net
                if (isForehand) {
                    this.spin.y = SPIN_DRIVE;
                    return SWING_DRIVE;
                } else {
                    if (ballSpinY < 0) {
                        this.spin.y = SPIN_POKE;
                        return SWING_POKE;
                    } else {
                        this.spin.y = SPIN_NORMAL;
                        return SWING_NORMAL;
                    }
                }
            } else if (Math.abs(ballPos.z) < TABLE_LENGTH / 2 + 1.0 &&
                ballPos.y > TABLE_HEIGHT + NET_HEIGHT) {
                this.spin.y = SPIN_SMASH;
                return SWING_SMASH;
            } else {
                this.spin.y = SPIN_NORMAL;
                return SWING_NORMAL;
            }
        } else {
            this.spin.y = SPIN_NORMAL;
            return SWING_NORMAL;
        }
    }

    /**
     * Gets the predicted swing type and side for the AI to use in its simulation.
     * @param ball The ball to check against.
     * @returns An object containing the predicted swingType and spinCategory.
     */
    public getPredictedSwing(ball: Ball): { swingType: number, spinCategory: number } {
        // Create a clone of the ball 20 frames into the future to decide swing side
        const tmpBall = ball.clone();
        for (let i = 0; i < 20; i++) {
            const oldPos = tmpBall.mesh.position.clone();
            tmpBall._updatePhysics(0.01); // Using TICK from constants
            tmpBall.checkCollision(oldPos);
        }

        const isForehand = (this.mesh.position.x - tmpBall.mesh.position.x) * this.side < 0;
        const spinCategory = isForehand ? 3 : 1;
        const swingType = this.determineSwingType(tmpBall, isForehand);
        return { swingType, spinCategory };
    }

    /**
     * Initiates a regular (non-serve) swing.
     * @param ball The ball instance.
     * @param spinCategory The category of spin/power (1 for backhand, 3 for forehand), typically from user input.
     */
    public startSwing(ball: Ball, spinCategory: number) {
        if (this.swing > 0) return false;

        const isForehand = spinCategory === 3;

        // We simulate the ball a few frames into the future for a slightly better guess
        const tmpBall = ball.clone();
        for (let i = 0; i < 10; i++) {
            const oldPos = tmpBall.mesh.position.clone();
            tmpBall._updatePhysics(0.01);
            tmpBall.checkCollision(oldPos);
        }

        this.swingType = this.determineSwingType(tmpBall, isForehand);

        let animationName: string;
        switch (this.swingType) {
            case SWING_DRIVE:
                animationName = 'Fdrive';
                break;
            case SWING_SMASH:
                animationName = 'Fsmash';
                break;
            case SWING_CUT:
            case SWING_POKE:
                animationName = 'Bnormal';
                break;
            case SWING_NORMAL:
            default:
                animationName = isForehand ? 'Fnormal' : 'Bnormal';
                break;
        }

        this.swing = 1; // Start the swing animation
        this.playAnimation(animationName, false);
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
            ball.justHitBySide = this.side;
        } else if (this.canHitBall(ball)) {
            // --- RALLY HIT ---
            // Use the new, more accurate calculation method.
            const velocity = ball.calculateRallyHitVelocity(this.targetPosition, this.spin);

            if (this.isAi) {
                console.log(`[AI HIT] Player Pos: ${JSON.stringify(this.mesh.position)}, Ball Pos: ${JSON.stringify(ball.mesh.position)}, Target: ${JSON.stringify(this.targetPosition)}, Velocity: ${JSON.stringify(velocity)}`);
            }

            // Hit the ball with the calculated velocity and player's spin.
            ball.hit(velocity, this.spin);
            ball.justHitBySide = this.side;
        }
    }

    public update(deltaTime: number, ball: Ball, game: Game) {
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
            // Human-controlled movement based on Pointer Lock API (relative motion)
            if (inputManager.isPointerLocked) {
                const movement = inputManager.getMouseMovement();
                this.mesh.position.x += movement.x * PLAYER_MOVE_SENSITIVITY_X;
                // Mouse Y up (negative) should move player forward (Z position decreases).
                this.mesh.position.z += movement.y * PLAYER_MOVE_SENSITIVITY_Z;
            }
        } else {
            // AI movement is driven by its controller
            if (this.aiController) {
                this.aiController.update(deltaTime, game);
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
        if (this.side === 1) { // Near side player (human or AI)
            if (this.mesh.position.z < TABLE_LENGTH / 2) {
                this.mesh.position.z = TABLE_LENGTH / 2;
                this.velocity.z = 0;
            }
            if (this.mesh.position.z > AREAYSIZE) {
                this.mesh.position.z = AREAYSIZE;
                this.velocity.z = 0;
            }
        } else { // Far side player (always AI)
            if (this.mesh.position.z > -TABLE_LENGTH / 2) {
                this.mesh.position.z = -TABLE_LENGTH / 2;
                this.velocity.z = 0;
            }
            if (this.mesh.position.z < -AREAYSIZE) {
                this.mesh.position.z = -AREAYSIZE;
                this.velocity.z = 0;
            }
        }

        this.mixer.update(deltaTime);
    }
}
