import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoMode } from '../../../src/modes/DemoMode';
import type { Game } from '../../../src/Game';
import type { Ball } from '../../../src/Ball';
import type { Player } from '../../../src/Player';
import * as THREE from 'three';
import { TABLE_HEIGHT } from '../../../src/constants';

describe('DemoMode', () => {
    let demoMode: DemoMode;
    let mockGame: Game;
    let mockBall: Ball;
    let mockPlayer1: Player;
    let mockPlayer2: Player;
    let mockCamera: THREE.PerspectiveCamera;

    beforeEach(() => {
        demoMode = new DemoMode();

        // Mock the necessary properties and methods of the Game object
        mockCamera = {
            position: new THREE.Vector3(),
            lookAt: vi.fn(),
        } as unknown as THREE.PerspectiveCamera;

        mockBall = {
            status: 0,
            reset: vi.fn(),
        } as unknown as Ball;

        mockPlayer1 = {} as Player;
        mockPlayer2 = {} as Player;

        mockGame = {
            camera: mockCamera,
            ball: mockBall,
            getService: vi.fn().mockReturnValue(1),
            player1: mockPlayer1,
            player2: mockPlayer2,
        } as unknown as Game;
    });

    it('should update the camera position in a circle', () => {
        const initialPosition = mockGame.camera.position.clone();

        demoMode.update(0.1, mockGame);

        // Expect that the position has changed from the initial (0,0,0)
        expect(mockGame.camera.position.equals(initialPosition)).toBe(false);
        // Expect the Y position to be set to a fixed height
        expect(mockGame.camera.position.y).not.toBe(0);
    });

    it('should make the camera look at the table center', () => {
        demoMode.update(0.1, mockGame);
        expect(mockCamera.lookAt).toHaveBeenCalledWith(0, TABLE_HEIGHT, 0);
    });

    it('should reset the ball if its status is negative', () => {
        mockGame.ball.status = -1; // Ball is dead
        vi.mocked(mockGame.getService).mockReturnValue(1);

        demoMode.update(0.1, mockGame);

        expect(mockGame.ball.reset).toHaveBeenCalledOnce();
        expect(mockGame.ball.reset).toHaveBeenCalledWith(mockGame.player1);
    });

    it('should reset the ball for player 2 if getService returns -1', () => {
        mockGame.ball.status = -1; // Ball is dead
        vi.mocked(mockGame.getService).mockReturnValue(-1);

        demoMode.update(0.1, mockGame);

        expect(mockGame.ball.reset).toHaveBeenCalledOnce();
        expect(mockGame.ball.reset).toHaveBeenCalledWith(mockGame.player2);
    });

    it('should not reset the ball if its status is not negative', () => {
        mockGame.ball.status = 0; // Ball is stopped
        demoMode.update(0.1, mockGame);
        expect(mockGame.ball.reset).not.toHaveBeenCalled();

        mockGame.ball.status = 1; // Ball is in play
        demoMode.update(0.1, mockGame);
        expect(mockGame.ball.reset).not.toHaveBeenCalled();
    });
});
