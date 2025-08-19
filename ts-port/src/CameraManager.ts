import * as THREE from 'three';
import { Player } from './Player';
import { Ball } from './Ball';
import { TABLE_LENGTH, TABLE_HEIGHT } from './constants';

export class CameraManager {
    private camera: THREE.PerspectiveCamera;
    private player: Player;
    private ball: Ball;

    // From Player.h
    private eyeOffset = new THREE.Vector3(0.0, 0.2, -1.0); // Correctly mapped from C++
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
             this.lookAtTarget.lerp(ballPos, 0.1);
        } else {
             this.lookAtTarget.lerp(tx, 0.1);
        }
        // --- End of Player::MoveLookAt logic ---


        // --- Start of SoloPlay::LookAt logic ---
        const srcX = playerPos.clone().add(this.eyeOffset);

        // C++ code used player's y-distance from origin, which is z in Three.js
        if (Math.abs(playerPos.z) < 2.0) {
            srcX.z += playerPos.z / 2.0;
        } else {
            // C++: srcX[1] += -m_thePlayer->GetSide()*1.0;
            // Assuming player side is +1 (on +Z side), this pulls camera back
            srcX.z += 2.0; // Increased from 1.0 to pull camera further back
        }

        this.camera.position.copy(srcX);
        this.camera.lookAt(this.lookAtTarget);
    }
}
