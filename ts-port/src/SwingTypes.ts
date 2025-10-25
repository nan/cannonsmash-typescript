import { SWING_NORMAL, SWING_POKE, SWING_SMASH, SWING_DRIVE, SWING_CUT, SWING_BLOCK, SERVE_NORMAL, SERVE_POKE, SERVE_SIDESPIN1, SERVE_SIDESPIN2 } from './Player';
import type { SwingType } from './Player';

// Corresponds to stype map in Player.cpp
export const stype: Map<number, SwingType> = new Map([
    [SWING_NORMAL,    { type: SWING_NORMAL,    toss: -1, backswing: 10, hitStart: 20, hitEnd: 20, swingEnd: 30, swingLength: 50, hitX: 0.3, hitY: 0.0, tossV: 0.0 }],
    [SWING_POKE,      { type: SWING_POKE,      toss: -1, backswing: 10, hitStart: 20, hitEnd: 20, swingEnd: 30, swingLength: 50, hitX: 0.3, hitY: 0.0, tossV: 0.0 }],
    [SWING_SMASH,     { type: SWING_SMASH,     toss: -1, backswing: 10, hitStart: 20, hitEnd: 20, swingEnd: 70, swingLength: 70, hitX: 0.3, hitY: 0.0, tossV: 0.0 }],
    [SWING_DRIVE,     { type: SWING_DRIVE,     toss: -1, backswing: 10, hitStart: 30, hitEnd: 30, swingEnd: 80, swingLength: 80, hitX: 0.3, hitY: 0.0, tossV: 0.0 }],
    [SWING_CUT,       { type: SWING_CUT,       toss: -1, backswing: 10, hitStart: 20, hitEnd: 20, swingEnd: 30, swingLength: 50, hitX: 0.3, hitY: 0.0, tossV: 0.0 }],
    [SWING_BLOCK,     { type: SWING_BLOCK,     toss: -1, backswing: 5,  hitStart: 10, hitEnd: 30, swingEnd: 40, swingLength: 40, hitX: 0.3, hitY: 0.0, tossV: 0.0 }],
    [SERVE_NORMAL,    { type: SERVE_NORMAL,    toss: 1,  backswing: 10, hitStart: 20, hitEnd: 20, swingEnd: 30, swingLength: 50,  hitX: 0.3, hitY: 0.0, tossV: 2.5 }],
    [SERVE_POKE,      { type: SERVE_POKE,      toss: 20, backswing: 85, hitStart: 100,hitEnd: 100, swingEnd: 115, swingLength: 200, hitX: 0.0, hitY: 0.0, tossV: 4.0 }],
    [SERVE_SIDESPIN1, { type: SERVE_SIDESPIN1, toss: 20, backswing: 60, hitStart: 80, hitEnd: 80, swingEnd: 95, swingLength: 150,  hitX: 0.0, hitY: 0.0, tossV: 3.2 }],
    [SERVE_SIDESPIN2, { type: SERVE_SIDESPIN2, toss: 20, backswing: 80, hitStart: 100,hitEnd: 100, swingEnd: 120, swingLength: 200, hitX: 0.0, hitY: 0.0, tossV: 4.0 }],
]);
