import * as THREE from 'three';
import { Player } from './Player';
import { Ball } from './Ball';

export class CameraManager {
    private camera: THREE.PerspectiveCamera;
    private player: Player;
    private ball: Ball;

    // From Player.h
    private eyeOffset = new THREE.Vector3(0.0, -1.0, 0.2);

    constructor(camera: THREE.PerspectiveCamera, player: Player, ball: Ball) {
        this.camera = camera;
        this.player = player;
        this.ball = ball;
    }

    public update() {
        // Update camera position to follow the player
        const playerPosition = this.player.mesh.position;
        this.camera.position.x = playerPosition.x + this.eyeOffset.x;
        this.camera.position.y = playerPosition.y - this.eyeOffset.y; // C++ had Y-up, three.js has Y-up, but camera seems inverted in C++
        this.camera.position.z = playerPosition.z - this.eyeOffset.z;

        // Update lookAt target based on logic from C++ MoveLookAt
        // This is a simplified version for now
        const lookAtPosition = this.ball.mesh.position;
        this.camera.lookAt(lookAtPosition);
    }
}
