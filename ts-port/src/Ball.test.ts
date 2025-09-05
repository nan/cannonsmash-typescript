import { describe, it, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { Ball } from './Ball';
import { Player } from './Player';
import { TABLE_LENGTH, SERVE_NORMAL, stype, TICK, TABLE_WIDTH } from './constants';
import type { Game } from './Game';

vi.mock('./Player', () => {
  const Player = vi.fn();
  return { Player };
});

describe('Ball Physics: Debug Logging', () => {

    let ball: Ball;
    let player: Player;
    let mockGame: Game;

    beforeEach(() => {
        ball = new Ball();
        player = new Player(1, 1);
        player.side = 1;
        player.swingType = SERVE_NORMAL;
        mockGame = {
            getService: () => player.side,
            player1: player,
            player2: null,
        } as unknown as Game;
    });

    it('should log the trajectory for a standard serve', () => {
        // This test is for logging only. All assertions are removed.

        const serveParams = stype.get(SERVE_NORMAL)!;
        const servePosition = new THREE.Vector3(0, 0, TABLE_LENGTH / 2 + 0.5);
        const target = new THREE.Vector2(0, -TABLE_LENGTH / 4);
        const spin = new THREE.Vector2(0, 0);
        const level = 0.8;

        // Compensate for the hitX offset to make the true start position x=0
        player.mesh = { position: new THREE.Vector3(servePosition.x - serveParams.hitX, 0, servePosition.z) };
        ball.reset(player);

        console.log(`[SETUP] Player initial pos: ${JSON.stringify(player.mesh.position)}`);
        console.log(`[SETUP] Ball initial pos: ${JSON.stringify(ball.mesh.position)}`);
        console.log(`[SETUP] Target: ${JSON.stringify(target)}`);

        const predictedVelocity = ball.targetToVS(player, target, level, spin);

        const simBall = new Ball();
        simBall.mesh.position.copy(ball.mesh.position);
        simBall.velocity.copy(predictedVelocity);
        simBall.spin.copy(spin);
        simBall.status = 4;

        const simulationSteps = 300;

        for (let i = 0; i < simulationSteps; i++) {
            simBall.update(TICK, mockGame);
        }
    });
});
