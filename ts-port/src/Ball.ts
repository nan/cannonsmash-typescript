import * as THREE from 'three';
import type { Player } from './Player';
import { stype, TABLE_HEIGHT, PHY, GRAVITY, TICK, TABLE_E, TABLE_WIDTH, TABLE_LENGTH, NET_HEIGHT } from './constants';
import type { Game } from './Game';

const BALL_RADIUS = 0.02;

export class Ball {
    public static debugPath: THREE.Vector3[] = [];
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
        if (this.status < 0) {
            this.status--;
            if (this.status < -100) {
                const server = game.getService() === game.player1.side ? game.player1 : game.player2;
                this.reset(server);
                return;
            }
        }
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
            return;
        }
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

    private predictSingleBounce( initialPos: THREE.Vector3, initialVel: THREE.Vector3, initialSpin: THREE.Vector2, maxSteps: number = 500 ): { position: THREE.Vector3; velocity: THREE.Vector3; spin: THREE.Vector2; path: THREE.Vector3[] } | null {
        let position = initialPos.clone(); let velocity = initialVel.clone(); let spin = initialSpin.clone(); const path = [position.clone()];
        for (let i = 0; i < maxSteps; i++) {
            const oldPos = position.clone(); const oldVel = velocity.clone(); const oldSpin = spin.clone(); const time = TICK; const exp_phy_t = Math.exp(-PHY * time); const rot = oldSpin.x / PHY - oldSpin.x / PHY * exp_phy_t;
            velocity.x = (oldVel.x * Math.cos(rot) - oldVel.z * Math.sin(rot)) * exp_phy_t; velocity.z = (oldVel.x * Math.sin(rot) + oldVel.z * Math.cos(rot)) * exp_phy_t; velocity.y = (oldVel.y + GRAVITY(oldSpin.y) / PHY) * exp_phy_t - GRAVITY(oldSpin.y) / PHY;
            if (Math.abs(oldSpin.x) < 0.001) { position.x = oldPos.x + oldVel.x / PHY - oldVel.x / PHY * exp_phy_t; position.z = oldPos.z + oldVel.z / PHY - oldVel.z / PHY * exp_phy_t;
            } else { const theta = rot; const r = new THREE.Vector2(oldVel.z / oldSpin.x, -oldVel.x / oldSpin.x); position.x = r.x * Math.cos(theta) - r.y * Math.sin(theta) + oldPos.x - r.x; position.z = r.x * Math.sin(theta) + r.y * Math.cos(theta) + oldPos.z - r.y; }
            position.y = (PHY * oldVel.y + GRAVITY(oldSpin.y)) / (PHY * PHY) * (1 - exp_phy_t) - GRAVITY(oldSpin.y) / PHY * time + oldPos.y; spin.x = oldSpin.x * exp_phy_t; path.push(position.clone());
            const halfTableW = TABLE_WIDTH / 2; const halfTableL = TABLE_LENGTH / 2;
            if (position.y < TABLE_HEIGHT + BALL_RADIUS && velocity.y < 0 && position.x > -halfTableW && position.x < halfTableW && position.z > -halfTableL && position.z < halfTableL) { return { position, velocity, spin, path }; }
            if (position.y < BALL_RADIUS && velocity.y < 0) { return null; }
        }
        return null;
    }

    private predictTwoBounces( initialPos: THREE.Vector3, initialVel: THREE.Vector3, initialSpin: THREE.Vector2 ): { firstBounce: THREE.Vector3, secondBounce: THREE.Vector3, path: THREE.Vector3[] } | null {
        const firstBounceResult = this.predictSingleBounce(initialPos, initialVel, initialSpin); if (!firstBounceResult) return null;
        let { position: posAfter1st, velocity: velAfter1st, spin: spinAfter1st, path: path1 } = firstBounceResult;
        velAfter1st.y *= -TABLE_E; spinAfter1st.x *= 0.95; spinAfter1st.y *= 0.8;
        const secondBounceResult = this.predictSingleBounce(posAfter1st, velAfter1st, spinAfter1st); if (!secondBounceResult) return null;
        const fullPath = path1.concat(secondBounceResult.path);
        return { firstBounce: firstBounceResult.position, secondBounce: secondBounceResult.position, path: fullPath };
    }

    public targetToVS(initialPos: THREE.Vector3, player: Player, target: THREE.Vector2, level: number, spin: THREE.Vector2): THREE.Vector3 {
        const side = player.side;
        console.log(`[Serve Calc] Start. Player Z: ${initialPos.z.toFixed(2)}, Target: {x:${target.x.toFixed(2)}, z:${target.y.toFixed(2)}}, Spin: {x:${spin.x.toFixed(2)}, y:${spin.y.toFixed(2)}}`);

        let bestVelocity: THREE.Vector3 | null = null;
        let minDistance = Infinity;
        let bestPath: THREE.Vector3[] = [];

        const vx_step = 0.2;
        const vz_step = -0.2 * side;

        for (let vx = -2.0; vx <= 2.0; vx += vx_step) {
            const vz_start = -2.0 * side;
            const vz_end = -10.0 * side;
            for (let vz = vz_start; (side > 0 ? vz >= vz_end : vz <= vz_end); vz += vz_step) {

                let low_vy = 0.5;
                let high_vy = 8.0;
                let final_vy = -1;

                for (let i = 0; i < 10; i++) {
                    const mid_vy = (low_vy + high_vy) / 2;
                    const testVel = new THREE.Vector3(vx, mid_vy, vz);
                    const result = this.predictTwoBounces(initialPos, testVel, spin);

                    if (result && result.secondBounce) {
                        const isFirstBounceValid = Math.sign(side) === Math.sign(result.firstBounce.z) && Math.abs(result.firstBounce.z) < TABLE_LENGTH / 2;
                        const isSecondBounceValid = Math.sign(side) !== Math.sign(result.secondBounce.z) && Math.abs(result.secondBounce.z) < TABLE_LENGTH / 2;

                        if (isFirstBounceValid && isSecondBounceValid) {
                            const heightError = result.secondBounce.y - (TABLE_HEIGHT + BALL_RADIUS);
                            if (heightError > 0) high_vy = mid_vy;
                            else low_vy = mid_vy;
                        } else {
                            low_vy = mid_vy;
                        }
                    } else {
                        low_vy = mid_vy;
                    }
                }
                final_vy = (low_vy + high_vy) / 2;

                const finalVel = new THREE.Vector3(vx, final_vy, vz);
                const finalResult = this.predictTwoBounces(initialPos, finalVel, spin);

                if (finalResult) {
                    const { firstBounce, secondBounce, path } = finalResult;
                    const isFirstBounceValid = Math.sign(side) === Math.sign(firstBounce.z) && Math.abs(firstBounce.z) < TABLE_LENGTH / 2;
                    const isSecondBounceValid = Math.sign(side) !== Math.sign(secondBounce.z) && Math.abs(secondBounce.z) < TABLE_LENGTH / 2;

                    if(isFirstBounceValid && isSecondBounceValid) {
                         let clearsNet = false;
                         for (let i = 0; i < path.length - 1; i++) {
                             const p1 = path[i]; const p2 = path[i + 1];
                             if (Math.sign(p1.z) !== Math.sign(p2.z)) {
                                 const z_dist = Math.abs(p1.z) + Math.abs(p2.z);
                                 if (z_dist > 1e-6) {
                                     const weight = Math.abs(p1.z) / z_dist;
                                     const heightAtNet = p1.y + (p2.y - p1.y) * weight;
                                     if (heightAtNet > TABLE_HEIGHT + NET_HEIGHT) clearsNet = true;
                                 }
                                 break;
                             }
                         }
                         if(clearsNet) {
                            const distance = new THREE.Vector2(secondBounce.x, secondBounce.z).distanceTo(target);
                            if (distance < minDistance) {
                                minDistance = distance;
                                bestVelocity = finalVel;
                                bestPath = path;
                            }
                         }
                    }
                }
            }
        }

        if (bestVelocity) {
            console.log(`[Serve Calc] End. Found best velocity. Vel: {x:${bestVelocity.x.toFixed(2)}, y:${bestVelocity.y.toFixed(2)}, z:${bestVelocity.z.toFixed(2)}}, Dist: ${minDistance.toFixed(3)}`);
            Ball.debugPath = bestPath;
            const finalVelocity = bestVelocity.clone();
            finalVelocity.multiplyScalar(level);
            return finalVelocity;
        }

        console.warn("[Serve Calc] End. Could not find a valid serve velocity, using fallback.");
        const fallbackVel = new THREE.Vector3(0, 2.8, -4.5);
        if (side > 0) {
            fallbackVel.z *= -1;
        }
        fallbackVel.multiplyScalar(level);
        return fallbackVel;
    }
}
