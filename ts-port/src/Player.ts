import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { inputManager } from './InputManager';
import {
    AREAXSIZE, AREAYSIZE, TABLE_LENGTH, SERVE_MIN, SERVE_NORMAL, SERVE_MAX, SERVEPARAM, stype, SWING_NORMAL, TABLE_HEIGHT, SWING_DRIVE, SWING_CUT, TABLE_WIDTH, NET_HEIGHT, SWING_POKE, SWING_SMASH, SPIN_NORMAL, SPIN_POKE, SPIN_DRIVE, SPIN_SMASH, PLAYER_MOVE_SENSITIVITY_X, PLAYER_MOVE_SENSITIVITY_Z,
    // Status-related constants from C++ version
    STATUS_MAX, RUN_SPEED, RUN_PENALTY, SWING_PENALTY, WALK_SPEED, WALK_BONUS, ACCEL_LIMIT, ACCEL_PENALTY
} from './constants';
import { Ball } from './Ball';
import { AIController } from './AIController';
import type { Game } from './Game';

const FRAME_RATE = 50; // A guess from looking at animation lengths in C++ code

export type PlayerState = 'IDLE' | 'SWING_DRIVE' | 'SWING_CUT';

export class Player {
    public mesh: THREE.Group;
    public state: PlayerState = 'IDLE';
    public velocity = new THREE.Vector3();
    private prevVelocity = new THREE.Vector3();
    public targetPosition: THREE.Vector2;
    public isAi: boolean;
    public predictedHitPosition = new THREE.Vector2();
    public side: number;
    public aiController?: AIController;

    // --- Status System Properties ---
    /** The player's current status/stamina. Decreases with effort, affecting accuracy. */
    public status: number;
    /** The maximum value for the player's status. */
    public statusMax: number;

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

    // Constants for AutoMove feature
    private readonly MOVEMENT_ACCELERATION = 0.05;
    private readonly RALLY_MAX_SPEED = 4.0;
    private readonly POSITIONING_MAX_SPEED = 1.0;

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

