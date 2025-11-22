import { SWING_NORMAL, SWING_POKE, SWING_SMASH, SWING_DRIVE, SWING_CUT, SWING_BLOCK } from './SwingTypes';

export const PlayerType = {
    SHAKE_DEFENCE: 0,
    PEN_ATTACK: 1,
    SHAKE_DRIVE: 2,
    PEN_DRIVE: 3
} as const;

export type PlayerType = typeof PlayerType[keyof typeof PlayerType];

export interface PlayerAttributes {
    name: string;
    runSpeed: number; // Multiplier for base RUN_SPEED
    walkSpeed: number; // Multiplier for base WALK_SPEED
    acceleration: number; // Multiplier for base MOVEMENT_ACCELERATION
    swingProbabilities: { [key: number]: number }; // Probability weight for each swing type
    // Add more attributes as needed (e.g., reaction time, error rate multipliers)
}

export const PLAYER_TYPES: Map<PlayerType, PlayerAttributes> = new Map([
    [PlayerType.PEN_ATTACK, {
        name: "Penholder Fast Attack",
        runSpeed: 1.2, // Fast
        walkSpeed: 1.1,
        acceleration: 1.3, // Very High acceleration (Agile)
        swingProbabilities: {
            [SWING_SMASH]: 0.4,
            [SWING_DRIVE]: 0.3,
            [SWING_POKE]: 0.2,
            [SWING_NORMAL]: 0.1,
            [SWING_CUT]: 0.0,
            [SWING_BLOCK]: 0.0
        }
    }],
    // Default fallback for others for now
    [PlayerType.SHAKE_DEFENCE, {
        name: "Shakehand Defence",
        runSpeed: 1.0,
        walkSpeed: 1.0,
        acceleration: 1.0,
        swingProbabilities: {
            [SWING_CUT]: 0.6,
            [SWING_NORMAL]: 0.2,
            [SWING_POKE]: 0.2,
            [SWING_DRIVE]: 0.0,
            [SWING_SMASH]: 0.0,
            [SWING_BLOCK]: 0.0
        }
    }],
    [PlayerType.SHAKE_DRIVE, {
        name: "Shakehand Drive",
        runSpeed: 1.0,
        walkSpeed: 1.0,
        acceleration: 1.0,
        swingProbabilities: {
            [SWING_DRIVE]: 0.6,
            [SWING_SMASH]: 0.1,
            [SWING_NORMAL]: 0.2,
            [SWING_POKE]: 0.1,
            [SWING_CUT]: 0.0,
            [SWING_BLOCK]: 0.0
        }
    }],
    [PlayerType.PEN_DRIVE, {
        name: "Penholder Drive",
        runSpeed: 1.3, // Faster max speed than PenAttack (Powerful)
        walkSpeed: 1.0,
        acceleration: 1.1, // Moderate acceleration (Less agile than PenAttack)
        swingProbabilities: {
            [SWING_DRIVE]: 0.8, // High probability for Drive (Loop)
            [SWING_SMASH]: 0.1,
            [SWING_NORMAL]: 0.1,
            [SWING_POKE]: 0.0,
            [SWING_CUT]: 0.0,
            [SWING_BLOCK]: 0.0
        }
    }]
]);
