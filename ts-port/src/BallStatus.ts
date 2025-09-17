/**
 * Represents the status of the ball during the game.
 * These values are ported from the original C++ implementation's logic.
 */
export enum BallStatus {
    /** The ball is dead and the point is over. */
    DEAD = -1,
    /** Ball is in rally, heading towards Player 2 (AI), after bouncing on Player 1's side. */
    RALLY_TO_AI = 0,
    /** Ball is in rally, heading towards Player 1 (Human), after bouncing on Player 2's side. */
    RALLY_TO_HUMAN = 1,
    /** Ball was hit by AI, now heading towards Player 1's side for a bounce. */
    IN_PLAY_TO_HUMAN = 2,
    /** Ball was hit by Human, now heading towards Player 2's side for a bounce. */
    IN_PLAY_TO_AI = 3,
    /** Ball was served by Player 1, heading towards Player 2's side for a bounce. */
    SERVE_TO_AI = 4,
    /** Ball was served by Player 2, heading towards Player 1's side for a bounce. */
    SERVE_TO_HUMAN = 5,
    /** Ball is being tossed for a serve by Player 1. */
    TOSS_P1 = 6,
    /** Ball is being tossed for a serve by Player 2. */
    TOSS_P2 = 7,
    /** Ball is waiting for the player to initiate a serve. */
    WAITING_FOR_SERVE = 8,
}
