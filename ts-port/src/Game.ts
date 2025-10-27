import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { Player } from './Player';
import { SERVE_MIN, SERVE_NORMAL } from './SwingTypes';
import { Ball } from './Ball';
import { Field } from './Field';
import { AIController } from './AIController';
import { inputManager } from './InputManager';
import { TABLE_HEIGHT, TABLE_WIDTH, TABLE_LENGTH } from './constants';
import { CameraManager } from './CameraManager';
import { TrajectoryVisualizer } from './TrajectoryVisualizer';
import { UIManager } from './UIManager';
import { BallStatus } from './Ball';
import { DemoMode } from './modes/DemoMode';
import { PlayMode } from './modes/PlayMode';
import { ScoreManager, type IGameScoringContext } from './ScoreManager';
import { InputController, type IGameInputContext } from './InputController';

// --- Game Setup Constants ---
const PLAYER_INITIAL_Y = 0.77;
const PLAYER_Z_OFFSET = 0.2;
const BALL_INITIAL_Y_OFFSET = 0.1;


/**
 * Defines the contract for all game modes.
 * Each game mode must provide its own logic for the main game loop.
 */
export interface IGameMode {
    /**
     * Updates the game state for the current mode.
     * @param deltaTime The time elapsed since the last frame.
     * @param game The main game instance, providing context and access to game objects.
     */
    update(deltaTime: number, game: Game): void;
}

type GameMode = '5PTS' | '11PTS' | '21PTS';

export class Game implements IGameScoringContext, IGameInputContext {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    private assets: GameAssets;
    public player1!: Player;
    public player2!: Player;
    public ball!: Ball;
    public field!: Field;
    public cameraManager!: CameraManager;
    public trajectoryVisualizer!: TrajectoryVisualizer;
    private scoreManager!: ScoreManager;
    private inputController!: InputController;
    private prevBallStatus = 0;

    // Game state properties
    private currentMode!: IGameMode;
    private isPaused = false;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, assets: GameAssets) {
        this.scene = scene;
        this.camera = camera;
        this.assets = assets;
        this.trajectoryVisualizer = new TrajectoryVisualizer(this.scene);
        this.scoreManager = new ScoreManager(this);
        this.inputController = new InputController(this);
        this.resetGame(true); // Start in demo mode
    }


    private resetGame(isDemo: boolean) {
        this.currentMode = isDemo ? new DemoMode() : new PlayMode();
        this.isPaused = false;
        this.scoreManager.reset();

        // Clear previous game objects from the scene
        if (this.player1) this.scene.remove(this.player1.mesh);
        if (this.player2) this.scene.remove(this.player2.mesh);
        if (this.ball) this.scene.remove(this.ball.mesh);
        if (this.field) this.scene.remove(this.field.mesh);
        this.trajectoryVisualizer.hide();

        // Create new game objects
        this.field = new Field();
        this.scene.add(this.field.mesh);

        this.player1 = new Player(this.assets, isDemo, 1);
        this.scene.add(this.player1.mesh);

        this.player2 = new Player(this.assets, true, -1); // Player2 is always AI
        this.scene.add(this.player2.mesh);

        this.ball = new Ball();
        this.scene.add(this.ball.mesh);

        // Create AI controllers where needed
        if (this.player1.isAi) {
            this.player1.aiController = new AIController(this, this.player1, this.ball, this.player2);
        }
        this.player2.aiController = new AIController(this, this.player2, this.ball, this.player1);

        // Position them
        this.player1.mesh.position.set(0, PLAYER_INITIAL_Y, TABLE_LENGTH / 2 + PLAYER_Z_OFFSET);
        this.player2.mesh.position.set(0, PLAYER_INITIAL_Y, -(TABLE_LENGTH / 2 + PLAYER_Z_OFFSET));
        // The Player class now handles its own internal rotation.
        // The AI player's direction is handled by its model's orientation within the Player class.
        this.player1.mesh.rotation.y = Math.PI;
        this.player2.mesh.rotation.y = 0;

        // Ensure status is reset at the start of a new game for a clean slate.
        this.player1.resetStatus();
        this.player2.resetStatus();

        this.ball.mesh.position.set(0, TABLE_HEIGHT + BALL_INITIAL_Y_OFFSET, 0);

        this.cameraManager = new CameraManager(this.camera, this.player1, this.ball);
    }

    public handleInput() {
        if (this.currentMode instanceof PlayMode) {
            this.inputController.handleInput();
        }
    }

    // This is required by IGameInputContext, forwarded to ScoreManager
    public getService(): number {
        return this.scoreManager.getService();
    }

    public update(deltaTime: number) {
        if (this.isPaused || this.scoreManager.isGameOver) {
            return;
        }

        this.handleInput();

        // --- Automatic Backswing Logic ---
        const backswingThreshold = 3.0; // Distance from player to ball to trigger backswing
        const ballPos = this.ball.mesh.position;
        const playerPos = this.player1.mesh.position;
        const distanceToBall = ballPos.distanceTo(playerPos);

        if (
            this.player1.state === 'IDLE' &&
            this.player1.canInitiateSwing(this.ball) &&
            distanceToBall < backswingThreshold &&
            this.ball.velocity.z > 0 // Ball is moving towards the player
        ) {
            // Determine swing type and spin category automatically for the backswing
            const predictedSwing = this.player1.getPredictedSwing(this.ball);
            this.player1.startBackswing(this.ball, predictedSwing.spinCategory);
        }


        // The core game logic update (common to all modes)
        this.player1.update(deltaTime, this.ball, this);
        this.player2.update(deltaTime, this.ball, this);
        this.ball.update(deltaTime, this);

        // --- Scoring Logic (common to all modes) ---
        if (this.prevBallStatus >= 0 && this.ball.status < 0) {
            this.scoreManager.awardPoint(this.prevBallStatus);
        }

        // Delegate mode-specific logic to the current state object
        this.currentMode.update(deltaTime, this);

        // This must be the last thing in the update loop
        this.prevBallStatus = this.ball.status;
    }

    // --- State Management ---

    public getIsPaused(): boolean {
        return this.isPaused;
    }

    public isDemo(): boolean {
        return this.currentMode instanceof DemoMode;
    }

    public start(): void {
        this.resetGame(false);
    }

    public pause(): void {
        this.isPaused = true;
    }

    public resume(): void {
        this.isPaused = false;
    }

    public returnToDemo(): void {
        this.resetGame(true);
    }

}
