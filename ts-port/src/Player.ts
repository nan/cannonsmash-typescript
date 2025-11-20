// ts-port/src/Player.ts (New Version)
import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { inputManager } from './InputManager';
import {
    AREAXSIZE, AREAYSIZE, TABLE_LENGTH, TABLE_HEIGHT, TABLE_WIDTH, NET_HEIGHT, TICK,
} from './constants';
import { Ball, BallStatus } from './Ball';
import { AIController } from './AIController';
import type { Game } from './Game';
import { stype, SWING_NORMAL, SWING_POKE, SWING_SMASH, SWING_DRIVE, SWING_CUT, SWING_BLOCK, SERVE_MIN, SERVE_MAX, SERVE_NORMAL, SERVE_POKE, SERVE_SIDESPIN1, SERVE_SIDESPIN2, type SwingType } from './SwingTypes';

// Player spin constants
export const SPIN_NORMAL = 0.4;
export const SPIN_POKE = -0.8;
export const SPIN_DRIVE = 0.8;
export const SPIN_SMASH = 0.2;


// Corresponds to SERVEPARAM in Player.h
export const SERVEPARAM: number[][] = [
    [SERVE_NORMAL, 0.0, 0.0, 0.0, 0.1, 0.0, 0.2],
    [SERVE_POKE, 0.0, 0.0, 0.0, -0.3, 0.0, -0.6],
    [SERVE_SIDESPIN1, -0.6, 0.2, -0.8, 0.0, -0.6, -0.2],
    [SERVE_SIDESPIN2, 0.6, 0.2, 0.8, 0.0, 0.6, -0.2],
    [-1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
];

// --- Status System Constants (from Player.h) ---
export const STATUS_MAX = 200;
export const RUN_SPEED = 2.0;
export const RUN_PENALTY = -1;
export const SWING_PENALTY = -1;
export const WALK_SPEED = 1.0;
export const WALK_BONUS = 1;
export const ACCEL_LIMIT = [0.8, 0.7, 0.6, 0.5]; // Corresponds to gameLevel {EASY, NORMAL, HARD, TSUBORISH}
export const ACCEL_PENALTY = -1;
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Player movement sensitivity when using Pointer Lock
const PLAYER_MOVE_SENSITIVITY_X = 0.003;
const PLAYER_MOVE_SENSITIVITY_Z = 0.003;

// --- Player Constants ---
const PLAYER_MODEL_Y_OFFSET = -0.8;
const HUMAN_PLAYER_OPACITY = 0.2;
const ANIMATION_FADE_DURATION = 0.2;

const PREDICTION_INVALID_HEIGHT = -1.0;
const PREDICTION_MAX_FRAMES = 500;
const PREDICTION_TIME_STEP = 0.02; // 50 Hz simulation for prediction
const SHORT_SIMULATION_TIME_STEP = 0.01; // 100 Hz for short-term swing prediction
const SHORT_SIMULATION_FRAMES_SWING = 10;
const SHORT_SIMULATION_FRAMES_PREDICT = 20;

const PLAYER_FALLBACK_Z_OFFSET = 0.5;
const PLAYER_VELOCITY_LERP_FACTOR = 0.1;
const AUTO_MOVE_DISTANCE_THRESHOLD = 0.05;

const AI_ERROR_POSITION_SENSITIVITY = 0.3;
const AI_ERROR_MAX_ANGLE_RAD = Math.PI / 12;

const SERVE_HIT_LEVEL = 0.9;


export type PlayerState = 'IDLE' | 'BACKSWING' | 'SWING_DRIVE' | 'SWING_CUT';

export class Player {
    public mesh: THREE.Group;
    public state: PlayerState = 'IDLE';
    public isInBackswing = false;
    public velocity = new THREE.Vector3();
    private prevVelocity = new THREE.Vector3();
    public targetPosition: THREE.Vector2;
    public isAi: boolean;
    public predictedHitPosition = new THREE.Vector2();
    public side: number;
    public aiController?: AIController;

    public status: number;
    public statusMax: number;

    public swingType: number = SWING_NORMAL;
    public swing: number = 0;
    public spin = new THREE.Vector2();
    public intendedShotStrength: number = 1.0;

    private assets: GameAssets;
    private mixer!: THREE.AnimationMixer;
    private animationClips: { [name: string]: THREE.AnimationClip } = {};
    private currentAction: THREE.AnimationAction | null = null;

    private readonly MOVEMENT_ACCELERATION = 0.05;
    private readonly RALLY_MAX_SPEED = 4.0;
    private readonly POSITIONING_MAX_SPEED = 1.0;

    constructor(assets: GameAssets, isAi = false, side: number = 1) {
        this.assets = assets;
        this.isAi = isAi;
        this.side = side;
        this.targetPosition = new THREE.Vector2(0, -this.side * TABLE_LENGTH / 4);

        this.mesh = new THREE.Group();

        this.status = STATUS_MAX;
        this.statusMax = STATUS_MAX;

        if (this.assets.playerModel) {
            this.setupModelFromGltf(this.assets.playerModel);
        } else {
            console.error("Player model not found in assets!");
        }

        if (this.animationClips['Default']) {
            this.playAnimation('Default', true);
        } else if (Object.keys(this.animationClips).length > 0) {
            this.playAnimation(Object.keys(this.animationClips)[0], true);
        }
    }

    private setupModelFromGltf(gltf: GLTF) {
        // Clone the model to ensure each player instance has a unique object
        const model = SkeletonUtils.clone(gltf.scene);

        model.scale.set(1.0, 1.0, 1.0);
        model.position.y = PLAYER_MODEL_Y_OFFSET;
        model.rotation.y = 0; // Adjust rotation to face the table

        this.mesh.add(model);

        // Convert all materials to MeshStandardMaterial to ensure they react to lighting
        model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const meshChild = child as THREE.Mesh;

                const convertMaterial = (oldMat: THREE.Material): THREE.MeshStandardMaterial => {
                    const newMat = new THREE.MeshStandardMaterial();
                    // Copy essential properties from the old material
                    if ((oldMat as any).color) {
                        newMat.color.copy((oldMat as any).color);
                    }
                    if ((oldMat as any).map) {
                        newMat.map = (oldMat as any).map;
                    }
                    // Ensure the new material is not transparent by default
                    newMat.transparent = false;
                    return newMat;
                };

                if (Array.isArray(meshChild.material)) {
                    meshChild.material = meshChild.material.map(convertMaterial);
                } else {
                    meshChild.material = convertMaterial(meshChild.material);
                }
            }
        });

        // Make the human player (side 1) semi-transparent
        if (this.side === 1) {
            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const meshChild = child as THREE.Mesh;

                    // To prevent modifying the material shared with the other player,
                    // we clone it before making it transparent.
                    if (Array.isArray(meshChild.material)) {
                        meshChild.material = meshChild.material.map(mat => {
                            const newMat = mat.clone();
                            newMat.transparent = true;
                            newMat.opacity = HUMAN_PLAYER_OPACITY;
                            return newMat;
                        });
                    } else {
                        const newMat = meshChild.material.clone();
                        newMat.transparent = true;
                        newMat.opacity = HUMAN_PLAYER_OPACITY;
                        meshChild.material = newMat;
                    }
                }
            });
        }

        this.mixer = new THREE.AnimationMixer(model);
        // IMPORTANT: Use the animations from the original GLTF, not the cloned one.
        gltf.animations.forEach((clip) => {
            this.animationClips[clip.name] = clip;
        });

        // Add a listener for when animations finish.
        this.mixer.addEventListener('finished', (e) => {
            // If the finished animation was not set to loop, transition to IDLE.
            if (e.action.getClip().duration > 0 && e.action.loop !== THREE.LoopRepeat) {
                this.swing = 0;
                this.isInBackswing = false;
                if (this.swingType >= SERVE_MIN) {
                    this.swingType = SWING_NORMAL;
                }
                this.setState('IDLE');
            }
        });
    }

    public setState(newState: PlayerState) {
        if (this.state === newState) return;
        this.state = newState;

        switch (this.state) {
            case 'IDLE':
                this.isInBackswing = false;
                // Default to Fnormal for the idle animation.
                this.playAnimation('Default', true);
                break;
            case 'BACKSWING':
                // This state is managed by the backswing logic, no animation change needed here.
                break;
            // Other states are mainly for triggering one-shot animations,
            // which is handled directly in the swing/serve methods.
            // This switch can be expanded if more persistent states are needed.
            case 'SWING_DRIVE':
            case 'SWING_CUT':
                // These states are transient and will be immediately followed by IDLE
                // once the swing animation finishes, so no action is needed here.
                break;
        }
    }

    public playAnimation(name: string, loop = true) {
        if (!this.mixer) return;

        if (this.currentAction?.getClip()?.name === name && this.currentAction.isRunning()) {
            return;
        }
        const clip = this.animationClips[name];
        if (clip) {
            const newAction = this.mixer.clipAction(clip);
            newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
            newAction.clampWhenFinished = !loop;

            if (this.currentAction) {
                this.currentAction.fadeOut(ANIMATION_FADE_DURATION);
            }
            newAction.reset().fadeIn(ANIMATION_FADE_DURATION).play();

            this.currentAction = newAction;
        } else {
            console.warn(`Animation clip not found: "${name}". Falling back to a default.`);
            // Determine fallback based on the first letter of the requested animation name.
            const fallbackName = name.startsWith('B') ? 'Bnormal' : 'Fnormal';
            const fallbackClip = this.animationClips[fallbackName];

            if (fallbackClip && name !== fallbackName) {
                // To avoid recursion if the fallback is *also* missing, we directly call clipAction.
                const newAction = this.mixer.clipAction(fallbackClip);
                newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
                newAction.clampWhenFinished = !loop;

                if (this.currentAction) {
                    this.currentAction.fadeOut(ANIMATION_FADE_DURATION);
                }
                newAction.reset().fadeIn(ANIMATION_FADE_DURATION).play();

                this.currentAction = newAction;
            } else if (!fallbackClip) {
                console.error(`Default animation clips "Fnormal" or "Bnormal" not found!`);
            }
        }
    }

    public changeServeType() {
        if (this.swing > 0) return;
        if (this.swingType < SERVE_MIN) { this.swingType = SERVE_NORMAL; } else { this.swingType++; }
        if (this.swingType > SERVE_MAX) { this.swingType = SERVE_MIN; }
    }

    public canServe(ball: Ball): boolean {
        return (ball.status === BallStatus.TOSS_P1 && this.side === 1) || (ball.status === BallStatus.TOSS_P2 && this.side === -1);
    }

    public startServe(spinCategory: number) {
        if (this.swing > 0) return false;
        this.swingType = SERVE_NORMAL;
        this.swing = 1;
        const params = SERVEPARAM.find(p => p[0] === this.swingType);
        if (params) {
            this.spin.x = params[(spinCategory - 1) * 2 + 1];
            this.spin.y = params[(spinCategory - 1) * 2 + 2];
        } else {
            this.spin.x = 0;
            this.spin.y = 0;
        }
        this.playAnimation('Fcut', false);
        return true;
    }

    private determineSwingType(ball: Ball, isForehand: boolean): number {
        this.spin.x = 0.0;
        if (this.canHitBall(ball)) {
            const ballPos = ball.mesh.position;
            const ballSpinY = ball.spin.y;
            if (Math.abs(ballPos.x) < TABLE_WIDTH / 2 && Math.abs(ballPos.z) < TABLE_LENGTH / 2 && (ballPos.y - TABLE_HEIGHT - NET_HEIGHT) / Math.abs(ballPos.z) < NET_HEIGHT / (TABLE_LENGTH / 2) * 0.5) {
                if (ballSpinY < 0) { this.spin.y = SPIN_POKE; return SWING_POKE; }
                else { this.spin.y = SPIN_NORMAL; return SWING_NORMAL; }
            } else if (ballPos.y < TABLE_HEIGHT + NET_HEIGHT) {
                if (isForehand) { this.spin.y = SPIN_DRIVE; return SWING_DRIVE; }
                else {
                    if (ballSpinY < 0) { this.spin.y = SPIN_POKE; return SWING_POKE; }
                    else { this.spin.y = SPIN_NORMAL; return SWING_NORMAL; }
                }
            } else if (Math.abs(ballPos.z) < TABLE_LENGTH / 2 + 1.0 && ballPos.y > TABLE_HEIGHT + NET_HEIGHT) {
                this.spin.y = SPIN_SMASH; return SWING_SMASH;
            } else { this.spin.y = SPIN_NORMAL; return SWING_NORMAL; }
        } else { this.spin.y = SPIN_NORMAL; return SWING_NORMAL; }
    }

    public getPredictedSwing(ball: Ball): { swingType: number, spinCategory: number } {
        const tmpBall = ball.clone();
        for (let i = 0; i < SHORT_SIMULATION_FRAMES_PREDICT; i++) {
            const oldPos = tmpBall.mesh.position.clone();
            tmpBall._updatePhysics(SHORT_SIMULATION_TIME_STEP);
            tmpBall.checkCollision(oldPos);
        }
        const isForehand = (this.mesh.position.x - tmpBall.mesh.position.x) * this.side < 0;
        const spinCategory = isForehand ? 3 : 1;
        const swingType = this.determineSwingType(tmpBall, isForehand);
        return { swingType, spinCategory };
    }

    public startSwing(ball: Ball, spinCategory: number) {
        if (this.swing > 0 || this.isInBackswing) return false;
        return this.startBackswing(ball, spinCategory);
    }

    public startBackswing(ball: Ball, spinCategory: number) {
        if (this.swing > 0 || this.isInBackswing) return false;

        const isForehand = spinCategory === 3;
        const tmpBall = ball.clone();
        for (let i = 0; i < SHORT_SIMULATION_FRAMES_SWING; i++) {
            const oldPos = tmpBall.mesh.position.clone();
            tmpBall._updatePhysics(SHORT_SIMULATION_TIME_STEP);
            tmpBall.checkCollision(oldPos);
        }
        this.swingType = this.determineSwingType(tmpBall, isForehand);
        let animationName: string;
        switch (this.swingType) {
            case SWING_DRIVE: animationName = 'Fdrive'; break;
            case SWING_SMASH: animationName = 'Fsmash'; break;
            case SWING_CUT: animationName = isForehand ? 'Fcut' : 'Bcut'; break;
            case SWING_POKE: animationName = isForehand ? 'Fpeck' : 'Bpeck'; break;
            case SWING_NORMAL:
            default: animationName = isForehand ? 'Fnormal' : 'Bnormal'; break;
        }

        this.setState('BACKSWING');
        this.isInBackswing = true;
        this.swing = 1;
        this.playAnimation(animationName, false);

        // Pause the animation at the peak of the backswing
        if (this.currentAction) {
            this.currentAction.paused = true;
            // Estimate backswing peak at 40% of the animation. This is a guess.
            const backswingPeakTime = this.currentAction.getClip().duration * 0.4;
            this.currentAction.time = backswingPeakTime;
        }

        return true;
    }

    public startForwardswing(strength: number = 1.0) {
        if (!this.isInBackswing || !this.currentAction) return false;

        this.isInBackswing = false;
        this.currentAction.paused = false;
        this.intendedShotStrength = strength;

        // The rest of the swing logic is handled by _updateSwing
        return true;
    }

    public canHitBall(ball: Ball): boolean {
        if (this.side === 1) { return ball.status === BallStatus.RALLY_TO_HUMAN; }
        else { return ball.status === BallStatus.RALLY_TO_AI; }
    }

    public canInitiateSwing(ball: Ball): boolean {
        const status = ball.status;
        if (this.side === 1) { return status === BallStatus.RALLY_TO_HUMAN || status === BallStatus.IN_PLAY_TO_HUMAN; }
        else { return status === BallStatus.RALLY_TO_AI || status === BallStatus.IN_PLAY_TO_AI; }
    }

    public hitBall(ball: Ball) {
        if (this.canServe(ball)) {
            const velocity = ball.targetToVS(this, this.targetPosition, SERVE_HIT_LEVEL, this.spin);
            ball.hit(velocity, this.spin);
            ball.justHitBySide = this.side;
        } else if (this.canHitBall(ball)) {
            let velocity = ball.calculateRallyHitVelocity(this.targetPosition, this.spin);

            // Apply shot strength if it's not a full power shot
            if (this.intendedShotStrength < 1.0) {
                const horizontalVelocity = new THREE.Vector2(velocity.x, velocity.z);
                const currentSpeed = horizontalVelocity.length();
                const targetSpeed = currentSpeed * this.intendedShotStrength;

                const adjustedVelocity = ball.calculateVelocityForHorizontalSpeed(this.targetPosition, targetSpeed, this.spin);
                if (adjustedVelocity) {
                    velocity = adjustedVelocity;
                }
            }

            if (this.isAi) { this.addError(velocity, ball); }
            ball.hit(velocity, this.spin);
            ball.justHitBySide = this.side;
            const afterSwingPenalty = velocity.length();
            this.addStatus(-afterSwingPenalty);
        }
    }

    private isOpponentHit(ball: Ball): boolean {
        const status = ball.status;
        const side = this.side;
        if ((status === BallStatus.RALLY_TO_AI && side === -1) || (status === BallStatus.IN_PLAY_TO_HUMAN && side === 1)) { return true; }
        if ((status === BallStatus.RALLY_TO_HUMAN && side === -1) || (status === BallStatus.IN_PLAY_TO_AI && side === 1)) { return true; }
        return false;
    }

    public predictOptimalPlayerPosition(ball: Ball): { position: THREE.Vector3; isBounceHit: boolean; trajectory: THREE.Vector3[]; hitIndex: number; } {
        const simBall = ball.clone();
        const trajectory: THREE.Vector3[] = [];
        let maxHeight = PREDICTION_INVALID_HEIGHT;
        const peakPosition = new THREE.Vector3();
        let hitIndex = -1;
        for (let i = 0; i < PREDICTION_MAX_FRAMES; i++) {
            trajectory.push(simBall.mesh.position.clone());
            if ((simBall.status === BallStatus.RALLY_TO_HUMAN && this.side === 1) || (simBall.status === BallStatus.RALLY_TO_AI && this.side === -1)) {
                if (simBall.mesh.position.y > maxHeight) {
                    if (Math.abs(simBall.mesh.position.z) < TABLE_LENGTH / 2 + 1.0 && Math.abs(simBall.mesh.position.z) > TABLE_LENGTH / 2 - 0.5) {
                        maxHeight = simBall.mesh.position.y;
                        peakPosition.copy(simBall.mesh.position);
                        hitIndex = i;
                    }
                }
            }
            const oldPos = simBall.mesh.position.clone();
            simBall._updatePhysics(PREDICTION_TIME_STEP);
            simBall.checkCollision(oldPos);
            if (simBall.status < 0) { break; }
        }
        if (hitIndex !== -1) {
            return { position: peakPosition, isBounceHit: true, trajectory, hitIndex };
        } else {
            const fallbackPosition = new THREE.Vector3(0, 0, this.side * (TABLE_LENGTH / 2 + PLAYER_FALLBACK_Z_OFFSET));
            return { position: fallbackPosition, isBounceHit: false, trajectory, hitIndex: -1 };
        }
    }

    private shouldAutoMove(): boolean {
        if (this.swing <= 0) { return false; }
        const swingParams = stype.get(this.swingType);
        if (!swingParams) { return false; }
        return this.swing > swingParams.backswing && this.swing < swingParams.hitStart;
    }

    public autoMove(ball: Ball) {
        if (!this.canHitBall(ball)) { this.velocity.lerp(new THREE.Vector3(0, 0, 0), PLAYER_VELOCITY_LERP_FACTOR); return; }
        const prediction = this.predictOptimalPlayerPosition(ball);
        if (!prediction || !prediction.position) { this.velocity.lerp(new THREE.Vector3(0, 0, 0), PLAYER_VELOCITY_LERP_FACTOR); return; }
        const targetPosition = prediction.position;
        this.predictedHitPosition.copy(targetPosition);
        const direction = new THREE.Vector3(targetPosition.x - this.mesh.position.x, 0, targetPosition.y - this.mesh.position.z);
        const distance = direction.length();
        if (distance < AUTO_MOVE_DISTANCE_THRESHOLD) { this.velocity.lerp(new THREE.Vector3(0, 0, 0), PLAYER_VELOCITY_LERP_FACTOR); return; }
        const maxSpeed = this.isOpponentHit(ball) ? this.RALLY_MAX_SPEED : this.POSITIONING_MAX_SPEED;
        let targetVelocity = direction.normalize().multiplyScalar(maxSpeed);
        this.velocity.lerp(targetVelocity, this.MOVEMENT_ACCELERATION);
    }

    private _updateSwing(ball: Ball) {
        if (this.swing <= 0) return;

        // Do not update the swing counter if we are in the backswing phase (animation is paused)
        if (this.isInBackswing) return;

        const swingParams = stype.get(this.swingType);
        if (!swingParams) { this.swing = 0; return; }

        if (this.canServe(ball)) {
            if (ball.velocity.y < 0) { this.swing++; }
        } else {
            if (this.swingType >= SERVE_MIN && swingParams.toss > 0 && this.swing === swingParams.toss) {
                ball.toss(this, swingParams.tossV);
            }
            this.swing++;
        }
        if (this.swing >= swingParams.hitStart && this.swing <= swingParams.hitEnd) { this.hitBall(ball); }
        if (this.swing >= swingParams.swingLength) {
            this.swing = 0; // Still need to reset swing here for safety, but state change is handled by event.
        }
    }

    private _updateMovement(deltaTime: number, ball: Ball, game: Game) {
        if (!this.isAi) {
            let manualMove = false;
            if (inputManager.isPointerLocked) {
                const movement = inputManager.getMouseMovement();
                if (movement.x !== 0 || movement.y !== 0) {
                    this.mesh.position.x += movement.x * PLAYER_MOVE_SENSITIVITY_X;
                    this.mesh.position.z += movement.y * PLAYER_MOVE_SENSITIVITY_Z;
                    this.velocity.set(0, 0, 0);
                    manualMove = true;
                }
            }
            if (!manualMove) {
                if (this.shouldAutoMove()) { this.autoMove(ball); }
                else { this.velocity.lerp(new THREE.Vector3(0, 0, 0), PLAYER_VELOCITY_LERP_FACTOR); }
            }
        } else {
            if (this.aiController) { this.aiController.update(deltaTime, game); }
        }
        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        const halfArenaX = AREAXSIZE / 2;
        if (this.mesh.position.x < -halfArenaX) { this.mesh.position.x = -halfArenaX; this.velocity.x = 0; }
        if (this.mesh.position.x > halfArenaX) { this.mesh.position.x = halfArenaX; this.velocity.x = 0; }
        const halfTableZ = TABLE_LENGTH / 2;
        if (this.side === 1) {
            if (this.mesh.position.z < halfTableZ) { this.mesh.position.z = halfTableZ; this.velocity.z = 0; }
            if (this.mesh.position.z > AREAYSIZE) { this.mesh.position.z = AREAYSIZE; this.velocity.z = 0; }
        } else {
            if (this.mesh.position.z > -halfTableZ) { this.mesh.position.z = -halfTableZ; this.velocity.z = 0; }
            if (this.mesh.position.z < -AREAYSIZE) { this.mesh.position.z = -AREAYSIZE; this.velocity.z = 0; }
        }
    }

    private addError(v: THREE.Vector3, ball: Ball) {
        const playerPos = this.mesh.position;
        const ballPos = ball.mesh.position;
        const xDiff = (Math.abs(playerPos.x - ballPos.x) - AI_ERROR_POSITION_SENSITIVITY) / AI_ERROR_POSITION_SENSITIVITY;
        const yDiff = (playerPos.z - ballPos.z) / AI_ERROR_POSITION_SENSITIVITY;
        let radDiff = Math.hypot(xDiff * (1 + Math.abs(ball.spin.x)), yDiff * (1 + Math.abs(ball.spin.y)));
        radDiff *= (this.statusMax - this.status) / this.statusMax * AI_ERROR_MAX_ANGLE_RAD;
        const vl = v.length();
        if (vl === 0) return;
        const n1 = new THREE.Vector3();
        const n2 = new THREE.Vector3();
        const vNorm = v.clone().normalize();
        let nonParallel = new THREE.Vector3(1, 0, 0);
        if (Math.abs(vNorm.x) > 0.9) { nonParallel = new THREE.Vector3(0, 1, 0); }
        n1.crossVectors(vNorm, nonParallel).normalize();
        n2.crossVectors(vNorm, n1).normalize();
        const radRand = Math.random() * 2 * Math.PI;
        const errorMagnitude = vl * Math.tan(radDiff);
        const errorVector = n1.multiplyScalar(Math.cos(radRand)).add(n2.multiplyScalar(Math.sin(radRand))).multiplyScalar(errorMagnitude);
        v.add(errorVector);
    }

    public addStatus(diff: number) {
        this.status += diff;
        if (this.status > this.statusMax) { this.status = this.statusMax; }
        if (this.status < 1) { this.status = 1; }
    }

    public resetStatus() {
        this.status = this.statusMax;
    }

    public update(deltaTime: number, ball: Ball, game: Game) {
        this.prevVelocity.copy(this.velocity);
        this._updateSwing(ball);
        this._updateMovement(deltaTime, ball, game);
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        const swingParams = stype.get(this.swingType);
        if (swingParams) {
            if (this.swing > swingParams.backswing) { this.addStatus(SWING_PENALTY); }
        }
        if (this.velocity.length() > RUN_SPEED) { this.addStatus(RUN_PENALTY); }
        if (this.velocity.length() < WALK_SPEED) { this.addStatus(WALK_BONUS); }
        if (this.velocity.distanceTo(this.prevVelocity) / deltaTime > ACCEL_LIMIT[3]) { this.addStatus(ACCEL_PENALTY); }
        if (ball.status === BallStatus.DEAD || ball.status === BallStatus.WAITING_FOR_SERVE) { this.resetStatus(); }
    }
}
