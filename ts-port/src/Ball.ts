import * as THREE from 'three';
import type { Player } from './Player';
import { stype, TABLE_HEIGHT, PHY, GRAVITY, TICK, TABLE_E, TABLE_WIDTH, TABLE_LENGTH } from './constants';
import type { Game } from './Game';

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

    public update(deltaTime: number, game: Game) {
        // This update logic is ported from the C++ version's Ball::Move()
        // It uses an analytical solution with a fixed TICK, ignoring deltaTime for now for fidelity.
        // TODO: Consider adapting to variable deltaTime if needed.

        if (this.status === 8) { // Waiting for serve
            return; // Do nothing, ball should be stationary
        }
        if (this.status < 0) { // Ball is dead
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

        // Update velocity based on spin (Magnus effect) and air resistance
        // Vxy =  Vxy0*Rot(SpinX/PHY*(1-exp(-PHY*t)))*exp(-PHY*t)
        // Vz  = (Vz0+g/PHY)*exp(-PHY*t) - g/PHY
        // C++ Z is our Y (vertical), C++ Y is our Z (depth)

        const exp_phy_t = Math.exp(-PHY * time);

        // Horizontal velocity update (X and Z plane) due to side-spin and drag
        const rot = oldSpin.x / PHY - oldSpin.x / PHY * exp_phy_t;
        this.velocity.x = (oldVel.x * Math.cos(rot) - oldVel.z * Math.sin(rot)) * exp_phy_t;
        this.velocity.z = (oldVel.x * Math.sin(rot) + oldVel.z * Math.cos(rot)) * exp_phy_t;

        // Vertical velocity update due to gravity, top/back-spin, and drag
        this.velocity.y = (oldVel.y + GRAVITY(oldSpin.y) / PHY) * exp_phy_t - GRAVITY(oldSpin.y) / PHY;

        // Update position using analytical solution from C++
        // This is more complex than simple Euler integration (pos += vel * dt)
        if (oldSpin.x === 0.0) {
            this.mesh.position.x = oldPos.x + oldVel.x / PHY - oldVel.x / PHY * exp_phy_t;
            this.mesh.position.z = oldPos.z + oldVel.z / PHY - oldVel.z / PHY * exp_phy_t;
        } else {
            const theta = rot; // Same rotation angle as velocity
            const r = new THREE.Vector2(oldVel.z / oldSpin.x, -oldVel.x / oldSpin.x); // Radius of curvature vector
            this.mesh.position.x = r.x * Math.cos(theta) - r.y * Math.sin(theta) + oldPos.x - r.x;
            this.mesh.position.z = r.x * Math.sin(theta) + r.y * Math.cos(theta) + oldPos.z - r.y;
        }

        this.mesh.position.y = (PHY * oldVel.y + GRAVITY(oldSpin.y)) / (PHY * PHY) - (PHY * oldVel.y + GRAVITY(oldSpin.y)) / (PHY * PHY) * exp_phy_t - GRAVITY(oldSpin.y) / PHY * time + oldPos.y;

        // Update spin decay
        this.spin.x = oldSpin.x * exp_phy_t;

        // --- Collision Check ---
        // A simplified, discrete collision detection.

        // Ground collision
        if (this.mesh.position.y < BALL_RADIUS) {
            this.mesh.position.y = BALL_RADIUS;
            this.velocity.y *= -TABLE_E;

            // Apply friction to horizontal velocity
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;

            // If the ball has almost stopped moving, consider it dead
            if (this.velocity.lengthSq() < 0.1) {
                this.ballDead();
            }
        }

        // Table collision
        const halfTableW = TABLE_WIDTH / 2;
        const halfTableL = TABLE_LENGTH / 2;
        if (
            this.mesh.position.y < TABLE_HEIGHT + BALL_RADIUS &&
            this.velocity.y < 0 &&
            this.mesh.position.x > -halfTableW && this.mesh.position.x < halfTableW &&
            this.mesh.position.z > -halfTableL && this.mesh.position.z < halfTableL
        ) {
            this.mesh.position.y = TABLE_HEIGHT + BALL_RADIUS;
            this.velocity.y *= -TABLE_E;

            // Apply spin decay on bounce
            this.spin.x *= 0.95;
            this.spin.y *= 0.8;

            // Update status based on which side of the net the bounce occurred
            if (this.mesh.position.z > 0) { // Player 1's side (near)
                switch(this.status) {
                    case 2: this.status = 3; break; // Bounced on P2, now bounced on P1
                    case 4: this.status = 0; break; // Hit by P1 (serve), now bounced on P1
                    default: this.ballDead(); break;
                }
            } else { // Player 2's side (far)
                switch(this.status) {
                    case 0: this.status = 1; break; // In play towards P2, now bounced on P2
                    case 5: this.status = 2; break; // Hit by P2, now bounced on P2
                    default: this.ballDead(); break;
                }
            }
        }
    }

    public hit(velocity: THREE.Vector3, spin: THREE.Vector2) {
        // TODO: Play sound
        this.velocity.copy(velocity);
        this.spin.copy(spin);

        // Update status based on who hit it
        if (this.status === 6) { // Tossed by P1
            this.status = 4; // Hit by P1
        } else if (this.status === 7) { // Tossed by P2
            this.status = 5; // Hit by P2
        } else if (this.status === 3) { // Bounced on P1's side
            this.status = 0; // Now in play, heading to P2
        } else if (this.status === 1) { // Bounced on P2's side (from P1's shot)
            // This case seems wrong in C++ code, status 1 means ball is moving towards P1
            // A hit should happen after a bounce (status 3), not during travel (status 1).
            // For now, porting as is, but this state transition might need review.
            this.status = 2;
        }
    }

    private ballDead() {
        if (this.status >= 0) {
            // TODO: In C++, this is where score is changed.
            // ((PlayGame *)Control::TheControl())->ChangeScore();
            this.status = -1;
        }
    }

    public toss(player: Player, power: number) {
        this.velocity.y = power; // Y is the vertical axis in this scene
        this.spin.x = 0;
        this.spin.y = 0;

        if (player.side > 0) {
            this.status = 6; // Tossed by player 1 (near side)
        } else {
            this.status = 7; // Tossed by player 2 (far side)
        }
    }

    public reset(player: Player) {
        const serveParams = stype.get(player.swingType);
        if (!serveParams) {
            console.error("Could not find serve params for swing type:", player.swingType);
            return;
        }

        // Position the ball in front of the player, based on C++ Ball::Reset()
        // Note: C++ y-axis is our z-axis
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
        this.status = 8; // Waiting for serve
    }

    public targetToVS(target: THREE.Vector2, level: number, spin: THREE.Vector2): THREE.Vector3 {
        // A simplified, hardcoded velocity calculation for a legal serve.
        // This replaces the complex and buggy `targetToVS` port.
        // The goal is to produce a velocity that reliably results in a valid serve trajectory.

        const velocity = new THREE.Vector3();

        // X velocity is influenced by the target's x position.
        velocity.x = target.x * 0.5;

        // Y velocity is a fixed upward value to create the arc of the toss/hit.
        velocity.y = 2.5;

        // Z velocity is a fixed forward value (towards the net, which is negative Z).
        // This value is chosen to ensure the ball bounces on the near side first.
        velocity.z = -4.0;

        // The `level` parameter could be used to scale the overall velocity
        velocity.multiplyScalar(level);

        return velocity;
    }
}
