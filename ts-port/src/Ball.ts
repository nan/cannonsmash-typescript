/**
 * Represents the status of the ball during the game.
 * These values are ported from the original C++ implementation's logic.
 */
export enum BallStatus {
    /** The ball is dead and the point is over. */
    DEAD = -1,
    /** Ball is in rally, heading towards Player 2 (AI), after bouncing on Player 1's side. */
    RALLY_TO_AI = 0,
    /** Ball is in rally, heading towards Player 1 (Human), after bouncing on Player 2's side. */
    RALLY_TO_HUMAN = 1,
    /** Ball was hit by AI, now heading towards Player 1's side for a bounce. */
    IN_PLAY_TO_HUMAN = 2,
    /** Ball was hit by Human, now heading towards Player 2's side for a bounce. */
    IN_PLAY_TO_AI = 3,
    /** Ball was served by Player 1, heading towards Player 2's side for a bounce. */
    SERVE_TO_AI = 4,
    /** Ball was served by Player 2, heading towards Player 1's side for a bounce. */
    SERVE_TO_HUMAN = 5,
    /** Ball is being tossed for a serve by Player 1. */
    TOSS_P1 = 6,
    /** Ball is being tossed for a serve by Player 2. */
    TOSS_P2 = 7,
    /** Ball is waiting for the player to initiate a serve. */
    WAITING_FOR_SERVE = 8,
}

import * as THREE from 'three';
import { type Player, ShotPower } from './Player';
import { stype } from './SwingTypes';
import { TABLE_HEIGHT, TABLE_WIDTH, TABLE_LENGTH, NET_HEIGHT, TICK } from './constants';
import type { Game } from './Game';

// --- Physics Constants ---
const PHY = 0.15; // Air resistance coefficient
const GRAVITY_BASE = 9.8;
const MAGNUS_FORCE_FACTOR = 5;
const GRAVITY = (spin: number) => GRAVITY_BASE + spin * MAGNUS_FORCE_FACTOR;
const TABLE_E = 0.8; // Bounciness of the table
const BALL_RADIUS = 0.02;

// --- Collision Constants ---
const NET_COLLISION_VELOCITY_X_FACTOR = 0.5;
const NET_COLLISION_VELOCITY_Z_FACTOR = -0.2;
const NET_COLLISION_SPIN_X_FACTOR = -0.8;
const NET_COLLISION_SPIN_Y_FACTOR = -0.8;
const NET_COLLISION_Z_OFFSET = 0.001;
const TABLE_COLLISION_SPIN_X_FACTOR = 0.95;
const TABLE_COLLISION_SPIN_Y_FACTOR = 0.8;

// --- Game Logic Constants ---
const BALL_DEAD_TIMEOUT_FRAMES = 100;
const BALL_RESET_Y_OFFSET = 0.15;

// --- Calculation & Precision Constants ---
const UNREACHABLE_TIME = 10000;
const TIME_PRECISION_THRESHOLD = 0.001;
const VELOCITY_PRECISION_THRESHOLD = 1e-6;

// --- Serve Calculation Constants ---
const SERVE_CALC_V_MIN = 0.1;
const SERVE_CALC_V_MAX = 30.0;
const SERVE_CALC_ITERATIONS = 20;
const SERVE_CALC_PRECISION = 0.001;
const SERVE_CALC_HEIGHT_TOLERANCE = 0.05;
const SERVE_CALC_NET_CLEARANCE_BASE = 0.1;

// --- Fallback Calculation Constants ---
const FALLBACK_VELOCITY_BASE_SPEED = 7;
const FALLBACK_VELOCITY_DISTANCE_FACTOR = 3;
const FALLBACK_VELOCITY_Y_BASE = 1.0;
const FALLBACK_VELOCITY_Y_DISTANCE_FACTOR = 0.8;
const FALLBACK_SERVE_VELOCITY = new THREE.Vector3(0, 3, -5);


// Constants for the rally hit calculation
const RALLY_HIT_MAX_SPEED = 30.0;
const RALLY_HIT_MIN_SPEED = 0.5; // Lowered further to handle very slow shots like drop shots
const RALLY_CALC_ITERATIONS = 20; // Renamed from SERVE_CALC_ITERATIONS for clarity
const RALLY_CALC_PRECISION = 0.001; // Renamed from SERVE_CALC_PRECISION for clarity
const NET_CLEARANCE_MARGIN = 0.05;

// A constant representing an invalid or unfound velocity
const INVALID_VELOCITY = new THREE.Vector3(0, 0, 0);

