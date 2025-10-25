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


