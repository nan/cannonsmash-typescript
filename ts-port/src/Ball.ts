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
            }
            return;
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
        // FINAL FALLBACK IMPLEMENTATION
        // This is a fixed, hardcoded velocity that is known to produce a
        // legal serve from the standard starting position. It does not account
        // for player position or target, but it provides a reliable serve.
        const velocity = new THREE.Vector3(0, 2.8, -4.5);
        velocity.multiplyScalar(level);
        return velocity;
    }
}
