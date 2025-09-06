import * as THREE from 'three';
import type { Player } from './Player';
import { stype, TABLE_HEIGHT, PHY, GRAVITY, TICK, TABLE_E, TABLE_WIDTH, TABLE_LENGTH, NET_HEIGHT } from './constants';
import type { Game } from './Game';

const BALL_RADIUS = 0.02;

export class Ball {
    public mesh: THREE.Mesh;
    public velocity = new THREE.Vector3();
    public spin = new THREE.Vector2();
    public status = 8;
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
        if (this.status === 8) { return; }

        // Handle the reset timer for a dead ball
        if (this.status < 0) {
            this.status--;
            if (this.status < -100) {
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

        if (Math.abs(oldSpin.x) < 0.001) {
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

                // Log the actual crossing event regardless of collision
                console.log(`[Actual] Ball crossed net plane at height: ${collisionY.toFixed(3)}. Position: { x: ${collisionX.toFixed(2)}, y: ${collisionY.toFixed(2)}, z: 0.00 }`);

                if (collisionX > -TABLE_WIDTH / 2 && collisionX < TABLE_WIDTH / 2 &&
                    collisionY > 0 && collisionY < TABLE_HEIGHT + NET_HEIGHT) {

                    // Apply physics
                    this.velocity.x *= 0.5;
                    this.velocity.z *= -0.2;
                    this.spin.x *= -0.8;
                    this.spin.y *= -0.8;

                    // Set the ball's position directly to the point of impact, plus a small epsilon
                    // to push it off the net plane and prevent an infinite collision loop.
                    const epsilon = Math.sign(this.velocity.z) * 0.001;
                    this.mesh.position.set(collisionX, collisionY, epsilon);

                    // Collision handled
                    return;
                }
            }
        }

        // Table collision
        const halfTableW = TABLE_WIDTH / 2;
        const halfTableL = TABLE_LENGTH / 2;
        if (this.mesh.position.y < TABLE_HEIGHT + BALL_RADIUS && this.velocity.y < 0 &&
            this.mesh.position.x > -halfTableW && this.mesh.position.x < halfTableW &&
            this.mesh.position.z > -halfTableL && this.mesh.position.z < halfTableL) {
            console.log("TABLE COLLISION CONDITION MET");
            console.log(`Bounce at: { x: ${this.mesh.position.x.toFixed(3)}, y: ${this.mesh.position.y.toFixed(3)}, z: ${this.mesh.position.z.toFixed(3)} }`);
            this.mesh.position.y = TABLE_HEIGHT + BALL_RADIUS;
            this.velocity.y *= -TABLE_E;
            this.spin.x *= 0.95;
            this.spin.y *= 0.8;
            if (this.mesh.position.z > 0) {
                switch(this.status) {
                    case 2: this.status = 3; break;
                    case 4: this.status = 0; break;
                    default: this.ballDead(); break;
                }
            } else {
                switch(this.status) {
                    case 0: this.status = 1; break;
                    case 5: this.status = 2; break;
                    default: this.ballDead(); break;
                }
            }
            return; // A table collision precludes a floor collision
        }

        // Floor collision
        if (this.mesh.position.y < BALL_RADIUS && this.velocity.y < 0) {
            this.mesh.position.y = BALL_RADIUS;
            this.velocity.y *= -TABLE_E;
            this.spin.x *= 0.8;
            this.spin.y *= 0.8;
            this.ballDead();
        }
    }

    public hit(velocity: THREE.Vector3, spin: THREE.Vector2) {
        this.velocity.copy(velocity);
        this.spin.copy(spin);
        if (this.status === 6) { this.status = 4; }
        else if (this.status === 7) { this.status = 5; }
        else if (this.status === 3) { this.status = 0; }
        else if (this.status === 1) { this.status = 2; }
    }

    private ballDead() { if (this.status >= 0) { this.status = -1; } }

