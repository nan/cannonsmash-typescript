// Constants from ttinc.h
export const TABLE_LENGTH = 2.74;
export const TABLE_WIDTH = 1.525;
export const TABLE_HEIGHT = 0.76;
export const TABLE_THICK = 0.1;
export const NET_HEIGHT = 0.1525;
export const AREAXSIZE = 8.0;
export const AREAYSIZE = 12.0;

export const AREAZSIZE = 6.0;

export const TICK = 0.01; // Original fixed time step

export const AILevel = {
    EASY: 0,
    NORMAL: 1,
    HARD: 2
} as const;
export type AILevel = typeof AILevel[keyof typeof AILevel];
