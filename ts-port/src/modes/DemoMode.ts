import type { Game } from '../Game';
import { IGameMode } from './IGameMode';
import { DEMO_CAMERA_SPEED, DEMO_CAMERA_RADIUS, DEMO_CAMERA_HEIGHT, TABLE_HEIGHT } from '../constants';
import * as THREE from 'three';

/**
 * Handles the game logic when the game is in Demo mode.
 * This includes controlling the circling camera and resetting the ball.
 */
export class DemoMode implements IGameMode {
    private demoCameraAngle = 0;

    public update(deltaTime: number, game: Game): void {
        // Circling camera logic
        this.demoCameraAngle += deltaTime * DEMO_CAMERA_SPEED;
        const x = Math.sin(this.demoCameraAngle) * DEMO_CAMERA_RADIUS;
        const z = Math.cos(this.demoCameraAngle) * DEMO_CAMERA_RADIUS;
        game.camera.position.set(x, DEMO_CAMERA_HEIGHT, z);
        game.camera.lookAt(0, TABLE_HEIGHT, 0); // Look at table height

        // Reset the ball if it's dead for too long, to keep the demo going
        if (game.ball.status < 0) {
            game.ball.reset(game.getService() === 1 ? game.player1 : game.player2);
        }
    }
}
