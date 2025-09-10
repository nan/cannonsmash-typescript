import * as THREE from 'three';
import { Player } from './Player';
import { Ball } from './Ball';
import { TABLE_LENGTH, TABLE_HEIGHT } from './constants';

export class CameraManager {
    private camera: THREE.PerspectiveCamera;
    private player: Player;
    private ball: Ball;

    // From Player.h
    private eyeOffset = new THREE.Vector3(0.0, 0.8, -2.5); // Correctly mapped from C++
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
        if (angle > (Math.PI / 180 * 25) && ballPos.z < playerPos.z) {
             this.lookAtTarget.lerp(ballPos, 0.02);
        } else {
             this.lookAtTarget.lerp(tx, 0.02);
        }
        // --- End of Player::MoveLookAt logic ---


        // --- Start of SoloPlay::LookAt logic ---
        const srcX = playerPos.clone().add(this.eyeOffset);

        // Smoothly pull the camera back as the player moves away from the net.
        // This replaces a discontinuous if/else block that caused a camera jump.
        const zOffset = Math.min(playerPos.z / 1.5, 2.5);
        srcX.z += zOffset;

        this.camera.position.copy(srcX);

        // Clamp the lookAtTarget to prevent it from going below the ground
        this.lookAtTarget.y = Math.max(this.lookAtTarget.y, 0.0);

        this.camera.lookAt(this.lookAtTarget);
    }
}
