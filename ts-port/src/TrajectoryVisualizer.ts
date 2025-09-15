import * as THREE from 'three';
import { Ball } from './Ball';
import { Player } from './Player';
import { TICK } from './constants';

const MAX_TRAJECTORY_POINTS = 300;
const OPTIMAL_HIT_MARKER_COLOR = 0xff0000;
const TRAJECTORY_LINE_COLOR = 0x00ff00;

/**
 * Manages the visualization of the ball's predicted trajectory and the optimal hit point.
 */
export class TrajectoryVisualizer {
    private scene: THREE.Scene;
    private trajectoryLine: THREE.Line | null = null;
    private optimalHitMarker: THREE.Mesh | null = null;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * Calculates and displays the predicted trajectory and optimal hit point.
     * @param startBall The ball instance at the beginning of the prediction (e.g., right after the opponent hits it).
     * @param player The player for whom the prediction is being made.
     */
    public show(startBall: Ball, player: Player): void {
        // Clear any previous visuals before showing new ones.
        this.hide();

        const simBall = startBall.clone();
        const trajectoryPoints: THREE.Vector3[] = [];
        let optimalHitPoint: THREE.Vector3 | null = null;

        // Simulate the ball's movement for a number of steps.
        for (let i = 0; i < MAX_TRAJECTORY_POINTS; i++) {
            const oldPos = simBall.mesh.position.clone();
            trajectoryPoints.push(oldPos);

            // Update physics and check for collisions
            simBall._updatePhysics(TICK);
            simBall.checkCollision(oldPos);

            // Check for the optimal hit point.
            // We only care about the *first* hittable frame.
            if (!optimalHitPoint && player.canHitBall(simBall)) {
                optimalHitPoint = simBall.mesh.position.clone();
            }

            // Stop simulation if the ball is dead.
            if (simBall.status < 0) {
                break;
            }
        }

        // Create and add the trajectory line to the scene.
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(trajectoryPoints);
        const lineMaterial = new THREE.LineBasicMaterial({ color: TRAJECTORY_LINE_COLOR });
        this.trajectoryLine = new THREE.Line(lineGeometry, lineMaterial);
        this.scene.add(this.trajectoryLine);

        // Create and add the optimal hit marker if a point was found.
        if (optimalHitPoint) {
            const markerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: OPTIMAL_HIT_MARKER_COLOR });
            this.optimalHitMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            this.optimalHitMarker.position.copy(optimalHitPoint);
            this.scene.add(this.optimalHitMarker);
        }
    }

    /**
     * Removes the trajectory visuals from the scene.
     */
    public hide(): void {
        if (this.trajectoryLine) {
            this.trajectoryLine.geometry.dispose();
            (this.trajectoryLine.material as THREE.Material).dispose();
            this.scene.remove(this.trajectoryLine);
            this.trajectoryLine = null;
        }

        if (this.optimalHitMarker) {
            this.optimalHitMarker.geometry.dispose();
            (this.optimalHitMarker.material as THREE.Material).dispose();
            this.scene.remove(this.optimalHitMarker);
            this.optimalHitMarker = null;
        }
    }
}
