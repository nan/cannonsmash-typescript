import * as THREE from 'three';

// Constants from ttinc.h
export const CAMERA_FOV = 60;
export const CAMERA_EYE_OFFSET = new THREE.Vector3(0.0, 0.6, 0.0);

export const TABLE_LENGTH = 2.74;
export const TABLE_WIDTH = 1.525;
export const TABLE_HEIGHT = 0.76;
export const TABLE_THICK = 0.1;
export const NET_HEIGHT = 0.1525;
export const AREAXSIZE = 8.0;
export const AREAYSIZE = 12.0;

// Player movement sensitivity when using Pointer Lock
export const PLAYER_MOVE_SENSITIVITY_X = 0.003;
export const PLAYER_MOVE_SENSITIVITY_Z = 0.003;
export const AREAZSIZE = 6.0;

// Player swing types from Player.h
export const SWING_NORMAL = 0;
export const SWING_POKE = 1;
export const SWING_SMASH = 2;
export const SWING_DRIVE = 3;
export const SWING_CUT = 4;
export const SWING_BLOCK = 5;

// Player spin constants
export const SPIN_NORMAL = 0.4;
export const SPIN_POKE = -0.8;
export const SPIN_DRIVE = 0.8;
export const SPIN_SMASH = 0.2;

export const SERVE_MIN = 65536;
export const SERVE_MAX = SERVE_MIN + 3;

export const SERVE_NORMAL = SERVE_MIN + 0;
export const SERVE_POKE = SERVE_MIN + 1;
export const SERVE_SIDESPIN1 = SERVE_MIN + 2;
export const SERVE_SIDESPIN2 = SERVE_MIN + 3;

// Corresponds to struct swingType in Player.h
export interface SwingType {
  type: number;
  toss: number;
  backswing: number;
  hitStart: number;
  hitEnd: number;
  swingEnd: number;
  swingLength: number;
  hitX: number;
  hitY: number;
  tossV: number;
}

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

// Corresponds to SERVEPARAM in Player.h
export const SERVEPARAM: number[][] = [
    [SERVE_NORMAL,     0.0, 0.0,  0.0,  0.1,  0.0,  0.2],
    [SERVE_POKE,       0.0, 0.0,  0.0, -0.3,  0.0, -0.6],
    [SERVE_SIDESPIN1, -0.6, 0.2, -0.8,  0.0, -0.6, -0.2],
    [SERVE_SIDESPIN2,  0.6, 0.2,  0.8,  0.0,  0.6, -0.2],
    [-1,               0.0, 0.0,  0.0,  0.0,  0.0,  0.0]
];

// Physics constants from ttinc.h
export const PHY = 0.15; // Air resistance coefficient
export const GRAVITY = (spin: number) => 9.8 + spin * 5; // Gravity combined with Magnus effect
export const TICK = 0.01; // Original fixed time step
export const TABLE_E = 0.8; // Bounciness of the table

// Fallback serve velocity if calculation fails
export const FALLBACK_SERVE_VELOCITY = new THREE.Vector3(0, 2.8, -4.5);

// Lighting
export const DIR_LIGHT_COLOR = 0xFFFFFF;
export const DIR_LIGHT_INTENSITY = 3;
export const DIR_LIGHT_POSITION = new THREE.Vector3(-1, 2, 4);
export const AMB_LIGHT_COLOR = 0x404040;
export const AMB_LIGHT_INTENSITY = 2;

// Demo Mode
export const DEMO_CAMERA_SPEED = 0.218;
export const DEMO_CAMERA_RADIUS = 4;
export const DEMO_CAMERA_HEIGHT = 2.5;

// --- AI Controller Constants ---

// Serve Logic
export const AI_SERVE_STABLE_VELOCITY_THRESHOLD = 0.2;
export const AI_SERVE_POSITION_TOLERANCE = 0.1;
export const AI_SERVE_TARGET_DEPTH_DIVISOR = 6;
export const AI_SERVE_TARGET_X_RANDOM_FACTOR = 0.5;

// Rally Targeting: Velocity-based adjustments
export const AI_RALLY_TARGET_VELOCITY_ADJUST_HIGH_THRESHOLD = 1.5;
export const AI_RALLY_TARGET_VELOCITY_ADJUST_LOW_THRESHOLD = 0.5;
export const AI_RALLY_TARGET_VELOCITY_ADJUST_HIGH_DIVISOR = 2;
export const AI_RALLY_TARGET_VELOCITY_ADJUST_LOW_DIVISOR = 4;

// Rally Targeting: Trajectory-based depth adjustments
export const AI_TRAJECTORY_THRESHOLD_SHORT = 0.0;
export const AI_TRAJECTORY_THRESHOLD_MEDIUM = 0.1;
export const AI_TARGET_DEPTH_SHORT_DIVISOR = 4;
export const AI_TARGET_DEPTH_MEDIUM_DIVISOR = 3;
export const AI_TARGET_DEPTH_DEEP_NUMERATOR = 6;
export const AI_TARGET_DEPTH_DEEP_DENOMINATOR = 16;

// Rally Targeting: X-coordinate zones
export const AI_TARGET_X_MAX_FACTOR = 7/16;
// Corresponds to `switch(RAND(8))` in the original C++ code.
export const AI_TARGET_X_ZONE_FACTORS = [
    -AI_TARGET_X_MAX_FACTOR, -5/16, -3/16, -1/16, 1/16, 3/16, 5/16, AI_TARGET_X_MAX_FACTOR
];