    public toss(player: Player, power: number) {
        this.velocity.y = power;
        this.spin.set(0, 0);
        this.status = player.side > 0 ? 6 : 7;
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
        this.mesh.position.y = TABLE_HEIGHT + 0.15;
        this.velocity.set(0, 0, 0);
        this.spin.set(0, 0);
        this.status = 8;
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

        if (Math.abs(spin.x) < 0.001) { // No side spin
            if (targetLen > 0) {
                vOut.x = target.x / targetLen * velocity;
                vOut.z = target.y / targetLen * velocity;
            } else {
                vOut.x = 0;
                vOut.z = 0;
            }

            const expr = 1 - PHY * targetLen / velocity;
            if (expr <= 0) {
                return 100000; // Unreachable
            }
            return -Math.log(expr) / PHY;
        } else { // With side spin
            const val = targetLen * spin.x / (2 * velocity);
            if (Math.abs(val) > 1) {
                return 100000; // Unreachable, cannot compute asin
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
                return 100000; // Unreachable
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
        if (t > 0.001) {
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

        if (Math.abs(spin.x) < 0.001) { // No side spin
            let targetX = 0;
            if (Math.abs(v.z) > 1e-6) {
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
                return { time: 100000, targetX: 0 };
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


    public targetToVS(player: Player, target: THREE.Vector2, level: number, spin: THREE.Vector2): THREE.Vector3 {
        // This is a port of the complex serve calculation from the original C++ code (Ball::TargetToVS).
        // It iteratively searches for an initial velocity that makes the ball land at the target.
        const initialBallPos = this.mesh.position;
        const initialBallPos2D = new THREE.Vector2(initialBallPos.x, initialBallPos.z);

        let bestVelocity = new THREE.Vector3();
        let bestHorizontalSpeedSq = -1;

        // The loop for the Z-coordinate of the first bounce.
        // It iterates over the entire half of the table, with a step of TICK, to find the optimal bounce point.
        // This logic is ported from the original C++ implementation.
        const halfTableL = TABLE_LENGTH / 2;
        for (let boundZ = -halfTableL; boundZ < halfTableL; boundZ += TICK) {
            // This condition ensures we only check for bounces on the server's side of the table.
            if (boundZ * player.side <= 0) {
                continue;
            }

            let vMin = 0.1;
            let vMax = 30.0;
            let finalHeight = 0;
            let finalBoundX = 0;

            for(let v_iter = 0; v_iter < 20; v_iter++) {
                if (vMax - vMin < 0.001) {
                    break;
                };
                const vHorizontal = (vMin + vMax) / 2;

                let xMin = -TABLE_WIDTH / 2;
                let xMax = TABLE_WIDTH / 2;
                let boundX = 0;

                for (let x_iter = 0; x_iter < 20; x_iter++) {
                    if (xMax - xMin < 0.001) {
                        break;
                    }
                    boundX = (xMin + xMax) / 2;
                    const boundPoint = new THREE.Vector2(boundX, boundZ);

                    const initialVelocityGuess = new THREE.Vector3();
                    const timeToBound = this._getTimeToReachTarget(boundPoint.clone().sub(initialBallPos2D), vHorizontal, spin, initialVelocityGuess);

                    if (timeToBound > 99999) {
                        // This path is impossible, short-circuit
                        xMax = boundX; // Assume we need to aim more to the center
                        continue;
                    }

                    const spinAtBound = spin.clone().multiplyScalar(Math.exp(-PHY * timeToBound));
                    const velAtBound = new THREE.Vector3();
                    const rot = spin.x / PHY * (1 - Math.exp(-PHY * timeToBound));
                    velAtBound.x = (initialVelocityGuess.x * Math.cos(rot) - initialVelocityGuess.z * Math.sin(rot)) * Math.exp(-PHY * timeToBound);
                    velAtBound.z = (initialVelocityGuess.x * Math.sin(rot) + initialVelocityGuess.z * Math.cos(rot)) * Math.exp(-PHY * timeToBound);
                    const spinAfterBounce = new THREE.Vector2(spinAtBound.x * 0.95, spinAtBound.y * 0.8);
                    const velAfterBounce = velAtBound.clone();
                    const vCurrentXY = Math.hypot(velAfterBounce.x, velAfterBounce.z);
                    if (vCurrentXY > 0) {
                        velAfterBounce.x += velAfterBounce.x / vCurrentXY * spinAtBound.y * 0.8;
                        velAfterBounce.z += velAfterBounce.z / vCurrentXY * spinAtBound.y * 0.8;
                    }

                    const result = this._getTimeToReachY(target.y, boundPoint, spinAfterBounce, velAfterBounce);
                    const finalTargetX = result.targetX;

                    if (finalTargetX < target.x) {
                        xMin = boundX;
                    } else {
                        xMax = boundX;
                    }
                }
                finalBoundX = (xMin + xMax) / 2;

                const boundPoint = new THREE.Vector2(finalBoundX, boundZ);
                const initialVelocity = new THREE.Vector3();
                const timeToBound = this._getTimeToReachTarget(boundPoint.clone().sub(initialBallPos2D), vHorizontal, spin, initialVelocity);
                initialVelocity.y = this._getVz0ToReachTarget(TABLE_HEIGHT - initialBallPos.y, spin, timeToBound);
                const velAtBoundY = (initialVelocity.y + GRAVITY(spin.y) / PHY) * Math.exp(-PHY * timeToBound) - GRAVITY(spin.y) / PHY;
                const velAfterBounceY = velAtBoundY * -TABLE_E;
                const spinAtBound = spin.clone().multiplyScalar(Math.exp(-PHY * timeToBound));
                const spinAfterBounce = new THREE.Vector2(spinAtBound.x * 0.95, spinAtBound.y * 0.8);
                const velAtBound = new THREE.Vector3();
                const rot = spin.x / PHY * (1 - Math.exp(-PHY * timeToBound));
                velAtBound.x = (initialVelocity.x * Math.cos(rot) - initialVelocity.z * Math.sin(rot)) * Math.exp(-PHY * timeToBound);
                velAtBound.z = (initialVelocity.x * Math.sin(rot) + initialVelocity.z * Math.cos(rot)) * Math.exp(-PHY * timeToBound);
                const velAfterBounceXZ = velAtBound.clone();
                 const vCurrentXY = Math.hypot(velAfterBounceXZ.x, velAfterBounceXZ.z);
                 if (vCurrentXY > 0) {
                    velAfterBounceXZ.x += velAfterBounceXZ.x / vCurrentXY * spinAtBound.y * 0.8;
                    velAfterBounceXZ.z += velAfterBounceXZ.z / vCurrentXY * spinAtBound.y * 0.8;
                 }
                const timeBounceToTarget = this._getTimeToReachY(target.y, boundPoint, spinAfterBounce, velAfterBounceXZ).time;
                const gAfterBounce = GRAVITY(spinAfterBounce.y);
                const exp_phy_t1 = Math.exp(-PHY * timeBounceToTarget);
                finalHeight = (TABLE_HEIGHT) +
                    (velAfterBounceY + gAfterBounce / PHY) / PHY * (1 - exp_phy_t1) - gAfterBounce / PHY * timeBounceToTarget;

                if (finalHeight > TABLE_HEIGHT) {
                    vMax = vHorizontal;
                } else {
                    vMin = vHorizontal;
                }
            }

            if (Math.abs(finalHeight - TABLE_HEIGHT) > 0.05) {
                continue;
            }

            const boundPoint = new THREE.Vector2(finalBoundX, boundZ);
            const initialVelocity = new THREE.Vector3();
            const vHorizontal = (vMin + vMax) / 2;
            const timeToBound = this._getTimeToReachTarget(boundPoint.clone().sub(initialBallPos2D), vHorizontal, spin, initialVelocity);
            initialVelocity.y = this._getVz0ToReachTarget(TABLE_HEIGHT - initialBallPos.y, spin, timeToBound);

            const spinAtBound = spin.clone().multiplyScalar(Math.exp(-PHY * timeToBound));
            const spinAfterBounce = new THREE.Vector2(spinAtBound.x * 0.95, spinAtBound.y * 0.8);
            const velAtBound = new THREE.Vector3();
            const rot = spin.x / PHY * (1 - Math.exp(-PHY * timeToBound));
            velAtBound.x = (initialVelocity.x * Math.cos(rot) - initialVelocity.z * Math.sin(rot)) * Math.exp(-PHY * timeToBound);
            velAtBound.z = (initialVelocity.x * Math.sin(rot) + initialVelocity.z * Math.cos(rot)) * Math.exp(-PHY * timeToBound);
            const velAfterBounceXZ = velAtBound.clone();
            const vCurrentXY_ = Math.hypot(velAfterBounceXZ.x, velAfterBounceXZ.z);
            if (vCurrentXY_ > 0) {
                velAfterBounceXZ.x += velAfterBounceXZ.x / vCurrentXY_ * spinAtBound.y * 0.8;
                velAfterBounceXZ.z += velAfterBounceXZ.z / vCurrentXY_ * spinAtBound.y * 0.8;
            }
            const timeToNet = this._getTimeToReachY(0, boundPoint, spinAfterBounce, velAfterBounceXZ).time;

            if (timeToNet < 1000) {
                const velAtBoundY = (initialVelocity.y + GRAVITY(spin.y) / PHY) * Math.exp(-PHY * timeToBound) - GRAVITY(spin.y) / PHY;
                const velAfterBounceY = velAtBoundY * -TABLE_E;
                const gAfterBounce = GRAVITY(spinAfterBounce.y);
                const exp_phy_t_net = Math.exp(-PHY * timeToNet);
                const heightAtNet = (TABLE_HEIGHT) +
                    (velAfterBounceY + gAfterBounce / PHY) / PHY * (1 - exp_phy_t_net) - gAfterBounce / PHY * timeToNet;
                const requiredHeight = (TABLE_HEIGHT + NET_HEIGHT) + (1.0 - level) * 0.1;

                if (heightAtNet > requiredHeight) {
                    console.log(`[Prediction] Found valid trajectory. Predicted height at net: ${heightAtNet.toFixed(3)}. Initial velocity: { x: ${initialVelocity.x.toFixed(2)}, y: ${initialVelocity.y.toFixed(2)}, z: ${initialVelocity.z.toFixed(2)} }`);
                    const horizontalSpeedSq = initialVelocity.x * initialVelocity.x + initialVelocity.z * initialVelocity.z;
                    if (horizontalSpeedSq > bestHorizontalSpeedSq) {
                        bestHorizontalSpeedSq = horizontalSpeedSq;
                        bestVelocity.copy(initialVelocity);
                    }
                }
            }
        }

        if (bestHorizontalSpeedSq > 0) {
            // We found a solution. Return it.
            console.log(`targetToVS: Target: {x: ${target.x.toFixed(2)}, z: ${target.y.toFixed(2)}}, Calculated Vel: {x: ${bestVelocity.x.toFixed(2)}, y: ${bestVelocity.y.toFixed(2)}, z: ${bestVelocity.z.toFixed(2)}}`);
            return bestVelocity;
        } else {
            // FALLBACK IMPLEMENTATION if no solution was found
            console.warn("targetToVS: Could not find a valid serve velocity. Using fallback.");
            const fallbackVelocity = new THREE.Vector3(0, 2.8, player.side * -4.5);
            return fallbackVelocity;
        }
    }
}
