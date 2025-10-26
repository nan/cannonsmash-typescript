import * as THREE from 'three';
import { Player } from './Player';
import { Ball } from './Ball';
import { TABLE_LENGTH, TABLE_HEIGHT } from './constants';

export const CAMERA_FOV = 60;
export const CAMERA_EYE_OFFSET = new THREE.Vector3(0.0, 0.6, 0.0);

// --- Camera Behavior Constants ---
const CAMERA_VIEW_ANGLE_THRESHOLD_DEG = 25;
const CAMERA_LOOKAT_LERP_FACTOR = 0.02;
const CAMERA_Z_OFFSET_FACTOR = 1.5;
const CAMERA_MAX_Z_OFFSET = 2.5;
const CAMERA_MIN_LOOKAT_Y = 0.0;


export class CameraManager {
    private camera: THREE.PerspectiveCamera;
    private player: Player;
    private ball: Ball;

    private eyeOffset = CAMERA_EYE_OFFSET.clone();
    private lookAtTarget = new THREE.Vector3();

    constructor(camera: THREE.PerspectiveCamera, player: Player, ball: Ball) {
        this.camera = camera;
        this.player = player;
        this.ball = ball;
    }

    public update() {
        // This is a port of the logic from SoloPlay::LookAt and Player::MoveLookAt
        const playerPos = this.player.mesh.position;
        const ballPos = this.ball.mesh.position;

        // --- Start of Player::MoveLookAt logic ---
        const cameraDefaultPos = playerPos.clone().add(this.eyeOffset);
        // tx is the default look-at point on the far side of the table
        const tx = new THREE.Vector3(0, TABLE_HEIGHT, -TABLE_LENGTH / 2); // Assuming player is on +Z side
        const vx1 = tx.clone().sub(cameraDefaultPos).normalize();
        const vxt = ballPos.clone().sub(cameraDefaultPos).normalize();

        const cosP = vx1.dot(vxt);
        const angle = Math.acos(cosP);

        // A simplified version of the "is ball going out of view" check
        // The original C++ code is more complex. This captures the spirit.
        if (angle > (Math.PI / 180 * CAMERA_VIEW_ANGLE_THRESHOLD_DEG) && ballPos.z < playerPos.z) {
             this.lookAtTarget.lerp(ballPos, CAMERA_LOOKAT_LERP_FACTOR);
        } else {
             this.lookAtTarget.lerp(tx, CAMERA_LOOKAT_LERP_FACTOR);
        }
        // --- End of Player::MoveLookAt logic ---


        // --- Start of SoloPlay::LookAt logic ---
        const srcX = playerPos.clone().add(this.eyeOffset);

        // Smoothly pull the camera back as the player moves away from the net.
        // This replaces a discontinuous if/else block that caused a camera jump.
        const zOffset = Math.min(playerPos.z / CAMERA_Z_OFFSET_FACTOR, CAMERA_MAX_Z_OFFSET);
        srcX.z += zOffset;

        this.camera.position.copy(srcX);

        // Clamp the lookAtTarget to prevent it from going below the ground
        this.lookAtTarget.y = Math.max(this.lookAtTarget.y, CAMERA_MIN_LOOKAT_Y);

        this.camera.lookAt(this.lookAtTarget);
    }
}