export class Ball {
    public mesh: THREE.Mesh;
    public velocity = new THREE.Vector3();
    public spin = new THREE.Vector2();
    public status: BallStatus = BallStatus.WAITING_FOR_SERVE;
    public justHitBySide: number = 0; // 0: none, 1: player1, -1: player2 (AI)

    constructor() {
        const geometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        this.mesh = new THREE.Mesh(geometry, material);
    }

    /**
     * Creates a deep copy of this ball instance for simulation.
     * The mesh is not copied as it's not needed for physics simulation.
     */
    public clone(): Ball {
        const newBall = new Ball();
        newBall.mesh.position.copy(this.mesh.position);
        newBall.velocity.copy(this.velocity);
        newBall.spin.copy(this.spin);
        newBall.status = this.status;
        return newBall;
    }

    /**
     * Updates the ball's state for the game loop.
     * This includes physics, collision, and game state logic.
     */
    public update(deltaTime: number, game: Game) {
        if (this.status === BallStatus.WAITING_FOR_SERVE) { return; }

        // Handle the reset timer for a dead ball
        if (this.status < 0) { // DEAD is -1, so this check is fine
            this.status--;
            if (this.status < -BALL_DEAD_TIMEOUT_FRAMES) {
                const server = game.getService() === game.player1.side ? game.player1 : game.player2;
                this.reset(server);
                // Once reset, we skip the physics for this frame
                return;
            }
        }

        // Always run physics simulation unless ball is waiting for serve
        const oldPos = this.mesh.position.clone();
        this._updatePhysics(TICK);
        this.checkCollision(oldPos);
    }

    /**
     * Updates only the physics of the ball for a given time step.
     * Used for both the main game loop and AI simulation.
     * @param time The time step for the physics update (typically TICK).
     */
    public _updatePhysics(time: number) {
        const oldPos = this.mesh.position.clone();
        const oldVel = this.velocity.clone();
        const oldSpin = this.spin.clone();

        const exp_phy_t = Math.exp(-PHY * time);
        const rot = oldSpin.x / PHY - oldSpin.x / PHY * exp_phy_t;

        this.velocity.x = (oldVel.x * Math.cos(rot) - oldVel.z * Math.sin(rot)) * exp_phy_t;
        this.velocity.z = (oldVel.x * Math.sin(rot) + oldVel.z * Math.cos(rot)) * exp_phy_t;
        this.velocity.y = (oldVel.y + GRAVITY(oldSpin.y) / PHY) * exp_phy_t - GRAVITY(oldSpin.y) / PHY;

        if (Math.abs(oldSpin.x) < TIME_PRECISION_THRESHOLD) {
            this.mesh.position.x = oldPos.x + oldVel.x / PHY - oldVel.x / PHY * exp_phy_t;
            this.mesh.position.z = oldPos.z + oldVel.z / PHY - oldVel.z / PHY * exp_phy_t;
        } else {
            const theta = rot;
            const r = new THREE.Vector2(oldVel.z / oldSpin.x, -oldVel.x / oldSpin.x);
            this.mesh.position.x = r.x * Math.cos(theta) - r.y * Math.sin(theta) + oldPos.x - r.x;
            this.mesh.position.z = r.x * Math.sin(theta) + r.y * Math.cos(theta) + oldPos.z - r.y;
        }
        this.mesh.position.y = (PHY * oldVel.y + GRAVITY(oldSpin.y)) / (PHY * PHY) * (1 - exp_phy_t) - GRAVITY(oldSpin.y) / PHY * time + oldPos.y;
        this.spin.x = oldSpin.x * exp_phy_t;
    }

