import type { Game, IGameMode } from '../Game';
import { inputManager } from '../InputManager';
import { BallStatus } from '../Ball';
import { SERVE_MIN, SERVE_NORMAL } from '../SwingTypes';

/**
 * Handles the game logic when the game is in active play.
 * This includes handling user input, managing serves, and updating game visualizations.
 */
export class PlayMode implements IGameMode {
    public update(_deltaTime: number, game: Game): void {
        // Pre-serve logic
        if (game.ball.status === BallStatus.WAITING_FOR_SERVE) {
            const server = game.getService() === game.player1.side ? game.player1 : game.player2;
            game.ball.reset(server);

            // This logic only applies to the human player, so keep it separate.
            if (server === game.player1 && game.player1.swingType < SERVE_MIN) {
                game.player1.swingType = SERVE_NORMAL;
            }
        }

        game.cameraManager.update();

        // Update target indicator position
        game.field.targetIndicator.position.x = game.player1.targetPosition.x;
        game.field.targetIndicator.position.z = game.player1.targetPosition.y; // y from 2d vec maps to z in 3d

        // --- Trajectory Visualizer Logic ---
        if (game.ball.justHitBySide === -1) { // AI just hit the ball
            game.trajectoryVisualizer.show(game.ball, game.player1);
            game.ball.justHitBySide = 0; // Consume the event
        } else if (game.ball.justHitBySide === 1 || game.ball.status < 0) { // Player hit or rally ended
            game.trajectoryVisualizer.hide();
            if (game.ball.justHitBySide === 1) game.ball.justHitBySide = 0; // Consume the event
        }

        inputManager.update();
    }
}
