import { SWING_NORMAL, SWING_POKE, SWING_SMASH, SWING_DRIVE, SWING_CUT, SWING_BLOCK } from './SwingTypes';

export const PlayerType = {
    SHAKE_DEFENCE: 0,
    PEN_ATTACK: 1,
    SHAKE_DRIVE: 2,
    PEN_DRIVE: 3
} as const;

export type PlayerType = typeof PlayerType[keyof typeof PlayerType];

export interface ShotStats {
    speed: number;
    precision: number; // Error rate (lower is better)
    spin: number;
}

export interface PlayerAttributes {
    name: string;
    runSpeed: number; // Multiplier for base RUN_SPEED
    walkSpeed: number; // Multiplier for base WALK_SPEED
    acceleration: number; // Multiplier for base MOVEMENT_ACCELERATION
    swingProbabilities: { [key: number]: number }; // Probability weight for each swing type
    shotStats: { [key: string]: ShotStats }; // Key format: "F_DRIVE", "B_CUT", etc.
}



export const PLAYER_TYPES: Map<PlayerType, PlayerAttributes> = new Map([
    [PlayerType.PEN_ATTACK, {
        name: "Penholder Fast Attack",
        runSpeed: 1.2,
        walkSpeed: 1.1,
        acceleration: 1.3,
        swingProbabilities: {
            [SWING_SMASH]: 0.4,
            [SWING_DRIVE]: 0.3,
            [SWING_POKE]: 0.2,
            [SWING_NORMAL]: 0.1,
            [SWING_CUT]: 0.0,
            [SWING_BLOCK]: 0.0
        },
        shotStats: {
            "F_NORMAL": { speed: 1.0, precision: 0.10, spin: 1.0 },
            "F_DRIVE": { speed: 0.8, precision: 0.10, spin: 0.9 },
            "F_SMASH": { speed: 1.5, precision: 0.10, spin: 1.0 },
            "F_POKE": { speed: 1.0, precision: 0.10, spin: 1.2 },
            "F_CUT": { speed: 0.7, precision: 0.20, spin: 0.6 },
            "B_NORMAL": { speed: 1.0, precision: 0.10, spin: 1.0 },
            "B_DRIVE": { speed: 0.7, precision: 0.15, spin: 0.7 },
            "B_SMASH": { speed: 1.4, precision: 0.10, spin: 1.0 },
            "B_POKE": { speed: 1.0, precision: 0.10, spin: 1.2 },
            "B_CUT": { speed: 0.7, precision: 0.20, spin: 0.6 },
        }
    }],
    [PlayerType.SHAKE_DEFENCE, { // ShakeCut
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
        },
        shotStats: {
            "F_NORMAL": { speed: 1.0, precision: 0.10, spin: 1.0 },
            "F_DRIVE": { speed: 0.8, precision: 0.15, spin: 1.0 },
            "F_SMASH": { speed: 0.9, precision: 0.20, spin: 1.0 },
            "F_POKE": { speed: 1.0, precision: 0.10, spin: 1.4 },
            "F_CUT": { speed: 1.0, precision: 0.10, spin: 1.5 },
            "B_NORMAL": { speed: 1.0, precision: 0.10, spin: 1.0 },
            "B_DRIVE": { speed: 0.8, precision: 0.10, spin: 0.8 },
            "B_SMASH": { speed: 0.9, precision: 0.15, spin: 1.0 },
            "B_POKE": { speed: 1.0, precision: 0.10, spin: 1.4 },
            "B_CUT": { speed: 1.0, precision: 0.10, spin: 1.4 },
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
        },
        shotStats: {
            "F_NORMAL": { speed: 1.0, precision: 0.10, spin: 1.0 },
            "F_DRIVE": { speed: 1.2, precision: 0.10, spin: 1.4 },
            "F_SMASH": { speed: 1.1, precision: 0.20, spin: 1.0 },
            "F_POKE": { speed: 1.0, precision: 0.20, spin: 0.9 },
            "F_CUT": { speed: 0.8, precision: 0.15, spin: 1.0 },
            "B_NORMAL": { speed: 1.0, precision: 0.10, spin: 1.0 },
            "B_DRIVE": { speed: 1.2, precision: 0.10, spin: 1.2 },
            "B_SMASH": { speed: 1.0, precision: 0.15, spin: 1.0 },
            "B_POKE": { speed: 1.0, precision: 0.20, spin: 0.9 },
            "B_CUT": { speed: 0.8, precision: 0.15, spin: 0.9 },
        }
    }],
    [PlayerType.PEN_DRIVE, {
        name: "Penholder Drive",
        runSpeed: 1.3,
        walkSpeed: 1.0,
        acceleration: 1.1,
        swingProbabilities: {
            [SWING_DRIVE]: 0.8,
            [SWING_SMASH]: 0.1,
            [SWING_NORMAL]: 0.1,
            [SWING_POKE]: 0.0,
            [SWING_CUT]: 0.0,
            [SWING_BLOCK]: 0.0
        },
        shotStats: {
            "F_NORMAL": { speed: 1.0, precision: 0.10, spin: 1.0 },
            "F_DRIVE": { speed: 1.3, precision: 0.10, spin: 1.5 },
            "F_SMASH": { speed: 1.2, precision: 0.15, spin: 1.0 },
            "F_POKE": { speed: 1.0, precision: 0.15, spin: 1.1 },
            "F_CUT": { speed: 0.7, precision: 0.25, spin: 0.6 },
            "B_NORMAL": { speed: 0.8, precision: 0.20, spin: 1.0 },
            "B_DRIVE": { speed: 0.7, precision: 0.20, spin: 0.9 },
            "B_SMASH": { speed: 0.7, precision: 0.20, spin: 1.0 },
            "B_POKE": { speed: 1.0, precision: 0.15, spin: 1.1 },
            "B_CUT": { speed: 0.7, precision: 0.25, spin: 0.6 },
        }
    }]
]);