    public checkCollision(oldPos: THREE.Vector3) {
        const currentPos = this.mesh.position;

        // Net crossing and collision check
        if (oldPos.z * currentPos.z <= 0 && this.velocity.z !== 0) {
            const t = oldPos.z / (oldPos.z - currentPos.z);
            if (t >= 0 && t <= 1) {
                const collisionX = oldPos.x + (currentPos.x - oldPos.x) * t;
                const collisionY = oldPos.y + (currentPos.y - oldPos.y) * t;

                if (collisionX > -TABLE_WIDTH / 2 && collisionX < TABLE_WIDTH / 2 &&
                    collisionY > 0 && collisionY < TABLE_HEIGHT + NET_HEIGHT) {

                    // Apply physics
                    this.velocity.x *= NET_COLLISION_VELOCITY_X_FACTOR;
                    this.velocity.z *= NET_COLLISION_VELOCITY_Z_FACTOR;
                    this.spin.x *= NET_COLLISION_SPIN_X_FACTOR;
                    this.spin.y *= NET_COLLISION_SPIN_Y_FACTOR;

                    // Set the ball's position directly to the point of impact, plus a small epsilon
                    // to push it off the net plane and prevent an infinite collision loop.
                    const epsilon = Math.sign(this.velocity.z) * NET_COLLISION_Z_OFFSET;
                    this.mesh.position.set(collisionX, collisionY, epsilon);

                    // Collision handled, but we don't return, so floor collision can still be checked.
                }
            }
        }

        // Table collision
        const halfTableW = TABLE_WIDTH / 2;
        const halfTableL = TABLE_LENGTH / 2;
        if (this.mesh.position.y < TABLE_HEIGHT + BALL_RADIUS && this.velocity.y < 0 &&
            this.mesh.position.x > -halfTableW && this.mesh.position.x < halfTableW &&
            this.mesh.position.z > -halfTableL && this.mesh.position.z < halfTableL) {

            this.justHitBySide = 0; // Reset after first bounce

            this.mesh.position.y = TABLE_HEIGHT + BALL_RADIUS;
            this.velocity.y *= -TABLE_E;
            this.spin.x *= TABLE_COLLISION_SPIN_X_FACTOR;
            this.spin.y *= TABLE_COLLISION_SPIN_Y_FACTOR;
            // REMINDER: Player 1 (Human) is +Z, Player 2 (AI) is -Z
            if (this.mesh.position.z > 0) { // Bounce on Player 1 (Human) side
                switch(this.status) {
                    // Human serves, ball bounces on their own side first.
                    case BallStatus.SERVE_TO_AI:
                        this.status = BallStatus.IN_PLAY_TO_AI; // Now it's in play, heading to AI
                        break;
                    // AI has hit the ball, it bounces on the human's side.
                    case BallStatus.IN_PLAY_TO_HUMAN:
                        this.status = BallStatus.RALLY_TO_HUMAN; // Now it's a rally ball for the human to hit
                        break;
                    default:
                        this.ballDead(); // Any other bounce on this side is a fault
                        break;
                }
            } else { // Bounce on Player 2 (AI) side
                switch(this.status) {
                    // AI serves, ball bounces on their own side first.
                    case BallStatus.SERVE_TO_HUMAN:
                        this.status = BallStatus.IN_PLAY_TO_HUMAN; // Now it's in play, heading to Human
                        break;
                    // Human has hit the ball, it bounces on the AI's side.
                    case BallStatus.IN_PLAY_TO_AI:
                        this.status = BallStatus.RALLY_TO_AI; // Now it's a rally ball for the AI to hit
                        break;
                    default:
                        this.ballDead(); // Any other bounce on this side is a fault
                        break;
                }
            }
            return; // A table collision precludes a floor collision
        }

        // Floor collision
        if (this.mesh.position.y < BALL_RADIUS && this.velocity.y < 0) {
            this.mesh.position.y = BALL_RADIUS;
            this.velocity.y *= -TABLE_E;
            this.spin.x *= TABLE_COLLISION_SPIN_Y_FACTOR; // Using the same as table bounce for simplicity
            this.spin.y *= TABLE_COLLISION_SPIN_Y_FACTOR;
            this.ballDead();
        }
    }

    public hit(velocity: THREE.Vector3, spin: THREE.Vector2) {
        this.velocity.copy(velocity);
        this.spin.copy(spin);
        if (this.status === BallStatus.TOSS_P1) {
            this.status = BallStatus.SERVE_TO_AI;
        } else if (this.status === BallStatus.TOSS_P2) {
            this.status = BallStatus.SERVE_TO_HUMAN;
        } else if (this.status === BallStatus.RALLY_TO_AI) { // AI hits the ball
            this.status = BallStatus.IN_PLAY_TO_HUMAN;
        } else if (this.status === BallStatus.RALLY_TO_HUMAN) { // Human hits the ball
            this.status = BallStatus.IN_PLAY_TO_AI;
        }
    }

    private ballDead() { if (this.status >= 0) { this.status = BallStatus.DEAD; } }

    public toss(player: Player, power: number) {
        this.velocity.y = power;
        this.spin.set(0, 0);
        this.status = player.side > 0 ? BallStatus.TOSS_P1 : BallStatus.TOSS_P2;
    }

