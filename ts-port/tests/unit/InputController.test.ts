// ts-port/tests/unit/InputController.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputController, IGameInputContext } from '../../src/InputController';
import { inputManager } from '../../src/InputManager';
import { Player } from '../../src/Player';
import { Ball, BallStatus } from '../../src/Ball';
import { TABLE_LENGTH, TABLE_WIDTH } from '../../src/constants';

// Mock the global inputManager
vi.mock('../../src/InputManager', () => ({
    inputManager: {
        isKeyJustPressed: vi.fn(),
        isKeyPressed: vi.fn(),
        isMouseButtonJustPressed: vi.fn(),
    },
}));

describe('InputController', () => {
    let mockContext: IGameInputContext;
    let mockPlayer: Player;
    let mockBall: Ball;
    let inputController: InputController;

    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();

        // Mock the player and ball objects
        mockPlayer = {
            side: 1,
            isInBackswing: false,
            changeServeType: vi.fn(),
            startServe: vi.fn(),
            startForwardswing: vi.fn(),
            targetPosition: { set: vi.fn() },
        } as unknown as Player;

        mockBall = {
            status: BallStatus.WAITING_FOR_SERVE,
        } as Ball;

        // Mock the game context
        mockContext = {
            player1: mockPlayer,
            ball: mockBall,
            getService: () => 1, // Player 1 is serving
        };

        inputController = new InputController(mockContext);
    });

    it('should call changeServeType when spacebar is pressed', () => {
        vi.mocked(inputManager.isKeyJustPressed).mockImplementation(key => key === ' ');
        inputController.handleInput();
        expect(mockPlayer.changeServeType).toHaveBeenCalled();
    });

    it('should start a serve on left mouse click when waiting for serve', () => {
        vi.mocked(inputManager.isMouseButtonJustPressed).mockImplementation(button => button === 0);
        inputController.handleInput();
        expect(mockPlayer.startServe).toHaveBeenCalledWith(1);
    });

    it('should start a forward swing on mouse click if in backswing', () => {
        mockPlayer.isInBackswing = true;
        mockBall.status = BallStatus.RALLY_TO_HUMAN; // Not waiting for serve
        vi.mocked(inputManager.isMouseButtonJustPressed).mockImplementation(button => button === 0);

        inputController.handleInput();

        expect(mockPlayer.startForwardswing).toHaveBeenCalled();
        expect(mockPlayer.startServe).not.toHaveBeenCalled();
    });

    it('should not start a serve if not the serving player', () => {
        mockContext.getService = () => -1; // Opponent is serving
        vi.mocked(inputManager.isMouseButtonJustPressed).mockImplementation(button => button === 0);

        inputController.handleInput();

        expect(mockPlayer.startServe).not.toHaveBeenCalled();
    });

    it('should update target position when a targeting key is pressed', () => {
        const key = 'w';
        const expectedX = -TABLE_WIDTH / 2 * 0.9;
        const expectedY = -TABLE_LENGTH / 12 * 4; // side is -1 for opponent

        vi.mocked(inputManager.isKeyPressed).mockImplementation(k => k === key);

        inputController.handleInput();

        expect(mockPlayer.targetPosition.set).toHaveBeenCalledWith(expectedX, expectedY);
    });
});