        this.status = STATUS_MAX;
        this.statusMax = STATUS_MAX;

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
        // 変更: プレイヤーサイド(side === 1)の場合、ボールがバウンドする前(status === 2)でも打てるようにする
        if (((ball.status === 3 || ball.status === 2) && this.side === 1) || // Player's side
            (ball.status === 1 && this.side === -1)) { // AI's side
            return true;
        }
        return false;
    }

    /**
     * Executes the logic for hitting the ball.
     * @param ball The ball object.
     */
    /**
     * Executes the logic for hitting the ball, including applying status-based errors for AI.
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
            const velocity = ball.calculateRallyHitVelocity(this.targetPosition, this.spin);

            // For AI players, introduce errors based on their current status to simulate fatigue.
            if (this.isAi) {
                this.addError(velocity, ball);
            }

            // Hit the ball with the calculated (and possibly modified) velocity and player's spin.
            ball.hit(velocity, this.spin);
            ball.justHitBySide = this.side;

            // Reduce status after hitting. The penalty is proportional to the shot's power.
            // This is a simplified port of the C++ `m_afterSwing` logic.
            const afterSwingPenalty = velocity.length();
            this.addStatus(-afterSwingPenalty);
        }
    }

    private isOpponentHit(ball: Ball): boolean {
        const status = ball.status;
        const side = this.side;
        // Opponent has hit the ball and it's heading towards our side
        if ((status === 0 && side === -1) || (status === 2 && side === 1)) {
            return true;
        }
        // Opponent's hit has bounced on our side
        if ((status === 1 && side === -1) || (status === 3 && side === 1)) {
            return true;
        }
        return false;
    }

    public predictOptimalPlayerPosition(ball: Ball): { position: THREE.Vector3; isBounceHit: boolean; trajectory: THREE.Vector3[]; hitIndex: number; } {
        const simBall = ball.clone();
        const trajectory: THREE.Vector3[] = [];
        let maxHeight = -1.0;
        const peakPosition = new THREE.Vector3();
        let hitIndex = -1;

        // Simulate for a maximum number of steps to find the peak after a bounce.
        for (let i = 0; i < 500; i++) {
            trajectory.push(simBall.mesh.position.clone());

            // Condition to check if the ball has bounced on the player's side.
            if ((simBall.status === 3 && this.side === 1) || (simBall.status === 1 && this.side === -1)) {
                // If it has bounced, find the highest point (peak) of the trajectory.
                if (simBall.mesh.position.y > maxHeight) {
                    // The original C++ code has a peculiar condition to only consider the peak
                    // if it occurs very close to the table's baseline. This is crucial.
                    if (Math.abs(simBall.mesh.position.z) < TABLE_LENGTH / 2 + 1.0 &&
                        Math.abs(simBall.mesh.position.z) > TABLE_LENGTH / 2 - 0.5)
                    {
                        maxHeight = simBall.mesh.position.y;
                        peakPosition.copy(simBall.mesh.position);
                        hitIndex = i;
                    }
                }
            }

            // Advance the physics simulation by one frame.
            const oldPos = simBall.mesh.position.clone();
            simBall._updatePhysics(0.02); // 50Hz tick rate
            simBall.checkCollision(oldPos);

            // Stop the simulation if the ball becomes "dead".
            if (simBall.status < 0) {
                break;
            }
        }

        // If a valid peak was found during the simulation, return its position.
        if (hitIndex !== -1) {
            return { position: peakPosition, isBounceHit: true, trajectory, hitIndex };
        } else {
            // If no valid peak is found (e.g., ball goes out of bounds), return a default "home" position.
            const fallbackPosition = new THREE.Vector3(0, 0, this.side * (TABLE_LENGTH / 2 + 0.5));
            return { position: fallbackPosition, isBounceHit: false, trajectory, hitIndex: -1 };
        }
    }

    private shouldAutoMove(): boolean {
        if (this.swing <= 0) {
            return false; // Not swinging
        }

        const swingParams = stype.get(this.swingType);
        if (!swingParams) {
            return false; // Not a valid swing type
        }

        // Activate AutoMove after the backswing is complete and before the ball is hit.
        return this.swing > swingParams.backswing && this.swing < swingParams.hitStart;
    }

    /**
     * Automatically calculates the desired velocity to move the player
     * towards an optimal hitting position.
     * @param ball The ball object.
     */
    public autoMove(ball: Ball) {
        // This function is only called during the swing, to make final adjustments.
        // It should not move the player to a "home" position.

        // 1. We must be able to hit the ball.
        if (!this.canHitBall(ball)) {
            // Safety check, should not happen if called at the right time.
            // Dampen velocity to prevent residual movement.
            this.velocity.lerp(new THREE.Vector3(0, 0, 0), 0.1);
            return;
        }

        // 2. Predict where the player should be.
        const prediction = this.predictOptimalPlayerPosition(ball);
        if (!prediction || !prediction.position) {
            // Prediction failed, do not move. Dampen velocity.
            this.velocity.lerp(new THREE.Vector3(0, 0, 0), 0.1);
            return;
        }

        const targetPosition = prediction.position;
        this.predictedHitPosition.copy(targetPosition); // Store for potential debugging/drawing

        // 3. Calculate desired velocity to move towards the target
        const direction = new THREE.Vector3(
            targetPosition.x - this.mesh.position.x,
            0,
            targetPosition.y - this.mesh.position.z
        );

        const distance = direction.length();
        if (distance < 0.05) { // Already at the target, reduce velocity to zero
            this.velocity.lerp(new THREE.Vector3(0, 0, 0), 0.1);
            return;
        }

        // 3. Set velocity based on distance and situation
        const maxSpeed = this.isOpponentHit(ball) ? this.RALLY_MAX_SPEED : this.POSITIONING_MAX_SPEED;

        // A simple proportional control for velocity, accelerates towards target
        let targetVelocity = direction.normalize().multiplyScalar(maxSpeed);

        // Smoothly adjust velocity towards the target velocity
        this.velocity.lerp(targetVelocity, this.MOVEMENT_ACCELERATION);
    }

    private _updateSwing(ball: Ball) {
        if (this.swing <= 0) return;

        const swingParams = stype.get(this.swingType);
        if (!swingParams) {
            this.swing = 0; // Invalid swing type, reset
            return;
        }

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
    }

    private _updateMovement(deltaTime: number, ball: Ball, game: Game) {
        if (!this.isAi) {
            // --- Human-controlled movement ---
            let manualMove = false;
            if (inputManager.isPointerLocked) {
                const movement = inputManager.getMouseMovement();
                if (movement.x !== 0 || movement.y !== 0) {
                    // Manual override: directly move the player and reset auto-move velocity
                    this.mesh.position.x += movement.x * PLAYER_MOVE_SENSITIVITY_X;
                    this.mesh.position.z += movement.y * PLAYER_MOVE_SENSITIVITY_Z;
                    this.velocity.set(0, 0, 0);
                    manualMove = true;
                }
            }

            if (!manualMove) {
                if (this.shouldAutoMove()) {
                    // If no manual input and in the correct swing phase, let AutoMove calculate the velocity
                    this.autoMove(ball);
                } else {
                    // AutoMove is not active, so smoothly dampen the velocity to zero.
                    this.velocity.lerp(new THREE.Vector3(0, 0, 0), 0.1);
                }
            }
        } else {
            // --- AI-controlled movement ---
            if (this.aiController) {
                this.aiController.update(deltaTime, game);
            }
        }

        // Apply velocity from AutoMove (human) or AI controller to the player's position
        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

        // --- Boundary checks for all players ---
        const halfArenaX = AREAXSIZE / 2;
        if (this.mesh.position.x < -halfArenaX) {
            this.mesh.position.x = -halfArenaX;
            this.velocity.x = 0;
        }
        if (this.mesh.position.x > halfArenaX) {
            this.mesh.position.x = halfArenaX;
            this.velocity.x = 0;
        }

        const halfTableZ = TABLE_LENGTH / 2;
        if (this.side === 1) { // Near side player
            if (this.mesh.position.z < halfTableZ) {
                this.mesh.position.z = halfTableZ;
                this.velocity.z = 0;
            }
            if (this.mesh.position.z > AREAYSIZE) {
                this.mesh.position.z = AREAYSIZE;
                this.velocity.z = 0;
            }
        } else { // Far side player
            if (this.mesh.position.z > -halfTableZ) {
                this.mesh.position.z = -halfTableZ;
                this.velocity.z = 0;
            }
            if (this.mesh.position.z < -AREAYSIZE) {
                this.mesh.position.z = -AREAYSIZE;
                this.velocity.z = 0;
            }
        }
    }

    /**
     * Introduces an error to the ball's velocity based on the player's status.
     * A lower status results in a larger potential error, making shots less accurate.
     * This method is a direct port of the logic from the original C++ `Player::AddError`.
     * @param v The calculated velocity vector of the ball, which will be modified.
     * @param ball The ball object, used to get its position and spin properties.
     */
    private addError(v: THREE.Vector3, ball: Ball) {
        const playerPos = this.mesh.position;
        const ballPos = ball.mesh.position;

        // Calculate the difference between player and ball, factoring in an ideal hit offset.
        // This simulates how far off the player was from a "perfect" hit position.
        const xDiff = (Math.abs(playerPos.x - ballPos.x) - 0.3) / 0.3;
        const yDiff = (playerPos.z - ballPos.z) / 0.3; // Note: player's Y in 2D is Z in 3D space

        // Calculate the base error radius. It's larger if the player is further from the ideal hit point
        // and is amplified by the ball's existing spin.
        let radDiff = Math.hypot(xDiff * (1 + Math.abs(ball.spin.x)), yDiff * (1 + Math.abs(ball.spin.y)));

        // The core of the difficulty logic: The error radius is scaled by the inverse of the player's status.
        // A full status (200) results in almost no error, while a low status results in a large error.
        radDiff *= (this.statusMax - this.status) / this.statusMax * (Math.PI / 12);

        const vl = v.length();
        if (vl === 0) return; // No velocity, no error to add.

        // To apply the error, we create an "error cone" around the velocity vector.
        // First, find two vectors (n1, n2) that are orthogonal to the velocity vector 'v'.
        const n1 = new THREE.Vector3();
        const n2 = new THREE.Vector3();
        const vNorm = v.clone().normalize();

        // Create a non-parallel vector to get the first orthogonal vector using cross product.
        let nonParallel = new THREE.Vector3(1, 0, 0);
        if (Math.abs(vNorm.x) > 0.9) { // If v is mostly aligned with the x-axis, use y-axis instead.
            nonParallel = new THREE.Vector3(0, 1, 0);
        }
        n1.crossVectors(vNorm, nonParallel).normalize();
        n2.crossVectors(vNorm, n1).normalize(); // The second is orthogonal to both v and n1.

        // Pick a random direction within the error cone.
        const radRand = Math.random() * 2 * Math.PI;

        // Calculate the final error vector and add it to the original velocity.
        const errorMagnitude = vl * Math.tan(radDiff);
        const errorVector = n1.multiplyScalar(Math.cos(radRand)).add(n2.multiplyScalar(Math.sin(radRand))).multiplyScalar(errorMagnitude);

        v.add(errorVector);
    }


    /**
     * Modifies the player's status by a given amount, clamping it within the valid range [1, statusMax].
     * @param diff The amount to add to the status (can be negative).
     */
    public addStatus(diff: number) {
        this.status += diff;
        if (this.status > this.statusMax) {
            this.status = this.statusMax;
        }
        if (this.status < 1) {
            this.status = 1;
        }
    }

    /**
     * Resets the player's status to its maximum value. Called at the end of each point.
     */
    public resetStatus() {
        this.status = this.statusMax;
    }

    /**
     * Main update loop for the player.
     * @param deltaTime Time since last frame.
     * @param ball The ball object.
     * @param game The main game object.
     */
    public update(deltaTime: number, ball: Ball, game: Game) {
        // Store previous velocity for acceleration calculation before any updates.
        this.prevVelocity.copy(this.velocity);

        this._updateSwing(ball);
        this._updateMovement(deltaTime, ball, game);
        this.mixer.update(deltaTime);

        // --- Status Reduction Logic (ported from Player::Move in C++) ---
        // This section simulates player fatigue and effort.

        const swingParams = stype.get(this.swingType);
        if (swingParams) {
            // Penalize status for being in the middle of a swing motion.
            if (this.swing > swingParams.backswing) {
                this.addStatus(SWING_PENALTY);
            }
        }

        // Penalize status for running too fast.
        if (this.velocity.length() > RUN_SPEED) {
            this.addStatus(RUN_PENALTY);
        }

        // Reward status for moving slowly or standing still.
        if (this.velocity.length() < WALK_SPEED) {
            this.addStatus(WALK_BONUS);
        }

        // Penalize status for accelerating too quickly (the "Handicap").
        // This prevents the AI from making jerky, superhuman movements.
        // Note: We currently don't have gameLevel in the TS port, so we use the hardest level's limit.
        if (this.velocity.distanceTo(this.prevVelocity) / deltaTime > ACCEL_LIMIT[3]) { // Using LEVEL_HARD index
            this.addStatus(ACCEL_PENALTY);
        }

        // Reset status if the point is over (ball is dead or ready for serve).
        if (ball.status === -1 || ball.status === 8) {
            this.resetStatus();
        }
    }
}
