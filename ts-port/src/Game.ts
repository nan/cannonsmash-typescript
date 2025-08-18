import * as THREE from 'three';
import type { GameAssets } from './AssetManager';
import { Player, PlayerState } from './Player';
import { Ball } from './Ball';
import { inputManager } from './InputManager';

export class Game {
    private scene: THREE.Scene;
    private assets: GameAssets;
    private player1: Player;
    private ball: Ball;

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

        // --- Programmatic Debugging ---
        this.player1.mesh.updateWorldMatrix(true, true); // Ensure world matrices are up-to-date

        const head = this.player1.bodyParts['head'];
        const leftFoot = this.player1.bodyParts['Lfoot'];
        const headPos = new THREE.Vector3();
        const footPos = new THREE.Vector3();
        if (head) head.getWorldPosition(headPos);
        if (leftFoot) leftFoot.getWorldPosition(footPos);

        const boundingBox = new THREE.Box3().setFromObject(this.player1.mesh);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        console.log("--- Player Model State (After Loader Fix) ---");
        console.log("Head world position:", headPos);
        console.log("Left Foot world position:", footPos);
        console.log("Player bounding box size:", size);
        console.log("--------------------------");
    }

    private handleInput() {
        if (inputManager.isKeyPressed('j')) {
            this.player1.setState(PlayerState.SWING_DRIVE);
        }
        if (inputManager.isKeyPressed('k')) {
            this.player1.setState(PlayerState.SWING_CUT);
        }
    }

    public update(deltaTime: number) {
        this.handleInput();

        this.player1.update(deltaTime);
        this.ball.update(deltaTime);
    }
}
