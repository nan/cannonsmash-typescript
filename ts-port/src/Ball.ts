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

    constructor() {
        const geometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        this.mesh = new THREE.Mesh(geometry, material);
    }

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
        const oldVel = this.velocity.clone();
        const oldSpin = this.spin.clone();
        const time = TICK;
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

        this.checkCollision();
    }

    private checkCollision() {
        // Table collision
        const halfTableW = TABLE_WIDTH / 2;
        const halfTableL = TABLE_LENGTH / 2;
        if (this.mesh.position.y < TABLE_HEIGHT + BALL_RADIUS && this.velocity.y < 0 &&
            this.mesh.position.x > -halfTableW && this.mesh.position.x < halfTableW &&
            this.mesh.position.z > -halfTableL && this.mesh.position.z < halfTableL) {
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

    public targetToVS(player: Player, target: THREE.Vector2, level: number, spin: THREE.Vector2): THREE.Vector3 {
        const ballPos = this.mesh.position;
        const ballPosXZ = new THREE.Vector2(ballPos.x, ballPos.z);
        let bestVelocity = new THREE.Vector3();
        let best_v_h = 0;

        const side = player.side; // > 0 for P1 (z<0), < 0 for P2 (z>0)
        const boundZStart = side * 0.1;
        const boundZEnd = side * (TABLE_LENGTH / 2 - 0.1);

        for (let boundZ = boundZStart; side > 0 ? boundZ < boundZEnd : boundZ > boundZEnd; boundZ += 0.2) {
            let v_h_Min = 0.1, v_h_Max = 30.0;
            let landingHeight = -1;

            for (let v_iter = 0; v_iter < 10; v_iter++) {
                const v_h = (v_h_Min + v_h_Max) / 2;
                if (v_h === v_h_Min || v_h === v_h_Max) break;

                let xMin = -TABLE_WIDTH / 2, xMax = TABLE_WIDTH / 2;
                let boundX = 0;

                for (let x_iter = 0; x_iter < 10; x_iter++) {
                    boundX = (xMin + xMax) / 2;
                    const bound = new THREE.Vector2(boundX, boundZ);

                    const vToBounce1 = new THREE.Vector3();
                    const t1 = this.getTimeToReachTarget(bound.clone().sub(ballPosXZ), v_h, spin, vToBounce1);
                    if (t1 > 9999) { xMin = boundX; continue; }

                    const vy_initial = this.getVy0ToReachTarget(TABLE_HEIGHT - ballPos.y, spin, t1);

                    const exp_phy_t1 = Math.exp(-PHY * t1);
                    const vy_before_bounce = (vy_initial + GRAVITY(spin.y) / PHY) * exp_phy_t1 - GRAVITY(spin.y) / PHY;
                    const spin_before_bounce = new THREE.Vector2(spin.x * exp_phy_t1, spin.y);

                    const v_after_bounce = new THREE.Vector3(vToBounce1.x, -vy_before_bounce * TABLE_E, vToBounce1.z);
                    const spin_after_bounce = new THREE.Vector2(spin_before_bounce.x * 0.95, spin_before_bounce.y * 0.8);

                    const v_h_len_after = Math.hypot(v_after_bounce.x, v_after_bounce.z);
                    if (v_h_len_after > 1e-6) {
                        const factor = spin_after_bounce.y * 0.8; // C++ code uses a constant factor. Let's use 0.8
                        v_after_bounce.x += v_after_bounce.x / v_h_len_after * factor;
                        v_after_bounce.z += v_after_bounce.z / v_h_len_after * factor;
                    }

                    const res = this.getTimeToReachZ(target.y, bound, v_after_bounce, spin_after_bounce);
                    if (res.x < target.x) xMin = boundX; else xMax = boundX;
                }

                const bound = new THREE.Vector2(boundX, boundZ);
                const vToBounce1 = new THREE.Vector3();
                const t1 = this.getTimeToReachTarget(bound.clone().sub(ballPosXZ), v_h, spin, vToBounce1);
                if (t1 > 9999) { v_h_Min = v_h; continue; }
                const vy_initial = this.getVy0ToReachTarget(TABLE_HEIGHT - ballPos.y, spin, t1);
                const exp_phy_t1 = Math.exp(-PHY * t1);
                const vy_before_bounce = (vy_initial + GRAVITY(spin.y) / PHY) * exp_phy_t1 - GRAVITY(spin.y) / PHY;
                const spin_before_bounce = new THREE.Vector2(spin.x * exp_phy_t1, spin.y);
                const v_after_bounce = new THREE.Vector3(vToBounce1.x, -vy_before_bounce * TABLE_E, vToBounce1.z);
                const spin_after_bounce = new THREE.Vector2(spin_before_bounce.x * 0.95, spin_before_bounce.y * 0.8);
                const v_h_len_after = Math.hypot(v_after_bounce.x, v_after_bounce.z);
                if (v_h_len_after > 1e-6) {
                    const factor = spin_after_bounce.y * 0.8;
                    v_after_bounce.x += v_after_bounce.x / v_h_len_after * factor;
                    v_after_bounce.z += v_after_bounce.z / v_h_len_after * factor;
                }
                const res = this.getTimeToReachZ(target.y, bound, v_after_bounce, spin_after_bounce);
                landingHeight = this.calculateHeightAtTime(v_after_bounce.y, spin_after_bounce.y, res.time);

                if (landingHeight > 0) v_h_Max = v_h; else v_h_Min = v_h;
            }

            if (Math.abs(landingHeight) > 0.01) continue;

            const v_h = v_h_Min * level;
            const bound = new THREE.Vector2(0, boundZ); // We need to re-calculate boundX for the final v_h
            let xMin = -TABLE_WIDTH / 2, xMax = TABLE_WIDTH / 2;
            for (let i=0; i<10; ++i) {
                bound.x = (xMin+xMax)/2;
                // Simplified simulation, same as above...
                 const vToBounce1 = new THREE.Vector3();
                const t1 = this.getTimeToReachTarget(bound.clone().sub(ballPosXZ), v_h, spin, vToBounce1);
                 if (t1 > 9999) { xMin = bound.x; continue; }
                 const vy_initial = this.getVy0ToReachTarget(TABLE_HEIGHT - ballPos.y, spin, t1);
                 const exp_phy_t1 = Math.exp(-PHY * t1);
                 const vy_before_bounce = (vy_initial + GRAVITY(spin.y) / PHY) * exp_phy_t1 - GRAVITY(spin.y) / PHY;
                 const spin_before_bounce = new THREE.Vector2(spin.x * exp_phy_t1, spin.y);
                 const v_after_bounce = new THREE.Vector3(vToBounce1.x, -vy_before_bounce * TABLE_E, vToBounce1.z);
                 const spin_after_bounce = new THREE.Vector2(spin_before_bounce.x * 0.95, spin_before_bounce.y * 0.8);
                 const v_h_len_after = Math.hypot(v_after_bounce.x, v_after_bounce.z);
                if (v_h_len_after > 1e-6) {
                    const factor = spin_after_bounce.y * 0.8;
                    v_after_bounce.x += v_after_bounce.x / v_h_len_after * factor;
                    v_after_bounce.z += v_after_bounce.z / v_h_len_after * factor;
                }
                 const res = this.getTimeToReachZ(target.y, bound, v_after_bounce, spin_after_bounce);
                 if (res.x < target.x) xMin = bound.x; else xMax = bound.x;
            }


            const vToBounce1 = new THREE.Vector3();
            const t1 = this.getTimeToReachTarget(bound.clone().sub(ballPosXZ), v_h, spin, vToBounce1);
            const vy_initial = this.getVy0ToReachTarget(TABLE_HEIGHT - ballPos.y, spin, t1);

            const exp_phy_t1 = Math.exp(-PHY * t1);
            const vy_before_bounce = (vy_initial + GRAVITY(spin.y) / PHY) * exp_phy_t1 - GRAVITY(spin.y) / PHY;
            const spin_before_bounce = new THREE.Vector2(spin.x * exp_phy_t1, spin.y);
            const v_after_bounce = new THREE.Vector3(vToBounce1.x, -vy_before_bounce * TABLE_E, vToBounce1.z);
            const spin_after_bounce = new THREE.Vector2(spin_before_bounce.x * 0.95, spin_before_bounce.y * 0.8);
            const v_h_len_after = Math.hypot(v_after_bounce.x, v_after_bounce.z);
            if (v_h_len_after > 1e-6) {
                const factor = spin_after_bounce.y * 0.8;
                v_after_bounce.x += v_after_bounce.x / v_h_len_after * factor;
                v_after_bounce.z += v_after_bounce.z / v_h_len_after * factor;
            }
            const resNet = this.getTimeToReachZ(0, bound, v_after_bounce, spin_after_bounce);
            const heightAtNet = this.calculateHeightAtTime(v_after_bounce.y, spin_after_bounce.y, resNet.time);

            if (heightAtNet > NET_HEIGHT && v_h > best_v_h) {
                best_v_h = v_h;
                this.getTimeToReachTarget(bound.clone().sub(ballPosXZ), v_h, spin, bestVelocity);
                bestVelocity.y = this.getVy0ToReachTarget(TABLE_HEIGHT - ballPos.y, spin, t1);
            }
        }

        if (best_v_h > 0) {
            return bestVelocity;
        }

        // Fallback for failed calculation
        console.error("Serve calculation failed, using fallback.");
        const fallback = new THREE.Vector3(0, 2.8, -4.5);
        fallback.multiplyScalar(level);
        return fallback;
    }

    /**
     * Calculates the time to reach a specific Z coordinate and the resulting X coordinate.
     * Ported from C++ `getTimeToReachY`.
     * @param targetZ The target z-coordinate.
     * @param posXZ The starting position on the XZ plane.
     * @param vel The current velocity.
     * @param spin The current spin.
     * @returns An object with the time and the final x-coordinate.
     */
    private getTimeToReachZ(targetZ: number, posXZ: THREE.Vector2, vel: THREE.Vector3, spin: THREE.Vector2): { time: number; x: number } {
        const velXZ = new THREE.Vector2(vel.x, vel.z);
        // posXZ.y is the z-component of the position
        const startZ = posXZ.y;

        if (Math.abs(spin.x) < 1e-6) {
            // No side spin, straight path
            if (Math.abs(vel.z) < 1e-6) return { time: 100000, x: posXZ.x };

            const targetPos = new THREE.Vector2(
                posXZ.x + vel.x / vel.z * (targetZ - startZ),
                targetZ
            );
            const tempV = new THREE.Vector3();
            const time = this.getTimeToReachTarget(targetPos.clone().sub(posXZ), velXZ.length(), spin, tempV);
            return { time: time, x: targetPos.x };
        } else {
            // With side spin, path is a circular arc
            const center = new THREE.Vector2(
                posXZ.x - vel.z / spin.x,
                startZ + vel.x / spin.x
            );

            const radiusSq = velXZ.lengthSq() / (spin.x * spin.x);
            const dz = targetZ - center.y;

            if (radiusSq < dz * dz) {
                return { time: 100000, x: posXZ.x }; // Does not intersect
            }

            const dx = Math.sqrt(radiusSq - dz * dz);
            const p1 = new THREE.Vector2(center.x + dx, targetZ);
            const p2 = new THREE.Vector2(center.x - dx, targetZ);

            // Choose the intersection point that is "ahead"
            const vecToCurrent = posXZ.clone().sub(center);
            const vecToP1 = p1.clone().sub(center);
            const vecToP2 = p2.clone().sub(center);
            const dot1 = vecToCurrent.dot(vecToP1);
            const dot2 = vecToCurrent.dot(vecToP2);

            const finalTarget = dot1 > dot2 ? p1 : p2;
            const tempV = new THREE.Vector3();
            const time = this.getTimeToReachTarget(finalTarget.clone().sub(posXZ), velXZ.length(), spin, tempV);
            return { time: time, x: finalTarget.x };
        }
    }

    /**
     * Calculates the change in height of the ball over a given time.
     * @param initialVy The initial vertical velocity.
     * @param spinY The top/back spin.
     * @param t The time in seconds.
     * @returns The change in height (delta y).
     */
    private calculateHeightAtTime(initialVy: number, spinY: number, t: number): number {
        const gravityEffect = GRAVITY(spinY);
        // This formula calculates the change in height (delta y) from the initial position.
        return (PHY * initialVy + gravityEffect) / (PHY * PHY) * (1 - Math.exp(-PHY * t)) - gravityEffect / PHY * t;
    }

    /**
     * Calculates the time it takes for the ball to reach a target on the horizontal plane.
     * Ported from the original C++ code (Ball::getTimeToReachTarget).
     * NOTE: The 'target' parameter is a 2D vector on the X-Z plane.
     * It modifies the passed velocity vector 'v' with the calculated horizontal components.
     * @param target The target position on the X-Z plane. `target.y` corresponds to the Z-axis.
     * @param velocity The scalar magnitude of the horizontal velocity.
     * @param spin The spin of the ball (x: side, y: top/back).
     * @param v The 3D velocity vector to be populated (output).
     * @returns The time in seconds to reach the target.
     */
    private getTimeToReachTarget(target: THREE.Vector2, velocity: number, spin: THREE.Vector2, v: THREE.Vector3): number {
        if (Math.abs(spin.x) < 1e-6) {
            const targetLen = target.length();
            if (targetLen < 1e-6) {
                v.x = 0;
                v.z = 0;
                return 100000;
            }
            v.x = target.x / targetLen * velocity;
            v.z = target.y / targetLen * velocity;

            const timeToReach = 1 - PHY * targetLen / velocity;
            if (timeToReach <= 0 || velocity === 0) {
                return 100000;
            }
            return -Math.log(timeToReach) / PHY;
        } else {
            const targetLen = target.length();
            if (velocity === 0) return 100000;

            const asin_arg = targetLen * spin.x / (2 * velocity);
            if (Math.abs(asin_arg) > 1) {
                return 100000;
            }
            const theta = Math.asin(asin_arg);

            const cos_m_theta = Math.cos(-theta);
            const sin_m_theta = Math.sin(-theta);
            const target_norm_x = target.x / targetLen;
            const target_norm_z = target.y / targetLen;

            v.x = (target_norm_x * cos_m_theta - target_norm_z * sin_m_theta) * velocity;
            v.z = (target_norm_x * sin_m_theta + target_norm_z * cos_m_theta) * velocity;

            const timeToReach = 1 - 2 * PHY / spin.x * theta;
            if (timeToReach <= 0) {
                return 100000;
            }
            return -Math.log(timeToReach) / PHY;
        }
    }

    /**
     * Calculates the initial vertical velocity (Vy) required to reach a target height in a given time.
     * Ported from the original C++ code (Ball::getVz0ToReachTarget).
     * @param targetHeight The relative height difference to the target.
     * @param spin The spin of the ball (y-component is used for top/back spin).
     * @param t The time in seconds.
     * @returns The required initial vertical velocity.
     */
    private getVy0ToReachTarget(targetHeight: number, spin: THREE.Vector2, t: number): number {
        if (t > 1e-6) {
            const gravityEffect = GRAVITY(spin.y);
            const exp_phy_t = Math.exp(-PHY * t);
            return (PHY * targetHeight + gravityEffect * t) / (1 - exp_phy_t) - gravityEffect / PHY;
        } else {
            return -targetHeight;
        }
    }
}
