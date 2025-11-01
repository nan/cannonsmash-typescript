import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayMode } from '../../../src/modes/PlayMode';
import { inputManager } from '../../../src/InputManager';
import { BallStatus } from '../../../src/Ball';
import { SERVE_MIN, SERVE_NORMAL } from '../../../src/SwingTypes';
import type { Game } from '../../../src/Game';

// Mock the inputManager singleton
vi.mock('../../../src/InputManager', () => ({
    inputManager: {
        update: vi.fn(),
    },
}));

describe('PlayMode', () => {
    let playMode: PlayMode;
    let mockGame: any; // Using 'any' for easier mocking of the complex Game object

    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();

        playMode = new PlayMode();

        // Create a detailed mock of the Game object and its nested properties
        mockGame = {
            getService: vi.fn(),
            player1: {
                side: 1,
                swingType: SERVE_NORMAL,
                targetPosition: { x: 0.5, y: -0.5 },
            },
            player2: {
                side: -1,
            },
            ball: {
                status: BallStatus.STOP,
                justHitBySide: 0,
                reset: vi.fn(),
            },
            cameraManager: {
                update: vi.fn(),
            },
            field: {
                targetIndicator: {
                    position: { x: 0, z: 0 },
                },
            },
            trajectoryVisualizer: {
                show: vi.fn(),
                hide: vi.fn(),
            },
        };
    });

    describe('Pre-serve Logic', () => {
        it('should reset the ball to player 1 if they are serving', () => {
            mockGame.ball.status = BallStatus.WAITING_FOR_SERVE;
            mockGame.getService.mockReturnValue(1);

            playMode.update(0.016, mockGame as Game);

            expect(mockGame.ball.reset).toHaveBeenCalledWith(mockGame.player1);
        });

        it('should reset the ball to player 2 if they are serving', () => {
            mockGame.ball.status = BallStatus.WAITING_FOR_SERVE;
            mockGame.getService.mockReturnValue(-1);

            playMode.update(0.016, mockGame as Game);

            expect(mockGame.ball.reset).toHaveBeenCalledWith(mockGame.player2);
        });

        it('should set a default serve type for the human player if they are serving without one', () => {
            mockGame.ball.status = BallStatus.WAITING_FOR_SERVE;
            mockGame.getService.mockReturnValue(1); // Player 1 is serving
            mockGame.player1.swingType = 0; // Invalid serve type

            playMode.update(0.016, mockGame as Game);

            expect(mockGame.player1.swingType).toBe(SERVE_NORMAL);
        });

        it('should not reset the ball if not waiting for serve', () => {
            mockGame.ball.status = BallStatus.RALLY_TO_PLAYER;
            playMode.update(0.016, mockGame as Game);
            expect(mockGame.ball.reset).not.toHaveBeenCalled();
        });
    });

    it('should update the camera manager', () => {
        playMode.update(0.016, mockGame as Game);
        expect(mockGame.cameraManager.update).toHaveBeenCalledOnce();
    });

    it('should update the target indicator position', () => {
        const targetX = 1.2;
        const targetZ = -0.8; // Note: player targetPosition.y maps to 3D Z
        mockGame.player1.targetPosition = { x: targetX, y: targetZ };

        playMode.update(0.016, mockGame as Game);

        expect(mockGame.field.targetIndicator.position.x).toBe(targetX);
        expect(mockGame.field.targetIndicator.position.z).toBe(targetZ);
    });

    describe('Trajectory Visualizer Logic', () => {
        it('should show visualizer when AI just hit the ball', () => {
            mockGame.ball.justHitBySide = -1; // AI hit
            playMode.update(0.016, mockGame as Game);
            expect(mockGame.trajectoryVisualizer.show).toHaveBeenCalledWith(mockGame.ball, mockGame.player1);
            expect(mockGame.ball.justHitBySide).toBe(0); // Event should be consumed
        });

        it('should hide visualizer when player just hit the ball', () => {
            mockGame.ball.justHitBySide = 1; // Player hit
            playMode.update(0.016, mockGame as Game);
            expect(mockGame.trajectoryVisualizer.hide).toHaveBeenCalledOnce();
            expect(mockGame.ball.justHitBySide).toBe(0); // Event should be consumed
        });

        it('should hide visualizer when the rally ends', () => {
            // Use a direct negative number to ensure the condition `status < 0` is met,
            // avoiding potential issues with enum resolution in the test environment.
            mockGame.ball.status = -1; // Point scored
            playMode.update(0.016, mockGame as Game);
            expect(mockGame.trajectoryVisualizer.hide).toHaveBeenCalledOnce();
        });
    });

    it('should update the input manager', () => {
        playMode.update(0.016, mockGame as Game);
        expect(inputManager.update).toHaveBeenCalledOnce();
    });
});