    public reset(player: Player) {
        const serveParams = stype.get(player.swingType);
        if (!serveParams) return;
        const playerPos = player.mesh.position;
        if (player.side > 0) {
            this.mesh.position.x = playerPos.x + serveParams.hitX;
            this.mesh.position.z = playerPos.z + serveParams.hitY;
        } else {
            this.mesh.position.x = playerPos.x - serveParams.hitX;
            this.mesh.position.z = playerPos.z + serveParams.hitY;
        }
        this.mesh.position.y = TABLE_HEIGHT + BALL_RESET_Y_OFFSET;
        this.velocity.set(0, 0, 0);
        this.spin.set(0, 0);
        this.status = BallStatus.WAITING_FOR_SERVE;
    }

    // =================================================================================
    // NEW METHODS PORTED FROM C++ for advanced serve calculation
    // =================================================================================

    /**
     * Calculates the time it takes for the ball to reach a target on the horizontal plane.
     * Ported from C++ Ball::getTimeToReachTarget.
     * @param target The relative 2D location of the target from the ball's current position (x, z).
     * @param velocity The initial scalar speed of the ball on the horizontal plane.
     * @param spin The ball's spin (x: side, y: top/back).
     * @param vOut An output vector that will be populated with the calculated initial 3D velocity vector (x, y, z).
     * @returns The time in seconds to reach the target. Returns a large number if unreachable.
     */
    private _getTimeToReachTarget(target: THREE.Vector2, velocity: number, spin: THREE.Vector2, vOut: THREE.Vector3): number {
        // In C++, the 2D vector represents (x, y) on the horizontal plane. In Three.js, this is (x, z).
        // So, target.y in this function corresponds to the z coordinate.
        const targetLen = target.length();

        if (Math.abs(spin.x) < TIME_PRECISION_THRESHOLD) { // No side spin
            if (targetLen > 0) {
                vOut.x = target.x / targetLen * velocity;
                vOut.z = target.y / targetLen * velocity;
            } else {
                vOut.x = 0;
                vOut.z = 0;
            }

            const expr = 1 - PHY * targetLen / velocity;
            if (expr <= 0) {
                return UNREACHABLE_TIME; // Unreachable
            }
            return -Math.log(expr) / PHY;
        } else { // With side spin
            const val = targetLen * spin.x / (2 * velocity);
            if (Math.abs(val) > 1) {
                return UNREACHABLE_TIME; // Unreachable, cannot compute asin
            }
            const theta = Math.asin(val);
            const cosTheta = Math.cos(-theta);
            const sinTheta = Math.sin(-theta);

            if (targetLen > 0) {
                const targetUnit = target.clone().normalize();
                vOut.x = (targetUnit.x * cosTheta - targetUnit.y * sinTheta) * velocity;
                vOut.z = (targetUnit.x * sinTheta + targetUnit.y * cosTheta) * velocity;
            } else {
                vOut.x = 0;
                vOut.z = 0;
            }

            const expr = 1 - 2 * PHY / spin.x * theta;
            if (expr <= 0) {
                return UNREACHABLE_TIME; // Unreachable
            }
            return -Math.log(expr) / PHY;
        }
    }

    /**
     * Calculates the initial vertical velocity (Vy) required to reach a target height in a given time.
     * Ported from C++ Ball::getVz0ToReachTarget.
     * @param targetHeight The relative target height from the ball's current height.
     * @param spin The ball's spin (y-component is for top/back spin).
     * @param t The time to reach the target height.
     * @returns The required initial vertical velocity (Vy).
     */
    private _getVz0ToReachTarget(targetHeight: number, spin: THREE.Vector2, t: number): number {
        if (t > TIME_PRECISION_THRESHOLD) {
            const g = GRAVITY(spin.y);
            const result = (PHY * targetHeight + g * t) / (1 - Math.exp(-PHY * t)) - g / PHY;
            return result;
        } else {
            return -targetHeight;
        }
    }

