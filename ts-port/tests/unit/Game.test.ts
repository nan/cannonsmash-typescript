// ts-port/tests/unit/Game.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

// Hoist mocks to the top of the file, before any imports
vi.mock('../../src/Player');
vi.mock('../../src/Ball');
vi.mock('../../src/Field');
vi.mock('../../src/modes/DemoMode');
vi.mock('../../src/modes/PlayMode');
vi.mock('../../src/ScoreManager');
vi.mock('../../src/InputController');
vi.mock('../../src/CameraManager');
vi.mock('../../src/TrajectoryVisualizer');


// Now that modules are mocked, we can import them.
// Vitest will provide us with the mocked versions.
import { Game } from '../../src/Game';
import { Player } from '../../src/Player';
import { Ball } from '../../src/Ball';
import { Field } from '../../src/Field';
import { DemoMode } from '../../src/modes/DemoMode';
import { PlayMode } from '../../src/modes/PlayMode';
import { ScoreManager } from '../../src/ScoreManager';
import { InputController } from '../../src/InputController';
import { CameraManager } from '../../src/CameraManager';


describe('Game', () => {
    let mockScene: THREE.Scene;
    let mockCamera: THREE.PerspectiveCamera;
    let mockAssets: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockScene = { add: vi.fn(), remove: vi.fn() } as unknown as THREE.Scene;
        mockCamera = {} as THREE.PerspectiveCamera;
        mockAssets = { playerModel: {} };

        // For each mocked class, provide a mock constructor implementation.
        // This function will be executed when `new ClassName()` is called.
        vi.mocked(Player).mockImplementation(function (assets, isAi, side) {
            this.mesh = { position: new THREE.Vector3(), rotation: { y: 0 } };
            this.isAi = isAi;
            this.side = side;
            this.resetStatus = vi.fn();
            this.update = vi.fn();
            this.setState = vi.fn();
            this.canInitiateSwing = vi.fn().mockReturnValue(false);
            return this;
        });

        vi.mocked(Ball).mockImplementation(function () {
            this.mesh = { position: new THREE.Vector3() };
            this.update = vi.fn();
            this.status = 0;
            this.velocity = new THREE.Vector3();
            return this;
        });

        vi.mocked(Field).mockImplementation(function () {
            this.mesh = {};
            return this;
        });

        vi.mocked(ScoreManager).mockImplementation(function () {
            this.reset = vi.fn();
            this.awardPoint = vi.fn();
            this.isGameOver = false;
            return this;
        });

        vi.mocked(InputController).mockImplementation(function () {
            this.handleInput = vi.fn();
            return this;
        });

        vi.mocked(DemoMode).mockImplementation(function () {
            this.update = vi.fn();
            return this;
        });

        vi.mocked(PlayMode).mockImplementation(function () {
            this.update = vi.fn();
            return this;
        });

        vi.mocked(CameraManager).mockImplementation(function () {
            return this;
        });
    });

    it('should initialize in demo mode correctly', () => {
        const game = new Game(mockScene, mockCamera, mockAssets);
        expect(game).toBeInstanceOf(Game);
        expect(DemoMode).toHaveBeenCalled();
        expect(mockScene.add).toHaveBeenCalledTimes(4);
        expect(Player).toHaveBeenCalledTimes(2);
        expect(Player).toHaveBeenCalledWith(mockAssets, true, 1);
        expect(Player).toHaveBeenCalledWith(mockAssets, true, -1);
        expect(game.isDemo()).toBe(true);
        expect(game.getIsPaused()).toBe(false);
    });

    it('should switch to play mode when start() is called', () => {
        const game = new Game(mockScene, mockCamera, mockAssets);
        game.start();

        expect(PlayMode).toHaveBeenCalled();
        expect(game.isDemo()).toBe(false);
        const lastPlayerCalls = vi.mocked(Player).mock.calls.slice(-2);
        expect(lastPlayerCalls[0][1]).toBe(false); // player1.isAi
        expect(lastPlayerCalls[1][1]).toBe(true);  // player2.isAi
    });

    it('should pause and resume the game', () => {
        const game = new Game(mockScene, mockCamera, mockAssets);
        game.pause();
        expect(game.getIsPaused()).toBe(true);
        game.resume();
        expect(game.getIsPaused()).toBe(false);
    });

    it('should return to demo mode', () => {
        const game = new Game(mockScene, mockCamera, mockAssets);
        game.start();
        game.returnToDemo();

        expect(DemoMode).toHaveBeenCalledTimes(2);
        expect(game.isDemo()).toBe(true);
        const lastPlayerCalls = vi.mocked(Player).mock.calls.slice(-2);
        expect(lastPlayerCalls[0][1]).toBe(true);
        expect(lastPlayerCalls[1][1]).toBe(true);
    });

    it('should call update on children during the main update loop', () => {
        const game = new Game(mockScene, mockCamera, mockAssets);
        const deltaTime = 0.016;
        const demoModeInstance = vi.mocked(DemoMode).mock.instances[0];

        game.update(deltaTime);

        expect(game.player1.update).toHaveBeenCalledWith(deltaTime, game.ball, game);
        expect(game.player2.update).toHaveBeenCalledWith(deltaTime, game.ball, game);
        expect(game.ball.update).toHaveBeenCalledWith(deltaTime, game);
        expect(demoModeInstance.update).toHaveBeenCalledWith(deltaTime, game);
    });

    it('should not call update when the game is paused', () => {
        const game = new Game(mockScene, mockCamera, mockAssets);
        game.pause();
        game.update(0.016);

        expect(game.player1.update).not.toHaveBeenCalled();
        expect(game.ball.update).not.toHaveBeenCalled();
    });

    it('should award a point when the ball becomes dead', () => {
        const game = new Game(mockScene, mockCamera, mockAssets);
        const scoreManagerInstance = vi.mocked(ScoreManager).mock.instances[0];

        // Simulate ball being in play then going dead
        game.ball.status = 1;
        game.update(0.016); // prevBallStatus becomes 1
        game.ball.status = -1;
        game.update(0.016);

        expect(scoreManagerInstance.awardPoint).toHaveBeenCalledWith(1);
        expect(game.player1.setState).toHaveBeenCalledWith('IDLE');
        expect(game.player2.setState).toHaveBeenCalledWith('IDLE');
    });

    it('should delegate input handling to InputController in play mode', () => {
        const game = new Game(mockScene, mockCamera, mockAssets);
        game.start();
        const inputControllerInstance = vi.mocked(InputController).mock.instances[0];

        game.update(0.016);
        expect(inputControllerInstance.handleInput).toHaveBeenCalled();
    });
});
