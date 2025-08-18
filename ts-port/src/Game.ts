import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { Player } from './Player';
import { Ball } from './Ball';
import { inputManager } from './InputManager';

export class Game {
    private scene: THREE.Scene;
    private assets: GameAssets;
    private player1!: Player;
    private ball!: Ball;

    constructor(scene: THREE.Scene, assets: GameAssets) {
        this.scene = scene;
        this.assets = assets;

        console.log("Game class instantiated");
        this.setupScene();
    }

    private setupScene() {
        console.log("Setting up game scene...");

        this.player1 = new Player(this.assets);
        this.scene.add(this.player1.mesh);

        this.ball = new Ball();
        this.scene.add(this.ball.mesh);

        // Position them for now
        this.player1.mesh.position.set(0, 0, 0.5);
        this.ball.mesh.position.set(0, 0.5, 1);
    }

    private handleInput() {
        if (inputManager.isKeyPressed('j')) {
            this.player1.setState('SWING_DRIVE');
        }
        if (inputManager.isKeyPressed('k')) {
            this.player1.setState('SWING_CUT');
        }
    }

    public update(deltaTime: number) {
        this.handleInput();

        this.player1.update(deltaTime);
        this.ball.update(deltaTime);
    }
}
