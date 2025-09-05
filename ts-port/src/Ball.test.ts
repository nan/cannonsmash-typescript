import { describe, expect, beforeEach, vi, test } from 'vitest';
import * as THREE from 'three';
import { Ball } from './Ball';
import { Player } from './Player';
import { TABLE_LENGTH, SERVE_NORMAL, stype, TICK, TABLE_WIDTH } from './constants';
import type { Game } from './Game';

vi.mock('./Player', () => {
  const Player = vi.fn();
  return { Player };
});

describe('Ball Physics: Prediction vs. Reality', () => {

    let ball: Ball;
    let player: Player;
    let mockGame: Game;

    // Define the test parameters
    const serveX = [ 0 ];
    const serveZ = [
        TABLE_LENGTH / 2 + 0.5, TABLE_LENGTH / 2 + 1.0, TABLE_LENGTH / 2 + 2.0
    ];
    const targetPositions = [
        { name: 'Center', pos: new THREE.Vector2(0, -TABLE_LENGTH / 4) },
        { name: 'Wide Left', pos: new THREE.Vector2(TABLE_WIDTH / 4, -TABLE_LENGTH / 4) },
        { name: 'Wide Right', pos: new THREE.Vector2(-TABLE_WIDTH / 4, -TABLE_LENGTH / 4) }
    ];
    const spinTypes = [
        { name: 'no spin', spin: new THREE.Vector2(0, 0) },
        { name: 'topspin', spin: new THREE.Vector2(0, 5) },
        { name: 'backspin', spin: new THREE.Vector2(0, -5) },
        { name: 'sidespin', spin: new THREE.Vector2(5, 0) },
    ];

    // Generate all combinations
    const testCases: any[] = [];
    serveX.forEach(sx => {
        serveZ.forEach(sz => {
            targetPositions.forEach(tp => {
                spinTypes.forEach(st => {
                    testCases.push({
                        servePos: { x: sx, z: sz },
                        targetPos: tp.pos,
                        targetName: tp.name,
                        spin: st.spin,
                        spinName: st.name
                    });
                });
            });
        });
    });

    const runServeTest = (servePos: {x: number, z: number}, target: THREE.Vector2, spin: THREE.Vector2) => {
        const serveParams = stype.get(SERVE_NORMAL)!;
        // Compensate for the automatic offset in ball.reset() to ensure the ball starts at the intended x-coordinate.
        const compensatedX = servePos.x - serveParams.hitX;

        player.mesh.position.set(compensatedX, 0, servePos.z);
        ball.reset(player);

        const predictedVelocity = ball.targetToVS(player, target, 0.8, spin);
        const fallbackVelocity = new THREE.Vector3(0, 2.8, player.side * -4.5);
        expect(predictedVelocity.equals(fallbackVelocity), `Prediction failed for serve=${JSON.stringify(servePos)}, target=${JSON.stringify(target)}, spin=${JSON.stringify(spin)}`).toBe(false);

        const simBall = new Ball();
        simBall.mesh.position.copy(ball.mesh.position);
        simBall.velocity.copy(predictedVelocity);
        simBall.spin.copy(spin);
        simBall.status = 4;

        let bouncePositions: THREE.Vector3[] = [];
        let firstBounceDone = false;
        const simulationSteps = 300;

        for (let i = 0; i < simulationSteps; i++) {
            const statusBefore = simBall.status;
            simBall.update(TICK, mockGame);
            if (!firstBounceDone && simBall.status === 0 && statusBefore === 4) {
                firstBounceDone = true;
            } else if (firstBounceDone && simBall.status === 1 && statusBefore === 0) {
                bouncePositions.push(simBall.mesh.position.clone());
            }
        }

        expect(bouncePositions.length).toBe(1);
        const landingPos = bouncePositions[0];
        expect(landingPos.x).toBeCloseTo(target.x, 0.1);
        expect(landingPos.z).toBeCloseTo(target.y, 0.1);
    };

    beforeEach(() => {
        ball = new Ball();
        player = new Player(1, 1);
        player.side = 1;
        player.mesh = { position: new THREE.Vector3() };
        player.swingType = SERVE_NORMAL;
        mockGame = {
            getService: () => player.side,
            player1: player,
            player2: null,
        } as unknown as Game;
    });

    test.each(testCases)(
        'should land near target (serve_x=$servePos.x, serve_z=$servePos.z, target=$targetName, spin=$spinName)',
        ({ servePos, targetPos, spin }) => {
            runServeTest(servePos, targetPos, spin);
        }
    );
});
