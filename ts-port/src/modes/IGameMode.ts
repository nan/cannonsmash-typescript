import type { Game } from '../Game';

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