    /**
     * Calculates the time it takes for the ball to reach a specific Z coordinate (depth).
     * It also calculates the X coordinate at that time.
     * Ported from C++ Ball::getTimeToReachY.
     * @param targetZ The target Z coordinate (depth).
     * @param currentPos The ball's current 2D position (x, z).
     * @param spin The ball's spin.
     * @param v The ball's current 3D velocity.
     * @returns An object containing the time and the final targetX coordinate.
     */
    private _getTimeToReachY(targetZ: number, currentPos: THREE.Vector2, spin: THREE.Vector2, v: THREE.Vector3): { time: number; targetX: number } {
        const vHorizontal = new THREE.Vector2(v.x, v.z);

        if (Math.abs(spin.x) < TIME_PRECISION_THRESHOLD) { // No side spin
            let targetX = 0;
            if (Math.abs(v.z) > VELOCITY_PRECISION_THRESHOLD) {
                 targetX = currentPos.x + v.x / v.z * (targetZ - currentPos.y);
            } else {
                 targetX = currentPos.x;
            }
            const target = new THREE.Vector2(targetX, targetZ);
            const relativeTarget = target.sub(currentPos);
            const time = this._getTimeToReachTarget(relativeTarget, vHorizontal.length(), spin, new THREE.Vector3());
            return { time, targetX };
        } else { // With side spin
            const centerX = currentPos.x - v.z / spin.x;
            const centerZ = currentPos.y + v.x / spin.x;
            const center = new THREE.Vector2(centerX, centerZ);

            const radiusSq = vHorizontal.lengthSq() / (spin.x * spin.x);
            const dzSq = (targetZ - center.y) * (targetZ - center.y);

            if (radiusSq < dzSq) {
                return { time: UNREACHABLE_TIME, targetX: 0 };
            }

            const dx = Math.sqrt(radiusSq - dzSq);

            const target1 = new THREE.Vector2(center.x + dx, targetZ);
            const target2 = new THREE.Vector2(center.x - dx, targetZ);

            const vec_to_start = currentPos.clone().sub(center);
            const vec_to_target1 = target1.clone().sub(center);
            const vec_to_target2 = target2.clone().sub(center);

            const dot1 = vec_to_start.dot(vec_to_target1);
            const dot2 = vec_to_start.dot(vec_to_target2);

            const chosenTarget = (dot1 > dot2) ? target1 : target2;

            const time = this._getTimeToReachTarget(chosenTarget.clone().sub(currentPos), vHorizontal.length(), spin, new THREE.Vector3());
            return { time, targetX: chosenTarget.x };
        }
    }


