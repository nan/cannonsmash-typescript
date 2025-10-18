// ts-port/src/Player.ts (New Version)
import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { inputManager } from './InputManager';
import {
    AREAXSIZE, AREAYSIZE, TABLE_LENGTH, SERVE_MIN, SERVE_NORMAL, SERVE_MAX, SERVEPARAM, stype, SWING_NORMAL, TABLE_HEIGHT, SWING_DRIVE, SWING_CUT, TABLE_WIDTH, NET_HEIGHT, SWING_POKE, SWING_SMASH, SPIN_NORMAL, SPIN_POKE, SPIN_DRIVE, SPIN_SMASH, PLAYER_MOVE_SENSITIVITY_X, PLAYER_MOVE_SENSITIVITY_Z,
    STATUS_MAX, RUN_SPEED, RUN_PENALTY, SWING_PENALTY, WALK_SPEED, WALK_BONUS, ACCEL_LIMIT, ACCEL_PENALTY
} from './constants';
import { Ball } from './Ball';
import { BallStatus } from './BallStatus';
import { AIController } from './AIController';
import type { Game } from './Game';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

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

    public status: number;
    public statusMax: number;

    public swingType: number = SWING_NORMAL;
    public swing: number = 0;
    public spin = new THREE.Vector2();

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

        if (this.animationClips['Fnormal']) {
            this.playAnimation('Fnormal', true);
        } else if (Object.keys(this.animationClips).length > 0) {
            this.playAnimation(Object.keys(this.animationClips)[0], true);
        }
    }

    private setupModelFromGltf(gltf: GLTF) {
        // Clone the model to ensure each player instance has a unique object
        const model = SkeletonUtils.clone(gltf.scene);

        model.scale.set(1.0, 1.0, 1.0);
        model.position.y = -0.8;
        model.rotation.y = 0; // Adjust rotation to face the table

        this.mesh.add(model);

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
                            newMat.opacity = 0.2;
                            return newMat;
                        });
                    } else {
                        const newMat = meshChild.material.clone();
                        newMat.transparent = true;
                        newMat.opacity = 0.2;
                        meshChild.material = newMat;
                    }
                }
            });
        }

        this.mixer = new THREE.AnimationMixer(model);
        // IMPORTANT: Use the animations from the original GLTF, not the cloned one.
        console.log('Loaded animation clips:');
        gltf.animations.forEach((clip) => {
            console.log(`- ${clip.name}`);
            this.animationClips[clip.name] = clip.clone();
        });
    }

    public setState(newState: PlayerState) {
        if (this.state === newState) return;
        this.state = newState;

        switch (this.state) {
            case 'IDLE':
                // Default to Fnormal for the idle animation.
                this.playAnimation('Fnormal', true);
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
        console.log(`Playing animation: ${name}`);
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
                this.currentAction.fadeOut(0.2);
            }
            newAction.reset().fadeIn(0.2).play();

            this.currentAction = newAction;
        } else {
            console.warn(`Animation clip not found: ${name}`);
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
        this.playAnimation('Fddrive', false);
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
        for (let i = 0; i < 20; i++) {
            const oldPos = tmpBall.mesh.position.clone();
            tmpBall._updatePhysics(0.01);
            tmpBall.checkCollision(oldPos);
        }
        const isForehand = (this.mesh.position.x - tmpBall.mesh.position.x) * this.side < 0;
        const spinCategory = isForehand ? 3 : 1;
        const swingType = this.determineSwingType(tmpBall, isForehand);
        return { swingType, spinCategory };
    }

    public startSwing(ball: Ball, spinCategory: number) {
        if (this.swing > 0) return false;
        const isForehand = spinCategory === 3;
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
                animationName = 'Fddrive';
                break;
            case SWING_CUT:
                animationName = isForehand ? 'Fcut' : 'Bcut';
                break;
            default:
                animationName = isForehand ? 'Fnormal' : 'Bnormal';
                break;
        }
        this.swing = 1;
        this.playAnimation(animationName, false);
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
            const level = 0.9;
            const velocity = ball.targetToVS(this, this.targetPosition, level, this.spin);
            ball.hit(velocity, this.spin);
            ball.justHitBySide = this.side;
        } else if (this.canHitBall(ball)) {
            const velocity = ball.calculateRallyHitVelocity(this.targetPosition, this.spin);
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
        let maxHeight = -1.0;
        const peakPosition = new THREE.Vector3();
        let hitIndex = -1;
        for (let i = 0; i < 500; i++) {
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
            simBall._updatePhysics(0.02);
            simBall.checkCollision(oldPos);
            if (simBall.status < 0) { break; }
        }
        if (hitIndex !== -1) {
            return { position: peakPosition, isBounceHit: true, trajectory, hitIndex };
        } else {
            const fallbackPosition = new THREE.Vector3(0, 0, this.side * (TABLE_LENGTH / 2 + 0.5));
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
        if (!this.canHitBall(ball)) { this.velocity.lerp(new THREE.Vector3(0, 0, 0), 0.1); return; }
        const prediction = this.predictOptimalPlayerPosition(ball);
        if (!prediction || !prediction.position) { this.velocity.lerp(new THREE.Vector3(0, 0, 0), 0.1); return; }
        const targetPosition = prediction.position;
        this.predictedHitPosition.copy(targetPosition);
        const direction = new THREE.Vector3(targetPosition.x - this.mesh.position.x, 0, targetPosition.y - this.mesh.position.z);
        const distance = direction.length();
        if (distance < 0.05) { this.velocity.lerp(new THREE.Vector3(0, 0, 0), 0.1); return; }
        const maxSpeed = this.isOpponentHit(ball) ? this.RALLY_MAX_SPEED : this.POSITIONING_MAX_SPEED;
        let targetVelocity = direction.normalize().multiplyScalar(maxSpeed);
        this.velocity.lerp(targetVelocity, this.MOVEMENT_ACCELERATION);
    }

    private _updateSwing(ball: Ball) {
        if (this.swing <= 0) return;
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
            this.swing = 0;
            if (this.swingType >= SERVE_MIN) { this.swingType = SWING_NORMAL; }
            this.setState('IDLE');
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
                else { this.velocity.lerp(new THREE.Vector3(0, 0, 0), 0.1); }
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
        const xDiff = (Math.abs(playerPos.x - ballPos.x) - 0.3) / 0.3;
        const yDiff = (playerPos.z - ballPos.z) / 0.3;
        let radDiff = Math.hypot(xDiff * (1 + Math.abs(ball.spin.x)), yDiff * (1 + Math.abs(ball.spin.y)));
        radDiff *= (this.statusMax - this.status) / this.statusMax * (Math.PI / 12);
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