// --- Status System Constants (from Player.h) ---
export const STATUS_MAX = 200;
export const RUN_SPEED = 2.0;
export const RUN_PENALTY = -1;
export const SWING_PENALTY = -1;
export const WALK_SPEED = 1.0;
export const WALK_BONUS = 1;
export const ACCEL_LIMIT = [0.8, 0.7, 0.6, 0.5]; // Corresponds to gameLevel {EASY, NORMAL, HARD, TSUBORISH}
export const ACCEL_PENALTY = -1;

// --- Keyboard Targeting Constants (from Game.ts) ---
export const KEY_MAP_X: { [key: string]: number } = {
    '1': -TABLE_WIDTH / 2 * 0.9, 'q': -TABLE_WIDTH / 2 * 0.9, 'a': -TABLE_WIDTH / 2 * 0.9, 'z': -TABLE_WIDTH / 2 * 0.9,
    '2': -TABLE_WIDTH / 2 * 0.9, 'w': -TABLE_WIDTH / 2 * 0.9, 's': -TABLE_WIDTH / 2 * 0.9, 'x': -TABLE_WIDTH / 2 * 0.9,
    '3': -TABLE_WIDTH / 2 * 0.9,
    'e': -TABLE_WIDTH / 2 * 0.75,
    'd': -TABLE_WIDTH / 2 * 0.6,
    '4': -TABLE_WIDTH / 2 * 0.45, 'c': -TABLE_WIDTH / 2 * 0.45,
    'r': -TABLE_WIDTH / 2 * 0.3,
    'f': -TABLE_WIDTH / 2 * 0.15,
    '5': 0, 'v': 0,
    't': TABLE_WIDTH / 2 * 0.15,
    'g': TABLE_WIDTH / 2 * 0.3,
    '6': TABLE_WIDTH / 2 * 0.45, 'b': TABLE_WIDTH / 2 * 0.45,
    'y': TABLE_WIDTH / 2 * 0.6,
    'h': TABLE_WIDTH / 2 * 0.75,
    '7': TABLE_WIDTH / 2 * 0.9, 'n': TABLE_WIDTH / 2 * 0.9, 'u': TABLE_WIDTH / 2 * 0.9, 'j': TABLE_WIDTH / 2 * 0.9,
    '8': TABLE_WIDTH / 2 * 0.9, 'm': TABLE_WIDTH / 2 * 0.9, 'i': TABLE_WIDTH / 2 * 0.9, 'k': TABLE_WIDTH / 2 * 0.9,
    '9': TABLE_WIDTH / 2 * 0.9, ',': TABLE_WIDTH / 2 * 0.9, 'o': TABLE_WIDTH / 2 * 0.9, 'l': TABLE_WIDTH / 2 * 0.9,
    '0': TABLE_WIDTH / 2 * 0.9, '.': TABLE_WIDTH / 2 * 0.9, 'p': TABLE_WIDTH / 2 * 0.9, ';': TABLE_WIDTH / 2 * 0.9,
};

export const KEY_MAP_Y: { [key: string]: number } = {
    '1': TABLE_LENGTH / 12 * 5, '2': TABLE_LENGTH / 12 * 5, '3': TABLE_LENGTH / 12 * 5, '4': TABLE_LENGTH / 12 * 5, '5': TABLE_LENGTH / 12 * 5, '6': TABLE_LENGTH / 12 * 5, '7': TABLE_LENGTH / 12 * 5, '8': TABLE_LENGTH / 12 * 5, '9': TABLE_LENGTH / 12 * 5, '0': TABLE_LENGTH / 12 * 5,
    'q': TABLE_LENGTH / 12 * 4, 'w': TABLE_LENGTH / 12 * 4, 'e': TABLE_LENGTH / 12 * 4, 'r': TABLE_LENGTH / 12 * 4, 't': TABLE_LENGTH / 12 * 4, 'y': TABLE_LENGTH / 12 * 4, 'u': TABLE_LENGTH / 12 * 4, 'i': TABLE_LENGTH / 12 * 4, 'o': TABLE_LENGTH / 12 * 4, 'p': TABLE_LENGTH / 12 * 4,
    'a': TABLE_LENGTH / 12 * 3, 's': TABLE_LENGTH / 12 * 3, 'd': TABLE_LENGTH / 12 * 3, 'f': TABLE_LENGTH / 12 * 3, 'g': TABLE_LENGTH / 12 * 3, 'h': TABLE_LENGTH / 12 * 3, 'j': TABLE_LENGTH / 12 * 3, 'k': TABLE_LENGTH / 12 * 3, 'l': TABLE_LENGTH / 12 * 3, ';': TABLE_LENGTH / 12 * 3,
    'z': TABLE_LENGTH / 12 * 2, 'x': TABLE_LENGTH / 12 * 2, 'c': TABLE_LENGTH / 12 * 2, 'v': TABLE_LENGTH / 12 * 2, 'b': TABLE_LENGTH / 12 * 2, 'n': TABLE_LENGTH / 12 * 2, 'm': TABLE_LENGTH / 12 * 2, ',': TABLE_LENGTH / 12 * 2, '.': TABLE_LENGTH / 12 * 2,
};
