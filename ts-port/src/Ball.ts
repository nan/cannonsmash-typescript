import * as THREE from 'three';
import type { Player } from './Player';

const BALL_RADIUS = 0.02; // Assuming meters

// Ball status from Ball.h
// Note: These are conceptual states. The actual values are numbers.
// const STATUS_NORMAL_P1 = 0;      // In play, towards player 2
// const STATUS_NORMAL_P2 = 1;      // In play, towards player 1
// const STATUS_BOUNCED_P2 = 2;     // Bounced on player 2's side
// const STATUS_BOUNCED_P1 = 3;     // Bounced on player 1's side
// const STATUS_HIT_P1 = 4;         // Hit by player 1, towards player 2
// const STATUS_HIT_P2 = 5;         // Hit by player 2, towards player 1
// const STATUS_TOSSED_P1 = 6;      // Tossed for serve by player 1
// const STATUS_TOSSED_P2 = 7;      // Tossed for serve by player 2
// const STATUS_WAIT_SERVE = 8;     // Waiting for serve
// const STATUS_DEAD = -1;          // Ball is out of play

export class Ball {
    public mesh: THREE.Mesh;
    public velocity = new THREE.Vector3();
    public spin = new THREE.Vector2(); // x, y spin in rad/s
    public status = 8; // Initial state: waiting for serve

    constructor() {
        const geometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        this.mesh = new THREE.Mesh(geometry, material);
    }

    public update(deltaTime: number) {
        // Ball physics
        this.mesh.position.addScaledVector(this.velocity, deltaTime);
    }

    public toss(player: Player, power: number) {
        this.velocity.z = power;
        this.spin.x = 0;
        this.spin.y = 0;

        if (player.side > 0) {
            this.status = 6; // Tossed by player 1 (near side)
        } else {
            this.status = 7; // Tossed by player 2 (far side)
        }
    }
}
