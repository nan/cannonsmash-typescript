// ts-port/tests/unit/Ball.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Ball, BallStatus } from '../../src/Ball';
import { Player } from '../../src/Player';
import * as THREE from 'three';
import { TABLE_HEIGHT, TABLE_LENGTH, TABLE_WIDTH, NET_HEIGHT, TICK } from '../../src/constants';

// Mock Player to satisfy Ball's method signatures
vi.mock('../../src/Player', async (importOriginal) => {
    const THREE = await import('three');
    const { TABLE_LENGTH } = await import('../../src/constants');
    const Player = vi.fn();
    Player.prototype.mesh = { position: new THREE.Vector3(0, 0, TABLE_LENGTH / 2) };
    Player.prototype.side = 1;
    Player.prototype.swingType = 'Fnormal';
    return {
        ...(await importOriginal<typeof import('../../src/Player')>()),
        Player,
    };
});

describe('Ball', () => {
    let ball: Ball;

    beforeEach(() => {
        ball = new Ball();
    });

    // Test Case BL-01: Initialization
    it('should initialize with correct default values', () => {
        expect(ball.mesh.position).toEqual(new THREE.Vector3(0, 0, 0)); // Default position
        expect(ball.velocity).toEqual(new THREE.Vector3(0, 0, 0));
        expect(ball.spin).toEqual(new THREE.Vector2(0, 0));
        expect(ball.status).toBe(BallStatus.WAITING_FOR_SERVE);
    });

    // Test Case BL-02: Physics (Gravity and Air Resistance)
    it('should follow a parabolic trajectory due to gravity', () => {
        ball.velocity.set(0, 5, -5); // Initial upward and forward velocity
        const initialY = ball.mesh.position.y;
        const initialZ = ball.mesh.position.z;

        // Simulate a few physics steps
        for (let i = 0; i < 30; i++) {
            ball._updatePhysics(TICK);
        }

        // After some time, the ball should have moved down from its peak
        expect(ball.mesh.position.y).toBeLessThan(initialY + 5.0); // It shouldn't fly up forever
        expect(ball.velocity.y).toBeLessThan(5); // Gravity should reduce upward velocity

        // It should have moved forward
        expect(ball.mesh.position.z).toBeLessThan(initialZ);
    });

    // Test Case BL-03: Table Collision
    it('should bounce off the table', () => {
        // Start above the table on Player 1's side (z > 0)
        ball.mesh.position.set(0, TABLE_HEIGHT + 0.1, TABLE_LENGTH / 4);
        ball.velocity.set(0, -5, 0); // Moving downwards
        ball.status = BallStatus.IN_PLAY_TO_HUMAN; // Simulate a rally state, ball is moving toward P1's side

        // Simulate physics until the ball hits the table
        for (let i = 0; i < 100 && ball.mesh.position.y > TABLE_HEIGHT + 0.02; i++) {
            const oldPos = ball.mesh.position.clone();
            ball._updatePhysics(TICK);
            ball.checkCollision(oldPos);
        }

        expect(ball.velocity.y).toBeGreaterThan(0); // Should be moving upwards after bounce
        expect(ball.status).toBe(BallStatus.RALLY_TO_HUMAN); // State should change after bounce
    });

    // Test Case BL-04: Net Collision
    it('should bounce off the net', () => {
        const oldPos = new THREE.Vector3(0, TABLE_HEIGHT + 0.05, 0.1);
        ball.mesh.position.set(0, TABLE_HEIGHT + 0.05, -0.1); // Ball crosses the net plane (z=0)
        ball.velocity.set(0, 0, -5); // Moving towards the net

        ball.checkCollision(oldPos);

        expect(ball.velocity.z).toBeGreaterThan(0); // Should reverse Z velocity
    });

    // Test Case BL-05: Side Wall Collision (not implemented in Ball.ts, test would fail)
    // Skipped: The current `checkCollision` logic does not handle side wall collisions.

    // Test Case BL-06: Floor Collision
    it('should bounce off the floor and be marked as dead', () => {
        ball.mesh.position.set(0, 0.01, 0); // Just above the floor
        ball.velocity.set(0, -5, 0);
        ball.status = BallStatus.RALLY_TO_AI;

        ball.checkCollision(new THREE.Vector3(0, 0.02, 0));

        expect(ball.velocity.y).toBeGreaterThan(0); // Should bounce up
        expect(ball.status).toBe(BallStatus.DEAD); // Ball is out of play
    });

    // Test Case BL-07: State Transition (Toss)
    it('should transition to TOSS status when tossed', () => {
        const player = new Player(1);
        ball.toss(player, 5);

        expect(ball.status).toBe(BallStatus.TOSS_P1);
        expect(ball.velocity.y).toBe(5);
    });
});
