import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { Player } from './Player';
import { Ball } from './Ball';
import { Field } from './Field';
import { AIController } from './AIController';
import { inputManager } from './InputManager';
import { TABLE_HEIGHT, TABLE_WIDTH, TABLE_LENGTH, SERVE_MIN, SERVE_NORMAL, DEMO_CAMERA_SPEED, DEMO_CAMERA_RADIUS, DEMO_CAMERA_HEIGHT, KEY_MAP_X, KEY_MAP_Y } from './constants';
import { CameraManager } from './CameraManager';
import { TrajectoryVisualizer } from './TrajectoryVisualizer';
import { UIManager } from './UIManager';
import { BallStatus } from './BallStatus';

type GameMode = '5PTS' | '11PTS' | '21PTS';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private assets: GameAssets;
    public player1!: Player;
    public player2!: Player;
    private ball!: Ball;
    private field!: Field;
    private cameraManager!: CameraManager;
    private trajectoryVisualizer!: TrajectoryVisualizer;
    private scoreboardElement: HTMLElement;
    private prevBallStatus = 0;

    // Game state properties
    private score1 = 0;
    private score2 = 0;
    private game1 = 0;
    private game2 = 0;
    private gameMode: GameMode = '11PTS';
    private isDemo = true;
    private isPaused = false;
    private isGameOver = false;
    private demoCameraAngle = 0;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, assets: GameAssets) {
        this.scene = scene;
        this.camera = camera;
        this.assets = assets;
        this.scoreboardElement = document.getElementById('scoreboard')!;
        this.trajectoryVisualizer = new TrajectoryVisualizer(this.scene);
        this.resetGame(true); // Start in demo mode
    }

    private updateScoreboard() {
        this.scoreboardElement.innerText = `${this.score1} - ${this.score2}`;
    }

    private pointWonBy(playerSide: number) {
        if (playerSide === 1) {
            this.score1++;
        } else {
            this.score2++;
        }
        this.updateScoreboard();

        // Check for game over
        const p1Score = this.score1;
        const p2Score = this.score2;
        const gameOver = (p1Score >= 11 || p2Score >= 11) && Math.abs(p1Score - p2Score) >= 2;

        if (gameOver) {
            this.endGame(p1Score > p2Score);
        } else {
            // Reset player statuses to full at the end of each point.
            // This ensures that any fatigue/error penalty from the previous rally is cleared.
            this.player1.resetStatus();
            this.player2.resetStatus();
        }
    }

    private endGame(player1Won: boolean) {
        if (this.isGameOver) return;
        this.isGameOver = true;

        document.exitPointerLock();
        this.scoreboardElement.innerText = player1Won ? 'You Win!' : 'You Lose!';

        // Return to demo after a delay
        setTimeout(() => {
            this.returnToDemo();
            // Dispatch an event to notify UI to return to demo screen
            document.dispatchEvent(new CustomEvent('gameended'));
        }, 4000);
    }

    private awardPoint() {
        // This logic is ported directly from the original C++ source
        // It determines the winner of a point based on the ball's status before it went "dead".
        switch (this.prevBallStatus) {
            // Player 1 (Human) hit the ball, and it went out of bounds or into the net without bouncing correctly.
            case BallStatus.IN_PLAY_TO_AI:      // Human's rally shot failed.
            case BallStatus.SERVE_TO_AI:        // Human's serve failed.
            case BallStatus.TOSS_P1:            // Human's serve toss failed.
            // Player 1 (Human) was supposed to hit the ball, but missed.
            case BallStatus.RALLY_TO_HUMAN:     // AI's rally shot was good, Human missed the return.
            case BallStatus.SERVE_TO_HUMAN:     // AI's serve was good, Human missed the return.
                this.pointWonBy(-1); // AI scores
                break;

            default:
                // In all other cases, the AI must have made the error.
                this.pointWonBy(1); // Player scores
                break;
        }
    }

    private resetGame(isDemo: boolean) {
        this.isDemo = isDemo;
        this.isPaused = false;
        this.isGameOver = false;

        // Clear previous game objects from the scene
        if (this.player1) this.scene.remove(this.player1.mesh);
        if (this.player2) this.scene.remove(this.player2.mesh);
        if (this.ball) this.scene.remove(this.ball.mesh);
        if (this.field) this.scene.remove(this.field.mesh);
        this.trajectoryVisualizer.hide();

        // Reset scores
        this.score1 = 0;
        this.score2 = 0;
        this.updateScoreboard();

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
        this.player1.mesh.position.set(0, 0.77, TABLE_LENGTH / 2 + 0.2);
        this.player2.mesh.position.set(0, 0.77, -(TABLE_LENGTH / 2 + 0.2));
        // Rotate players to face each other across the table.
        this.player1.mesh.rotation.y = Math.PI; // Near side player faces away from camera
        this.player2.mesh.rotation.y = 0;      // Far side player faces towards camera

        // Ensure status is reset at the start of a new game for a clean slate.
        this.player1.resetStatus();
        this.player2.resetStatus();

        this.ball.mesh.position.set(0, TABLE_HEIGHT + 0.1, 0);

        this.cameraManager = new CameraManager(this.camera, this.player1, this.ball);
    }

    private handleInput() {
        // --- Serve controls ---
        if (inputManager.isKeyJustPressed(' ')) {
            this.player1.changeServeType();
        }

        console.log(`[handleInput] ball.status: ${this.ball.status}, WAITING_FOR_SERVE: ${BallStatus.WAITING_FOR_SERVE}`);
        console.log(`[handleInput] getService(): ${this.getService()}, player1.side: ${this.player1.side}`);

        // Check if it's player 1's turn to serve
        if (this.ball.status === BallStatus.WAITING_FOR_SERVE && this.getService() === this.player1.side) {
            console.log("[handleInput] Serve condition met.");
            if (inputManager.isMouseButtonJustPressed(0)) { // Left click
                console.log("[handleInput] Left click detected, calling startServe.");
                this.player1.startServe(1);
            } else if (inputManager.isMouseButtonJustPressed(1)) { // Middle click
                this.player1.startServe(2);
            } else if (inputManager.isMouseButtonJustPressed(2)) { // Right click
                this.player1.startServe(3);
            }
        } else {
            // --- Rally hit controls ---
            if (this.player1.canInitiateSwing(this.ball)) {
                if (inputManager.isMouseButtonJustPressed(0)) { // Left click for Forehand
                    this.player1.startSwing(this.ball, 3);
                } else if (inputManager.isMouseButtonJustPressed(2)) { // Right click for Backhand
                    this.player1.startSwing(this.ball, 1);
                }
            }
        }


        // Target controls from HumanController.cpp
        const side = -1; // Use -1 to target the opponent's side (-Z)
        let targetX = this.player1.targetPosition.x;
        let targetY = this.player1.targetPosition.y;

        let targetUpdated = false;
        for(const key in KEY_MAP_X) {
            if(inputManager.isKeyPressed(key)) {
                targetX = KEY_MAP_X[key]; // Do not multiply by side, X is absolute
                targetUpdated = true;
                break;
            }
        }
        for(const key in KEY_MAP_Y) {
            if(inputManager.isKeyPressed(key)) {
                targetY = KEY_MAP_Y[key] * side;
                targetUpdated = true;
                break;
            }
        }

        if(targetUpdated) {
            this.player1.targetPosition.set(targetX, targetY);
        }
    }

    public update(deltaTime: number) {
        if (this.isPaused || this.isGameOver) {
            return;
        }

        // The core game logic update
        this.player1.update(deltaTime, this.ball, this);
        this.player2.update(deltaTime, this.ball, this);
        this.ball.update(deltaTime, this);

        // --- Scoring Logic ---
        if (this.prevBallStatus >= 0 && this.ball.status < 0) {
            this.awardPoint();
            // Stop animations for both players once a point is decided
            this.player1.stopAllAnimations();
            this.player2.stopAllAnimations();
        }

        if (this.isDemo) {
            // --- Demo Mode ---
            // Circling camera logic
            this.demoCameraAngle += deltaTime * DEMO_CAMERA_SPEED;
            const x = Math.sin(this.demoCameraAngle) * DEMO_CAMERA_RADIUS;
            const z = Math.cos(this.demoCameraAngle) * DEMO_CAMERA_RADIUS;
            this.camera.position.set(x, DEMO_CAMERA_HEIGHT, z);
            this.camera.lookAt(0, TABLE_HEIGHT, 0); // Look at table height

            // Reset the ball if it's dead for too long, to keep the demo going
            if (this.ball.status < 0) {
                this.ball.reset(this.getService() === 1 ? this.player1 : this.player2);
            }

        } else {
            // --- Active Play Mode ---
            this.handleInput();

            // Pre-serve logic
            if (this.ball.status === BallStatus.WAITING_FOR_SERVE) {
                const server = this.getService() === this.player1.side ? this.player1 : this.player2;
                this.ball.reset(server);

                // Set both players to their idle animation while waiting.
                this.player1.setIdleAnimation();
                this.player2.setIdleAnimation();

                // This logic only applies to the human player, so keep it separate.
                if (server === this.player1 && this.player1.swingType < SERVE_MIN) {
                    this.player1.swingType = SERVE_NORMAL;
                }
            }

            this.cameraManager.update();

            // Update target indicator position
            this.field.targetIndicator.position.x = this.player1.targetPosition.x;
            this.field.targetIndicator.position.z = this.player1.targetPosition.y; // y from 2d vec maps to z in 3d

            // --- Trajectory Visualizer Logic ---
            if (this.ball.justHitBySide === -1) { // AI just hit the ball
                this.trajectoryVisualizer.show(this.ball, this.player1);
                this.ball.justHitBySide = 0; // Consume the event
            } else if (this.ball.justHitBySide === 1 || this.ball.status < 0) { // Player hit or rally ended
                this.trajectoryVisualizer.hide();
                if (this.ball.justHitBySide === 1) this.ball.justHitBySide = 0; // Consume the event
            }


            inputManager.update();
        }

        // This must be the last thing in the update loop
        this.prevBallStatus = this.ball.status;
    }

    // --- State Management ---

    public getIsDemo(): boolean {
        return this.isDemo;
    }

    public getIsPaused(): boolean {
        return this.isPaused;
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

    /**
     * Determines which player has the service right based on the score and game mode.
     * The logic is ported and adapted from the original C++ source.
     * @returns 1 for player 1 (human), -1 for player 2 (AI).
     */
    public getService(): number {
        let serviceOwner = 0;
        switch (this.gameMode) {
            case '5PTS':
                serviceOwner = this._getService5PTS();
                break;
            case '11PTS':
                serviceOwner = this._getService11PTS();
                break;
            case '21PTS':
                serviceOwner = this._getService21PTS();
                break;
        }

        // In the second or subsequent games, the service order is reversed.
        if ((this.game1 + this.game2) % 2 === 1) {
            serviceOwner = -serviceOwner;
        }

        // The original C++ logic returns -1 for the near side (our Player 1) and 1 for the far side (our Player 2).
        // To match our convention where Player 1's side is 1 and Player 2's is -1, we must flip the final result.
        return -serviceOwner;
    }

    private _getService11PTS(): number {
        const totalScore = this.score1 + this.score2;
        // Deuce condition: score is 10-10 or higher.
        if (this.score1 >= 10 && this.score2 >= 10) {
            // In deuce, serve alternates every point.
            // If total score is odd (e.g., 10-11 -> 21), P2 serves.
            return (totalScore % 2 === 1 ? -1 : 1);
        } else {
            // Before deuce, serve alternates every 2 points.
            // Integer division by 2 groups scores into pairs (0-1, 2-3, 4-5, etc.).
            // The server for each pair is determined by whether the pair index is even or odd.
            // The logic is inverted from the C++ to make Player 1 serve first.
            return (Math.floor(totalScore / 2) % 2 === 0) ? -1 : 1;
        }
    }

    private _getService21PTS(): number {
        const totalScore = this.score1 + this.score2;
        // Deuce condition: score is 20-20 or higher.
        if (this.score1 >= 20 && this.score2 >= 20) {
            // In deuce, serve alternates every point.
            return (totalScore % 2 === 1 ? -1 : 1);
        } else {
            // Before deuce, serve alternates every 5 points.
            return (Math.floor(totalScore / 5) % 2 === 0) ? -1 : 1;
        }
    }

    private _getService5PTS(): number {
        // In a 5-point game, serve alternates every point.
        const totalScore = this.score1 + this.score2;
        return (totalScore % 2 === 0 ? -1 : 1);
    }

}
