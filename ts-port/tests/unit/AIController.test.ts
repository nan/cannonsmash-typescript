// ts-port/tests/unit/AIController.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIController } from '../../src/AIController';
import { Player } from '../../src/Player';
import { Ball, BallStatus } from '../../src/Ball';
import { Game } from '../../src/Game';
import * as THREE from 'three';
import { stype } from '../../src/SwingTypes';

// Mock dependencies
vi.mock('../../src/Player');
vi.mock('../../src/Ball');
vi.mock('../../src/Game');

describe('AIController', () => {
    let aiController: AIController;
    let mockPlayer: Player;
    let mockBall: Ball;
    let mockOpponent: Player;
    let mockGame: Game;

    beforeEach(() => {
        // Create fresh mocks for each test
        mockPlayer = new Player(-1) as vi.Mocked<Player>;
        mockPlayer.mesh = { position: new THREE.Vector3(0, 0, -2.5) } as any;
        mockPlayer.velocity = new THREE.Vector3(0, 0, 0);
        mockPlayer.side = -1;
        mockPlayer.swing = 0;
        mockPlayer.canInitiateSwing = vi.fn();
        mockPlayer.startServe = vi.fn();
        mockPlayer.startSwing = vi.fn();
        mockPlayer.targetPosition = new THREE.Vector2(0, 0);


        mockBall = new Ball() as vi.Mocked<Ball>;
        mockBall.mesh = { position: new THREE.Vector3(0, 1, 0) } as any;
        mockBall.velocity = new THREE.Vector3(0, 0, 0);

        mockOpponent = new Player(1) as vi.Mocked<Player>;

        mockGame = new Game() as vi.Mocked<Game>;
        mockGame.getService = vi.fn();

        aiController = new AIController(mockGame, mockPlayer, mockBall, mockOpponent);

        vi.clearAllMocks();
    });

    // Test Case AI-01: Initialization
    it('should initialize correctly', () => {
        expect(aiController).toBeDefined();
    });

    // Test Case AI-02: Movement (Waiting for Serve)
    it('should move to home position when waiting for serve', () => {
        mockBall.status = BallStatus.WAITING_FOR_SERVE;
        mockGame.getService.mockReturnValue(1); // Opponent is serving

        aiController.update(0.016, mockGame);

        // AI is at z=-2.5, home is z=-1.87. It should move in the positive z direction.
        expect(mockPlayer.velocity.z).toBeGreaterThan(0);
    });

    // Test Case AI-03: Movement (Rally)
    it('should move towards predicted ball position during rally', () => {
        mockBall.status = BallStatus.RALLY_TO_AI; // Ball is coming to AI
        mockBall.velocity.z = 5 * mockPlayer.side; // Moving towards AI
        mockPlayer.canInitiateSwing.mockReturnValue(true); // AI must be in a state where it can swing
        vi.spyOn(mockPlayer, 'getPredictedSwing').mockReturnValue({ swingType: 'Fdrive', spinCategory: 1 });

        // AIController needs to see a status change to trigger prediction.
        const aiInstance = aiController as any;
        aiInstance.prevBallStatus = BallStatus.IN_PLAY_TO_AI;

        // Mock the prediction to return a specific point
        aiInstance.getBallTop = vi.fn().mockReturnValue({
            maxHeight: 1.0,
            position: new THREE.Vector2(0.5, -3.0),
        });

        aiController.update(0.016, mockGame);

        // After update, predictedHitPosition should be updated
        expect(aiInstance.predictedHitPosition.x).toBe(0.5);
        expect(aiInstance.predictedHitPosition.y).toBe(-3.0);

        // AI should start moving towards that position
        const playerVel = mockPlayer.velocity;
        expect(playerVel.x).toBeGreaterThan(0);
        expect(playerVel.z).toBeLessThan(0);
    });

    // Test Case AI-04: Serve Execution
    it('should perform a serve when it is its turn', () => {
        mockBall.status = BallStatus.WAITING_FOR_SERVE;
        mockGame.getService.mockReturnValue(mockPlayer.side);

        // Place the player at the exact ideal serving position expected by the AI logic
        const aiInstance = aiController as any;
        const homeZ = aiInstance.HOME_POSITION_Y * mockPlayer.side;
        const idealServeX = aiInstance.HOME_POSITION_X - aiInstance.RACKET_OFFSET_X * mockPlayer.side;
        mockPlayer.mesh.position.set(idealServeX, 0, homeZ);
        mockPlayer.velocity.set(0, 0, 0);

        aiController.update(0.016, mockGame);

        expect(mockPlayer.startServe).toHaveBeenCalled();
    });

    // Test Case AI-05: Return Execution
    it.skip('should try to swing when the ball is hittable', () => {
        mockBall.status = BallStatus.RALLY_TO_AI;
        mockPlayer.canInitiateSwing.mockReturnValue(true);
        mockPlayer.velocity.set(0.5, 0, -1); // Give player some initial velocity
        // Ensure getPredictedSwing returns a valid swing type known to stype map.
        const mockSwingParams = { hitStart: 10, hitEnd: 20 };
        vi.spyOn(stype, 'get').mockReturnValue(mockSwingParams as any);
        vi.spyOn(mockPlayer, 'getPredictedSwing').mockReturnValue({ swingType: 'Fdrive', spinCategory: 1 });

        // Mock the future simulation within trySwing to make the ball seem hittable.
        const hittableBall = new Ball() as vi.Mocked<Ball>;
        // Position the ball in the future so it's inside the AI's hitting zone.
        const aiInstance = aiController as any;
        const futurePlayerZ = mockPlayer.mesh.position.z;
        hittableBall.mesh = { position: new THREE.Vector3(0, 0, futurePlayerZ + (aiInstance.HITTING_ZONE_NEAR_BOUNDARY + 0.1) * mockPlayer.side) } as any;

        vi.spyOn(mockBall, 'clone').mockReturnValue(hittableBall);
        vi.spyOn(mockPlayer, 'canHitBall').mockReturnValue(true);

        // Mock the "next frame" simulation to prevent the AI from waiting for a better shot.
        const evenBetterBall = new Ball() as vi.Mocked<Ball>;
        evenBetterBall.mesh = { position: new THREE.Vector3(0, 0, 999) } as any; // Place it far away
        hittableBall.clone = vi.fn().mockReturnValue(evenBetterBall);


        aiController.update(0.016, mockGame);

        expect(mockPlayer.startSwing).toHaveBeenCalled();
    });
});
