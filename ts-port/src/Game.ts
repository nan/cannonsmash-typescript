import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { Player } from './Player';
import { Ball } from './Ball';
import { Field } from './Field';
import { inputManager } from './InputManager';
import { TABLE_HEIGHT, TABLE_WIDTH, TABLE_LENGTH } from './constants';
import { CameraManager } from './CameraManager';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private assets: GameAssets;
    private player1!: Player;
    private ball!: Ball;
    private field!: Field;
    private cameraManager!: CameraManager;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, assets: GameAssets) {
        this.scene = scene;
        this.camera = camera;
        this.assets = assets;

        console.log("Game class instantiated");
        this.setupScene();
    }

    private setupScene() {
        console.log("Setting up game scene...");

        this.field = new Field();
        this.scene.add(this.field.mesh);

        this.player1 = new Player(this.assets);
        this.scene.add(this.player1.mesh);

        this.ball = new Ball();
        this.scene.add(this.ball.mesh);

        // Position them for now
        this.player1.mesh.position.set(0, 0, 1.5); // Adjusted position to be behind the table
        this.ball.mesh.position.set(0, TABLE_HEIGHT + 0.1, 0); // Place ball on the table

        this.cameraManager = new CameraManager(this.camera, this.player1, this.ball);
    }

    private handleInput() {
        // Swing controls (temporary)
        if (inputManager.isMouseButtonDown(0)) { // Left click
            this.player1.setState('SWING_DRIVE');
        }
        if (inputManager.isMouseButtonDown(2)) { // Right click
            this.player1.setState('SWING_CUT');
        }

        // Target controls from HumanController.cpp
        const side = 1; // Assuming player 1 side
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
                targetX = keyMapX[key] * side;
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
            // console.log(`Target updated: ${this.player1.targetPosition.x}, ${this.player1.targetPosition.y}`);
        }
    }

    public update(deltaTime: number) {
        this.handleInput();

        this.player1.update(deltaTime);
        this.ball.update(deltaTime);
        this.cameraManager.update();

        // Update target indicator position
        this.field.targetIndicator.position.x = this.player1.targetPosition.x;
        this.field.targetIndicator.position.z = this.player1.targetPosition.y; // y from 2d vec maps to z in 3d
    }
}