    private _calculateServeFinalState(
        vHorizontal: number,
        boundPoint: THREE.Vector2,
        spin: THREE.Vector2,
        target: THREE.Vector2,
        initialBallPos: THREE.Vector3,
        initialBallPos2D: THREE.Vector2
    ): { finalHeight: number; finalX: number } {
        // This is a complex helper function extracted from the original targetToVS.
        // It simulates the entire serve trajectory for a given initial horizontal speed
        // and a bounce point, returning the final height and x position at the target Z.

        // Inner binary search for the bounce X position
        let xMin = -TABLE_WIDTH / 2;
        let xMax = TABLE_WIDTH / 2;
        for (let x_iter = 0; x_iter < SERVE_CALC_ITERATIONS; x_iter++) {
            if (xMax - xMin < SERVE_CALC_PRECISION) break;
            const boundX = (xMin + xMax) / 2;
            const currentBoundPoint = new THREE.Vector2(boundX, boundPoint.y);
            const initialVelocityGuess = new THREE.Vector3();
            const timeToBound = this._getTimeToReachTarget(currentBoundPoint.clone().sub(initialBallPos2D), vHorizontal, spin, initialVelocityGuess);
            if (timeToBound >= UNREACHABLE_TIME) {
                xMax = boundX;
                continue;
            }

            const spinAtBound = spin.clone().multiplyScalar(Math.exp(-PHY * timeToBound));
            const velAtBound = new THREE.Vector3();
            const rot = spin.x / PHY * (1 - Math.exp(-PHY * timeToBound));
            velAtBound.x = (initialVelocityGuess.x * Math.cos(rot) - initialVelocityGuess.z * Math.sin(rot)) * Math.exp(-PHY * timeToBound);
            velAtBound.z = (initialVelocityGuess.x * Math.sin(rot) + initialVelocityGuess.z * Math.cos(rot)) * Math.exp(-PHY * timeToBound);
            const spinAfterBounce = new THREE.Vector2(spinAtBound.x * TABLE_COLLISION_SPIN_X_FACTOR, spinAtBound.y * TABLE_COLLISION_SPIN_Y_FACTOR);
            const velAfterBounce = velAtBound.clone();
            const vCurrentXY = Math.hypot(velAfterBounce.x, velAfterBounce.z);
            if (vCurrentXY > 0) {
                velAfterBounce.x += velAfterBounce.x / vCurrentXY * spinAtBound.y * TABLE_COLLISION_SPIN_Y_FACTOR;
                velAfterBounce.z += velAfterBounce.z / vCurrentXY * spinAtBound.y * TABLE_COLLISION_SPIN_Y_FACTOR;
            }
            const { targetX } = this._getTimeToReachY(target.y, currentBoundPoint, spinAfterBounce, velAfterBounce);
            if (targetX < target.x) xMin = boundX;
            else xMax = boundX;
        }
        const finalBoundX = (xMin + xMax) / 2;
        const finalBoundPoint = new THREE.Vector2(finalBoundX, boundPoint.y);

        // Now calculate the final height
        const initialVelocity = new THREE.Vector3();
        const timeToBound = this._getTimeToReachTarget(finalBoundPoint.clone().sub(initialBallPos2D), vHorizontal, spin, initialVelocity);
        if (timeToBound >= UNREACHABLE_TIME) return { finalHeight: -1, finalX: -1 };

        initialVelocity.y = this._getVz0ToReachTarget(TABLE_HEIGHT - initialBallPos.y, spin, timeToBound);
        const velAtBoundY = (initialVelocity.y + GRAVITY(spin.y) / PHY) * Math.exp(-PHY * timeToBound) - GRAVITY(spin.y) / PHY;
        const velAfterBounceY = velAtBoundY * -TABLE_E;
        const spinAtBound = spin.clone().multiplyScalar(Math.exp(-PHY * timeToBound));
        const spinAfterBounce = new THREE.Vector2(spinAtBound.x * TABLE_COLLISION_SPIN_X_FACTOR, spinAtBound.y * TABLE_COLLISION_SPIN_Y_FACTOR);
        const velAtBound = new THREE.Vector3();
        const rot = spin.x / PHY * (1 - Math.exp(-PHY * timeToBound));
        velAtBound.x = (initialVelocity.x * Math.cos(rot) - initialVelocity.z * Math.sin(rot)) * Math.exp(-PHY * timeToBound);
        velAtBound.z = (initialVelocity.x * Math.sin(rot) + initialVelocity.z * Math.cos(rot)) * Math.exp(-PHY * timeToBound);
        const velAfterBounceXZ = velAtBound.clone();
        const vCurrentXY = Math.hypot(velAfterBounceXZ.x, velAfterBounceXZ.z);
        if (vCurrentXY > 0) {
            velAfterBounceXZ.x += velAfterBounceXZ.x / vCurrentXY * spinAtBound.y * TABLE_COLLISION_SPIN_Y_FACTOR;
            velAfterBounceXZ.z += velAfterBounceXZ.z / vCurrentXY * spinAtBound.y * TABLE_COLLISION_SPIN_Y_FACTOR;
        }
        const timeBounceToTarget = this._getTimeToReachY(target.y, finalBoundPoint, spinAfterBounce, velAfterBounceXZ).time;
        if (timeBounceToTarget >= UNREACHABLE_TIME) return { finalHeight: -1, finalX: -1 };

        const gAfterBounce = GRAVITY(spinAfterBounce.y);
        const exp_phy_t1 = Math.exp(-PHY * timeBounceToTarget);
        const finalHeight = (TABLE_HEIGHT) + (velAfterBounceY + gAfterBounce / PHY) / PHY * (1 - exp_phy_t1) - gAfterBounce / PHY * timeBounceToTarget;
        return { finalHeight, finalX: finalBoundX };
    }


