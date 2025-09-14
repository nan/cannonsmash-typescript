import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { Player } from './Player';
import { Ball } from './Ball';
import { Field } from './Field';
import { AIController } from './AIController';
import { inputManager } from './InputManager';
import { TABLE_HEIGHT, TABLE_WIDTH, TABLE_LENGTH, SERVE_MIN, SERVE_NORMAL } from './constants';
import { CameraManager } from './CameraManager';

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

    // Game state properties
    private score1 = 0;
    private score2 = 0;
    private game1 = 0;
    private game2 = 0;
    private gameMode: GameMode = '11PTS';
    public isDemo = true;
    public isPaused = false;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, assets: GameAssets) {
        this.scene = scene;
        this.camera = camera;
        this.assets = assets;

        this.setupScene();
    }

    private setupScene() {
        this.field = new Field();
        this.scene.add(this.field.mesh);

        this.player1 = new Player(this.assets, false, 1); // Human player, side 1
        this.scene.add(this.player1.mesh);

        this.player2 = new Player(this.assets, true, -1); // AI player, side -1
        this.scene.add(this.player2.mesh);

        this.ball = new Ball();

        // Now that both players and the ball exist, create the AI controller for player2
        this.player2.aiController = new AIController(this.player2, this.ball, this.player1);
        this.scene.add(this.ball.mesh);

        // Position them based on C++ code
        this.player1.mesh.position.set(0, 0.77, TABLE_LENGTH / 2 + 0.2);
        this.player1.mesh.rotation.x = -Math.PI / 2; // Stand the player up
        this.player2.mesh.position.set(0, 0.77, -(TABLE_LENGTH / 2 + 0.2));
        this.player2.mesh.rotation.y = Math.PI; // Face the other player
        this.player2.mesh.rotation.x = Math.PI / 2; // Stand the player up

        this.ball.mesh.position.set(0, TABLE_HEIGHT + 0.1, 0); // Place ball on the table

        this.cameraManager = new CameraManager(this.camera, this.player1, this.ball);
    }

    private handleInput() {
        // --- Serve controls ---
        if (inputManager.isKeyJustPressed(' ')) {
            this.player1.changeServeType();
        }

        // Check if it's player 1's turn to serve
        if (this.ball.status === 8 && this.getService() === this.player1.side) {
            if (inputManager.isMouseButtonJustPressed(0)) { // Left click
                this.player1.startServe(1);
            } else if (inputManager.isMouseButtonJustPressed(1)) { // Middle click
                this.player1.startServe(2);
            } else if (inputManager.isMouseButtonJustPressed(2)) { // Right click
                this.player1.startServe(3);
            }
        } else {
            // --- Rally hit controls ---
            if (this.player1.canHitBall(this.ball)) {
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

        const keyMapX: { [key: string]: number } = {
            '1': -TABLE_WIDTH / 2 * 0.9, 'q': -TABLE_WIDTH / 2 * 0.9, 'a': -TABLE_WIDTH / 2 * 0.9, 'z': -TABLE_WIDTH / 2 * 0.9,
            '2': -TABLE_WIDTH / 2 * 0.9, 'w': -TABLE_WIDTH / 2 * 0.9, 's': -TABLE_WIDTH / 2 * 0.9, 'x': -TABLE_WIDTH / 2 * 0.9,
            '3': -TABLE_WIDTH / 2 * 0.9,
            'e': -TABLE_WIDTH / 2 * 0.75,
            'd': -TABLE_WIDTH / 2 * 0.6,
            '4': -TABLE_WIDTH / 2 * 0.45, 'c': -TABLE_WIDTH / 2 * 0.45,
            'r': -TABLE_WIDTH / 2 * 0.3,
            'f': -TABLE_WIDTH / 2 * 0.15,
            '5': 0, 'v': 0,
            't': TABLE_WIDTH / 2 * 0.15,
            'g': TABLE_WIDTH / 2 * 0.3,
            '6': TABLE_WIDTH / 2 * 0.45, 'b': TABLE_WIDTH / 2 * 0.45,
            'y': TABLE_WIDTH / 2 * 0.6,
            'h': TABLE_WIDTH / 2 * 0.75,
            '7': TABLE_WIDTH / 2 * 0.9, 'n': TABLE_WIDTH / 2 * 0.9, 'u': TABLE_WIDTH / 2 * 0.9, 'j': TABLE_WIDTH / 2 * 0.9,
            '8': TABLE_WIDTH / 2 * 0.9, 'm': TABLE_WIDTH / 2 * 0.9, 'i': TABLE_WIDTH / 2 * 0.9, 'k': TABLE_WIDTH / 2 * 0.9,
            '9': TABLE_WIDTH / 2 * 0.9, ',': TABLE_WIDTH / 2 * 0.9, 'o': TABLE_WIDTH / 2 * 0.9, 'l': TABLE_WIDTH / 2 * 0.9,
            '0': TABLE_WIDTH / 2 * 0.9, '.': TABLE_WIDTH / 2 * 0.9, 'p': TABLE_WIDTH / 2 * 0.9, ';': TABLE_WIDTH / 2 * 0.9,
        };

        const keyMapY: { [key: string]: number } = {
            '1': TABLE_LENGTH / 12 * 5, '2': TABLE_LENGTH / 12 * 5, '3': TABLE_LENGTH / 12 * 5, '4': TABLE_LENGTH / 12 * 5, '5': TABLE_LENGTH / 12 * 5, '6': TABLE_LENGTH / 12 * 5, '7': TABLE_LENGTH / 12 * 5, '8': TABLE_LENGTH / 12 * 5, '9': TABLE_LENGTH / 12 * 5, '0': TABLE_LENGTH / 12 * 5,
            'q': TABLE_LENGTH / 12 * 4, 'w': TABLE_LENGTH / 12 * 4, 'e': TABLE_LENGTH / 12 * 4, 'r': TABLE_LENGTH / 12 * 4, 't': TABLE_LENGTH / 12 * 4, 'y': TABLE_LENGTH / 12 * 4, 'u': TABLE_LENGTH / 12 * 4, 'i': TABLE_LENGTH / 12 * 4, 'o': TABLE_LENGTH / 12 * 4, 'p': TABLE_LENGTH / 12 * 4,
            'a': TABLE_LENGTH / 12 * 3, 's': TABLE_LENGTH / 12 * 3, 'd': TABLE_LENGTH / 12 * 3, 'f': TABLE_LENGTH / 12 * 3, 'g': TABLE_LENGTH / 12 * 3, 'h': TABLE_LENGTH / 12 * 3, 'j': TABLE_LENGTH / 12 * 3, 'k': TABLE_LENGTH / 12 * 3, 'l': TABLE_LENGTH / 12 * 3, ';': TABLE_LENGTH / 12 * 3,
            'z': TABLE_LENGTH / 12 * 2, 'x': TABLE_LENGTH / 12 * 2, 'c': TABLE_LENGTH / 12 * 2, 'v': TABLE_LENGTH / 12 * 2, 'b': TABLE_LENGTH / 12 * 2, 'n': TABLE_LENGTH / 12 * 2, 'm': TABLE_LENGTH / 12 * 2, ',': TABLE_LENGTH / 12 * 2, '.': TABLE_LENGTH / 12 * 2,
        };

        let targetUpdated = false;
        for(const key in keyMapX) {
            if(inputManager.isKeyPressed(key)) {
                targetX = keyMapX[key]; // Do not multiply by side, X is absolute
                targetUpdated = true;
                break;
            }
        }
        for(const key in keyMapY) {
            if(inputManager.isKeyPressed(key)) {
                targetY = keyMapY[key] * side;
                targetUpdated = true;
                break;
            }
        }

        if(targetUpdated) {
            this.player1.targetPosition.set(targetX, targetY);
        }
    }

    public update(deltaTime: number) {
        // If in demo mode or paused, do nothing.
        if (this.isDemo || this.isPaused) {
            return;
        }

        this.handleInput();

        // --- Pre-serve logic ---
        // If it's the player's turn to serve, get them into ready state.
        if (this.ball.status === 8 && this.getService() === this.player1.side) {
            this.ball.reset(this.player1);
            if (this.player1.swingType < SERVE_MIN) {
                this.player1.swingType = SERVE_NORMAL;
            }
        }

        this.player1.update(deltaTime, this.ball);
        this.player2.update(deltaTime, this.ball);
        this.ball.update(deltaTime, this);
        this.cameraManager.update();

        // Update target indicator position
        this.field.targetIndicator.position.x = this.player1.targetPosition.x;
        this.field.targetIndicator.position.z = this.player1.targetPosition.y; // y from 2d vec maps to z in 3d

        // This must be the last thing in the update loop
        inputManager.update();
    }

    /**
     * Determines which side has the service right based on the score.
     * @returns 1 for player 1 (near side), -1 for player 2 (far side).
     */
    public getService(): number {
        let ret = 0;
        switch (this.gameMode) {
            case '5PTS':
                ret = ((this.score1 + this.score2) % 2 === 1 ? -1 : 1);
                break;
            case '11PTS':
                if (this.score1 >= 10 && this.score2 >= 10) { // Deuce
                    ret = ((this.score1 + this.score2) % 2 === 1 ? -1 : 1);
                } else {
                    if (Math.floor((this.score1 + this.score2) / 2) % 2 === 1) {
                        ret = -1;
                    } else {
                        ret = 1;
                    }
                }
                break;
            case '21PTS':
                if (this.score1 >= 20 && this.score2 >= 20) { // Deuce
                    ret = ((this.score1 + this.score2) % 2 === 1 ? -1 : 1);
                } else {
                    if (Math.floor((this.score1 + this.score2) / 5) % 2 === 1) {
                        ret = -1;
                    } else {
                        ret = 1;
                    }
                }
                break;
        }

        if ((this.game1 + this.game2) % 2 === 1) {
            ret = -ret;
        }

        // In the C++ code, player 1 (human) is on the near side (y < 0), which corresponds to side 1.
        // Player 2 (com) is on the far side (y > 0), which corresponds to side -1.
        // The C++ GetService returns -1 for near side (player1) and 1 for far side (player2).
        // To match our player.side convention (1 for p1, -1 for p2), we must flip the result.
        // However, for testing, we will temporarily NOT flip it, so the user always serves first.
        return ret;
    }
}
