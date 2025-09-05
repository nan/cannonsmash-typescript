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

        const rot = oldSpin.x / PHY * (1 - exp_phy_t);
        this.velocity.x = (oldVel.x * Math.cos(rot) - oldVel.z * Math.sin(rot)) * exp_phy_t;
        this.velocity.z = (oldVel.x * Math.sin(rot) + oldVel.z * Math.cos(rot)) * exp_phy_t;
        this.velocity.y = (oldVel.y + GRAVITY(oldSpin.y) / PHY) * exp_phy_t - GRAVITY(oldSpin.y) / PHY;

        if (Math.abs(oldSpin.x) < 0.001) {
            this.mesh.position.x = oldPos.x + oldVel.x / PHY * (1 - exp_phy_t);
            this.mesh.position.z = oldPos.z + oldVel.z / PHY * (1 - exp_phy_t);
        } else {
            const r = new THREE.Vector2(oldVel.z / oldSpin.x, -oldVel.x / oldSpin.x);
            this.mesh.position.x = r.x * Math.cos(rot) - r.y * Math.sin(rot) + oldPos.x - r.x;
            this.mesh.position.z = r.x * Math.sin(rot) + r.y * Math.cos(rot) + oldPos.z - r.y;
        }
        this.mesh.position.y = (PHY * oldVel.y + GRAVITY(oldSpin.y)) / (PHY * PHY) * (1 - exp_phy_t) - GRAVITY(oldSpin.y) / PHY * time + oldPos.y;
        this.spin.x = oldSpin.x * exp_phy_t;

        this.checkCollision(oldPos, game.player1);
    }

    private checkCollision(oldPos: THREE.Vector3, player: Player) {
        const tableSurfaceY = TABLE_HEIGHT + BALL_RADIUS;

        if (this.mesh.position.y < tableSurfaceY && this.velocity.y < 0) {
            const halfTableW = TABLE_WIDTH / 2;
            const halfTableL = TABLE_LENGTH / 2;
            if (this.mesh.position.x > -halfTableW && this.mesh.position.x < halfTableW &&
                this.mesh.position.z > -halfTableL && this.mesh.position.z < halfTableL)
            {
                this.mesh.position.y = tableSurfaceY;

                const speed = Math.hypot(this.velocity.x, this.velocity.z);
                if (speed > 0) {
                    const spinEffect = this.spin.y * 0.8;
                    this.velocity.x += this.velocity.x / speed * spinEffect;
                    this.velocity.z += this.velocity.z / speed * spinEffect;
                }

                this.velocity.y *= -TABLE_E;
                this.spin.x *= 0.95;
                this.spin.y *= 0.8;

                if (this.mesh.position.z * player.side < 0) { // Opponent's side
                    switch(this.status) {
                        case 0: this.status = 1; break;
                        case 2: this.status = 3; break;
                        case 4: this.status = 0; break;
                        default: this.ballDead(); break;
                    }
                } else { // Player's side
                    switch(this.status) {
                        case 0: this.status = 1; break;
                        case 4: this.status = 0; break;
                        case 5: this.status = 2; break;
                        default: this.ballDead(); break;
                    }
                }
                return;
            }
        }

        if (this.mesh.position.y < BALL_RADIUS && this.velocity.y < 0) {
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
        if (!player) return;
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

    private _getTimeToReachTarget(target: THREE.Vector2, velocity: number, spin: THREE.Vector2, vOut: THREE.Vector3): number {
        const targetLen = target.length();
        if (targetLen === 0) return 0;
        if (velocity <=0) return 100000;

        if (Math.abs(spin.x) < 0.001) {
            vOut.x = target.x / targetLen * velocity;
            vOut.z = target.y / targetLen * velocity;
            const expr = 1 - PHY * targetLen / velocity;
            if (expr <= 0) return 100000;
            return -Math.log(expr) / PHY;
        } else {
            const val = targetLen * spin.x / (2 * velocity);
            if (Math.abs(val) > 1) return 100000;
            const theta = Math.asin(val);
            const cosTheta = Math.cos(-theta);
            const sinTheta = Math.sin(-theta);
            const targetUnit = target.clone().normalize();
            vOut.x = (targetUnit.x * cosTheta - targetUnit.y * sinTheta) * velocity;
            vOut.z = (targetUnit.x * sinTheta + targetUnit.y * cosTheta) * velocity;
            const expr = 1 - 2 * PHY / spin.x * theta;
            if (expr <= 0) return 100000;
            return -Math.log(expr) / PHY;
        }
    }

    private _getVz0ToReachTarget(targetHeight: number, spin: THREE.Vector2, t: number): number {
        if (t > 0.001) {
            const g = GRAVITY(spin.y);
            return (PHY * targetHeight + g * t) / (1 - Math.exp(-PHY * t)) - g / PHY;
        }
        return -targetHeight;
    }

    private _getTimeToReachY(targetZ: number, currentPos: THREE.Vector2, spin: THREE.Vector2, v: THREE.Vector3): { time: number; targetX: number } {
        const vHorizontal = new THREE.Vector2(v.x, v.z);
        if (Math.abs(spin.x) < 0.001) {
            let targetX = currentPos.x;
            if (Math.abs(v.z) > 1e-6) {
                 targetX = currentPos.x + v.x / v.z * (targetZ - currentPos.y);
            }
            const target = new THREE.Vector2(targetX, targetZ);
            const time = this._getTimeToReachTarget(target.clone().sub(currentPos), vHorizontal.length(), spin, new THREE.Vector3());
            return { time, targetX };
        } else {
            const centerX = currentPos.x - v.z / spin.x;
            const centerZ = currentPos.y + v.x / spin.x;
            const center = new THREE.Vector2(centerX, centerZ);
            const radiusSq = vHorizontal.lengthSq() / (spin.x * spin.x);
            const dzSq = (targetZ - center.y) * (targetZ - center.y);
            if (radiusSq < dzSq) return { time: 100000, targetX: 0 };
            const dx = Math.sqrt(radiusSq - dzSq);
            const target1 = new THREE.Vector2(center.x + dx, targetZ);
            const target2 = new THREE.Vector2(center.x - dx, targetZ);
            const dot1 = currentPos.clone().sub(center).dot(target1.clone().sub(center));
            const dot2 = currentPos.clone().sub(center).dot(target2.clone().sub(center));
            const chosenTarget = (dot1 > dot2) ? target1 : target2;
            const time = this._getTimeToReachTarget(chosenTarget.clone().sub(currentPos), vHorizontal.length(), spin, new THREE.Vector3());
            return { time, targetX: chosenTarget.x };
        }
    }

    public targetToVS(player: Player, target: THREE.Vector2, level: number, spin: THREE.Vector2): THREE.Vector3 {
        const initialBallPos = this.mesh.position;
        const initialBallPos2D = new THREE.Vector2(initialBallPos.x, initialBallPos.z);
        let bestVelocity = new THREE.Vector3();
        let bestHorizontalSpeedSq = -1;

        for (let boundZ = -TABLE_LENGTH / 2; boundZ < TABLE_LENGTH / 2; boundZ += TICK * 5) {
            if (boundZ * initialBallPos.z <= 0) continue;

            let vMin = 0.1, vMax = 30.0, finalHeight = 0, finalBoundX = 0;
            for (let v_iter = 0; v_iter < 20; v_iter++) {
                if (vMax - vMin < 0.001) break;
                const vHorizontal = (vMin + vMax) / 2;
                let xMin = -TABLE_WIDTH / 2, xMax = TABLE_WIDTH / 2;

                for (let x_iter = 0; x_iter < 20; x_iter++) {
                    if (xMax - xMin < 0.001) break;
                    const boundX = (xMin + xMax) / 2;
                    const boundPoint = new THREE.Vector2(boundX, boundZ);
                    const initialVelocityGuess = new THREE.Vector3();
                    const timeToBound = this._getTimeToReachTarget(boundPoint.clone().sub(initialBallPos2D), vHorizontal, spin, initialVelocityGuess);
                    if (timeToBound > 9999) { xMax = boundX; continue; }

                    const spinAtBound = spin.clone().multiplyScalar(Math.exp(-PHY * timeToBound));
                    const velAtBound = new THREE.Vector3();
                    const rot = spin.x / PHY * (1 - Math.exp(-PHY * timeToBound));
                    velAtBound.x = (initialVelocityGuess.x * Math.cos(rot) - initialVelocityGuess.z * Math.sin(rot)) * Math.exp(-PHY * timeToBound);
                    velAtBound.z = (initialVelocityGuess.x * Math.sin(rot) + initialVelocityGuess.z * Math.cos(rot)) * Math.exp(-PHY * timeToBound);

                    const spinAfterBounce = spinAtBound.clone();
                    spinAfterBounce.x *= 0.95;
                    spinAfterBounce.y *= 0.8;

                    const velAfterBounce = velAtBound.clone();
                    const vCurrentXY = Math.hypot(velAfterBounce.x, velAfterBounce.z);
                    if (vCurrentXY > 0) {
                        velAfterBounce.x += velAfterBounce.x / vCurrentXY * spinAtBound.y * 0.8;
                        velAfterBounce.z += velAfterBounce.z / vCurrentXY * spinAtBound.y * 0.8;
                    }

                    const result = this._getTimeToReachY(target.y, boundPoint, spinAfterBounce, velAfterBounce);
                    if (result.finalTargetX < target.x) xMin = boundX; else xMax = boundX;
                }
                finalBoundX = (xMin + xMax) / 2;

                const boundPoint = new THREE.Vector2(finalBoundX, boundZ);
                const initialVelocity = new THREE.Vector3();
                const timeToBound = this._getTimeToReachTarget(boundPoint.clone().sub(initialBallPos2D), vHorizontal, spin, initialVelocity);
                if (timeToBound > 9999) continue;
                initialVelocity.y = this._getVz0ToReachTarget(TABLE_HEIGHT - initialBallPos.y, spin, timeToBound);

                const velAtBoundY = (initialVelocity.y + GRAVITY(spin.y) / PHY) * Math.exp(-PHY * timeToBound) - GRAVITY(spin.y) / PHY;
                const velAfterBounceY = velAtBoundY * -TABLE_E;

                const spinAtBound = spin.clone().multiplyScalar(Math.exp(-PHY * timeToBound));
                const spinAfterBounce = spinAtBound.clone();
                spinAfterBounce.x *= 0.95;
                spinAfterBounce.y *= 0.8;

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
                if (timeBounceToTarget > 9999) continue;
                const gAfterBounce = GRAVITY(spinAfterBounce.y);
                const exp_phy_t1 = Math.exp(-PHY * timeBounceToTarget);
                finalHeight = (TABLE_HEIGHT) + (velAfterBounceY + gAfterBounce / PHY) / PHY * (1 - exp_phy_t1) - gAfterBounce / PHY * timeBounceToTarget;

                if (finalHeight > TABLE_HEIGHT) vMax = vHorizontal; else vMin = vHorizontal;
            }

            if (Math.abs(finalHeight - TABLE_HEIGHT) > 0.05) continue;

            const vHorizontal = (vMin + vMax) / 2;
            const boundPoint = new THREE.Vector2(finalBoundX, boundZ);
            const initialVelocity = new THREE.Vector3();
            const timeToBound = this._getTimeToReachTarget(boundPoint.clone().sub(initialBallPos2D), vHorizontal, spin, initialVelocity);
            if (timeToBound > 9999) continue;
            initialVelocity.y = this._getVz0ToReachTarget(TABLE_HEIGHT - initialBallPos.y, spin, timeToBound);

            const velAtBoundY = (initialVelocity.y + GRAVITY(spin.y) / PHY) * Math.exp(-PHY * timeToBound) - GRAVITY(spin.y) / PHY;
            const velAfterBounceY = velAtBoundY * -TABLE_E;

            const spinAtBound = spin.clone().multiplyScalar(Math.exp(-PHY * timeToBound));
            const spinAfterBounce = spinAtBound.clone();
            spinAfterBounce.x *= 0.95;
            spinAfterBounce.y *= 0.8;

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
                const gAfterBounce = GRAVITY(spinAfterBounce.y);
                const exp_phy_t_net = Math.exp(-PHY * timeToNet);
                const heightAtNet = (TABLE_HEIGHT) + (velAfterBounceY + gAfterBounce / PHY) / PHY * (1 - exp_phy_t_net) - gAfterBounce / PHY * timeToNet;
                const requiredHeight = (TABLE_HEIGHT + NET_HEIGHT) + (1.0 - level) * 0.1;

                if (heightAtNet > requiredHeight) {
                    const horizontalSpeedSq = initialVelocity.x * initialVelocity.x + initialVelocity.z * initialVelocity.z;
                    if (horizontalSpeedSq > bestHorizontalSpeedSq) {
                        bestHorizontalSpeedSq = horizontalSpeedSq;
                        bestVelocity.copy(initialVelocity);

                        // Log the details of this successful prediction
                        console.log(`[PREDICTION_DETAILS]`, {
                            boundPoint: { x: boundPoint.x, z: boundPoint.y },
                            timeToBounce: timeToBound,
                            velAtBounce: { x: velAtBound.x, y: velAtBoundY, z: velAtBound.z },
                            velAfterBounce: { x: velAfterBounceXZ.x, y: velAfterBounceY, z: velAfterBounceXZ.z }
                        });
                    }
                }
            }
        }

        if (bestHorizontalSpeedSq > 0) {
            return bestVelocity;
        } else {
            console.warn("targetToVS: Could not find a valid serve velocity. Using fallback.");
            const fallbackVelocity = new THREE.Vector3(0, 2.8, player.side * -4.5);
            return fallbackVelocity;
        }
    }
}