    public targetToVS(player: Player, target: THREE.Vector2, level: number, spin: THREE.Vector2): THREE.Vector3 {
        const initialBallPos = this.mesh.position;
        const initialBallPos2D = new THREE.Vector2(initialBallPos.x, initialBallPos.z);
        let bestVelocity = INVALID_VELOCITY.clone();
        let bestHorizontalSpeedSq = -1;

        const halfTableL = TABLE_LENGTH / 2;
        for (let boundZ = -halfTableL; boundZ < halfTableL; boundZ += TICK) {
            if (boundZ * player.side <= 0) continue;

            // --- Binary search for vHorizontal ---
            let vMin = SERVE_CALC_V_MIN;
            let vMax = SERVE_CALC_V_MAX;
            let finalBoundX = 0;
            let finalHeight = 0;

            for(let v_iter = 0; v_iter < SERVE_CALC_ITERATIONS; v_iter++) {
                if (vMax - vMin < SERVE_CALC_PRECISION) break;
                const vHorizontal = (vMin + vMax) / 2;
                const result = this._calculateServeFinalState(vHorizontal, new THREE.Vector2(0, boundZ), spin, target, initialBallPos, initialBallPos2D);
                finalHeight = result.finalHeight;
                finalBoundX = result.finalX;
                if (finalHeight > TABLE_HEIGHT) vMax = vHorizontal;
                else vMin = vHorizontal;
            }
             // --- End Binary search ---

            if (Math.abs(finalHeight - TABLE_HEIGHT) > SERVE_CALC_HEIGHT_TOLERANCE) continue;

            const vHorizontal = (vMin + vMax) / 2;
            const boundPoint = new THREE.Vector2(finalBoundX, boundZ);
            const initialVelocity = new THREE.Vector3();
            const timeToBound = this._getTimeToReachTarget(boundPoint.clone().sub(initialBallPos2D), vHorizontal, spin, initialVelocity);
            if (timeToBound >= UNREACHABLE_TIME) continue;

            initialVelocity.y = this._getVz0ToReachTarget(TABLE_HEIGHT - initialBallPos.y, spin, timeToBound);

            const spinAtBound = spin.clone().multiplyScalar(Math.exp(-PHY * timeToBound));
            const spinAfterBounce = new THREE.Vector2(spinAtBound.x * TABLE_COLLISION_SPIN_X_FACTOR, spinAtBound.y * TABLE_COLLISION_SPIN_Y_FACTOR);
            const velAtBound = new THREE.Vector3();
            const rot = spin.x / PHY * (1 - Math.exp(-PHY * timeToBound));
            velAtBound.x = (initialVelocity.x * Math.cos(rot) - initialVelocity.z * Math.sin(rot)) * Math.exp(-PHY * timeToBound);
            velAtBound.z = (initialVelocity.x * Math.sin(rot) + initialVelocity.z * Math.cos(rot)) * Math.exp(-PHY * timeToBound);
            const velAfterBounceXZ = velAtBound.clone();
            const vCurrentXY_ = Math.hypot(velAfterBounceXZ.x, velAfterBounceXZ.z);
            if (vCurrentXY_ > 0) {
                velAfterBounceXZ.x += velAfterBounceXZ.x / vCurrentXY_ * spinAtBound.y * TABLE_COLLISION_SPIN_Y_FACTOR;
                velAfterBounceXZ.z += velAfterBounceXZ.z / vCurrentXY_ * spinAtBound.y * TABLE_COLLISION_SPIN_Y_FACTOR;
            }
            const timeToNet = this._getTimeToReachY(0, boundPoint, spinAfterBounce, velAfterBounceXZ).time;

            if (timeToNet < UNREACHABLE_TIME) {
                const velAtBoundY = (initialVelocity.y + GRAVITY(spin.y) / PHY) * Math.exp(-PHY * timeToBound) - GRAVITY(spin.y) / PHY;
                const velAfterBounceY = velAtBoundY * -TABLE_E;
                const gAfterBounce = GRAVITY(spinAfterBounce.y);
                const exp_phy_t_net = Math.exp(-PHY * timeToNet);
                const heightAtNet = (TABLE_HEIGHT) +
                    (velAfterBounceY + gAfterBounce / PHY) / PHY * (1 - exp_phy_t_net) - gAfterBounce / PHY * timeToNet;
                const requiredHeight = (TABLE_HEIGHT + NET_HEIGHT) + (1.0 - level) * SERVE_CALC_NET_CLEARANCE_BASE;

                if (heightAtNet > requiredHeight) {
                    const horizontalSpeedSq = initialVelocity.x * initialVelocity.x + initialVelocity.z * initialVelocity.z;
                    if (horizontalSpeedSq > bestHorizontalSpeedSq) {
                        bestHorizontalSpeedSq = horizontalSpeedSq;
                        bestVelocity.copy(initialVelocity);
                    }
                }
            }
        }

        if (bestHorizontalSpeedSq > 0) {
            return bestVelocity;
        }

        console.warn("targetToVS: Could not find a valid serve velocity. Using fallback.");
        const fallbackVelocity = FALLBACK_SERVE_VELOCITY.clone();
        fallbackVelocity.z *= player.side;
        return fallbackVelocity;
    }

    private _calculateSimpleFallbackVelocity(relativeTarget: THREE.Vector2, distance: number): THREE.Vector3 {
        console.warn("calculateRallyHitVelocity: Could not find a valid trajectory. Using simple fallback.");
        const direction = new THREE.Vector3(relativeTarget.x, 0, relativeTarget.y).normalize();
        const fallbackSpeed = FALLBACK_VELOCITY_BASE_SPEED + distance * FALLBACK_VELOCITY_DISTANCE_FACTOR;
        const fallbackVelocity = direction.multiplyScalar(fallbackSpeed);
        fallbackVelocity.y = FALLBACK_VELOCITY_Y_BASE + distance * FALLBACK_VELOCITY_Y_DISTANCE_FACTOR;
        return fallbackVelocity;
    }

