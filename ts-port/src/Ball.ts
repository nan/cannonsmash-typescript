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
        const relativeTargetXZ = target.clone().sub(ballPosXZ);

        let v_h_Min = 0.1;
        let v_h_Max = 30.0;
        const finalVelocity = new THREE.Vector3();

        // Binary search for the optimal horizontal velocity
        for (let i = 0; i < 15; i++) {
            const v_h_mid = (v_h_Min + v_h_Max) / 2;
            if (v_h_mid === v_h_Min || v_h_mid === v_h_Max) break;

            const v_h_Current = v_h_mid * level;
            const t2 = this.getTimeToReachTarget(relativeTargetXZ, v_h_Current, spin, finalVelocity);

            if (t2 > 9999) {
                v_h_Min = v_h_mid;
                continue;
            }

            const targetHeight = TABLE_HEIGHT - ballPos.y;
            const vy_initial = this.getVy0ToReachTarget(targetHeight, spin, t2);

            const distToNetZ = -ballPos.z;
            const totalDistZ = relativeTargetXZ.y;
            if (totalDistZ <= 1e-6) {
                v_h_Max = v_h_mid;
                continue;
            }
            const t1 = t2 * (distToNetZ / totalDistZ);

            if (t1 < 0 || t1 > t2) {
                v_h_Max = v_h_mid;
                continue;
            }

            const heightChangeAtNet = this.calculateHeightAtTime(vy_initial, spin.y, t1);
            const absHeightAtNet = ballPos.y + heightChangeAtNet;

            // Corrected logic: If ball is too low, we need a higher arc, which means a *lower* horizontal speed.
            if (absHeightAtNet < TABLE_HEIGHT + NET_HEIGHT) {
                v_h_Max = v_h_mid;
            } else {
                // If it clears the net, it's a valid candidate. We can try a faster (flatter) shot to find the limit.
                v_h_Min = v_h_mid;
            }
        }

        const optimal_v_h = v_h_Min * level;
        const tFinal = this.getTimeToReachTarget(relativeTargetXZ, optimal_v_h, spin, finalVelocity);

        if (tFinal > 9999) {
            console.error("Serve calculation failed (1-bounce), using fallback.");
            const fallback = new THREE.Vector3(0, 2.8, -4.5);
            fallback.multiplyScalar(level);
            return fallback;
        }

        const targetHeightFinal = TABLE_HEIGHT - ballPos.y;
        finalVelocity.y = this.getVy0ToReachTarget(targetHeightFinal, spin, tFinal);

        return finalVelocity;
    }

    private calculateHeightAtTime(initialVy: number, spinY: number, t: number): number {
        const gravityEffect = GRAVITY(spinY);
        return (PHY * initialVy + gravityEffect) / (PHY * PHY) * (1 - Math.exp(-PHY * t)) - gravityEffect / PHY * t;
    }

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

            if (velocity === 0) return 100000;
            const timeToReach = 1 - PHY * targetLen / velocity;
            if (timeToReach <= 0) {
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

            if (spin.x === 0) return 100000;
            const timeToReach = 1 - 2 * PHY / spin.x * theta;
            if (timeToReach <= 0) {
                return 100000;
            }
            return -Math.log(timeToReach) / PHY;
        }
    }

    private getVy0ToReachTarget(targetHeight: number, spin: THREE.Vector2, t: number): number {
        if (t > 1e-6) {
            const gravityEffect = GRAVITY(spin.y);
            const exp_phy_t = Math.exp(-PHY * t);
            if (Math.abs(1 - exp_phy_t) < 1e-9) return 100000; // Avoid division by zero
            return (PHY * targetHeight + gravityEffect * t) / (1 - exp_phy_t) - gravityEffect / PHY;
        } else {
            return 100000;
        }
    }
}
