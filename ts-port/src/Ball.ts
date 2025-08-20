import * as THREE from 'three';

const BALL_RADIUS = 0.02; // Assuming meters

export class Ball {
    public mesh: THREE.Mesh;
    public velocity = new THREE.Vector3();
    public spin = new THREE.Vector2(); // x, y spin in rad/s

    constructor() {
        const geometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        this.mesh = new THREE.Mesh(geometry, material);

    }

    public update(deltaTime: number) {
        // Ball physics
        this.mesh.position.addScaledVector(this.velocity, deltaTime);
    }
}