    public calculateRallyHitVelocity(target: THREE.Vector2, spin: THREE.Vector2, power: ShotPower = ShotPower.Medium): THREE.Vector3 {
        const initialBallPos = this.mesh.position.clone();
        const initialBallPos2D = new THREE.Vector2(initialBallPos.x, initialBallPos.z);
        const relativeTarget = target.clone().sub(initialBallPos2D);
        const distance = relativeTarget.length();

        // STEP 1: Find the baseline velocity. This is defined as the fastest possible
        // shot that successfully clears the net and lands on the target.
        const findBaselineVelocity = (): THREE.Vector3 | null => {
            const requiredNetClearance = TABLE_HEIGHT + NET_HEIGHT + NET_CLEARANCE_MARGIN;
            let low = RALLY_HIT_MIN_SPEED;
            let high = RALLY_HIT_MAX_SPEED;
            let bestSolution: THREE.Vector3 | null = null;

            for (let i = 0; i < RALLY_CALC_ITERATIONS; i++) {
                if (high - low < RALLY_CALC_PRECISION) break;
                const midSpeed = (low + high) / 2;

                const initialVelocityGuess = new THREE.Vector3();
                const timeToTarget = this._getTimeToReachTarget(relativeTarget, midSpeed, spin, initialVelocityGuess);

                if (timeToTarget >= UNREACHABLE_TIME) {
                    low = midSpeed; // Too slow, unreachable
                    continue;
                }

                const targetHeight = TABLE_HEIGHT - initialBallPos.y;
                const requiredVy = this._getVz0ToReachTarget(targetHeight, spin, timeToTarget);
                const v0 = new THREE.Vector3(initialVelocityGuess.x, requiredVy, initialVelocityGuess.z);
                const { time: timeToNet } = this._getTimeToReachY(0, initialBallPos2D, spin, v0);

                if (timeToNet < timeToTarget) {
                    const g = GRAVITY(spin.y);
                    const heightAtNet = initialBallPos.y + (v0.y + g / PHY) / PHY * (1 - Math.exp(-PHY * timeToNet)) - g / PHY * timeToNet;
                    if (heightAtNet > requiredNetClearance) {
                        bestSolution = v0; // This speed is valid, try for a faster one
                        low = midSpeed;
                    } else {
                        high = midSpeed; // Hit the net, too fast
                    }
                } else {
                     low = midSpeed; // Doesn't cross net before target, also considered too slow.
                }
            }
            return bestSolution;
        };

        const baselineVelocity = findBaselineVelocity();

        if (!baselineVelocity) {
            return this._calculateSimpleFallbackVelocity(relativeTarget, distance);
        }

        // STEP 2: Determine the power multiplier. Stronger shots have a higher multiplier,
        // keeping their speed closer to the aggressive baseline.
        let powerMultiplier: number;
        switch (power) {
            case ShotPower.Strong:
                powerMultiplier = 0.95;
                break;
            case ShotPower.Medium:
                powerMultiplier = 0.9;
                break;
            case ShotPower.Weak:
            default:
                powerMultiplier = 0.8;
                break;
        }

        // STEP 3: Scale the horizontal speed of the baseline velocity.
        const baselineHorizontalSpeed = new THREE.Vector2(baselineVelocity.x, baselineVelocity.z).length();
        const newHorizontalSpeed = baselineHorizontalSpeed * powerMultiplier;

        // STEP 4: Recalculate the time-to-target and the required vertical velocity (vy)
        // based on this new, slower horizontal speed.
        const newVelocityGuess = new THREE.Vector3();
        const newTimeToTarget = this._getTimeToReachTarget(relativeTarget, newHorizontalSpeed, spin, newVelocityGuess);
        if (newTimeToTarget >= UNREACHABLE_TIME) {
            // This shouldn't happen if the baseline was valid, but as a safeguard.
            return baselineVelocity;
        }

        const targetHeight = TABLE_HEIGHT - initialBallPos.y;
        const newVy = this._getVz0ToReachTarget(targetHeight, spin, newTimeToTarget);

        // STEP 5: Assemble the final velocity vector.
        return new THREE.Vector3(newVelocityGuess.x, newVy, newVelocityGuess.z);
    }
}
