import * as THREE from 'three';
import { Ball } from './Ball';
import { Player } from './Player';
import { TICK } from './constants';

const MAX_TRAJECTORY_POINTS = 300;
const OPTIMAL_HIT_MARKER_COLOR = 0xff0000;
const TRAJECTORY_LINE_COLOR = 0x888888; // Thinner line color
const TRAJECTORY_TUBE_COLOR = 0x00ff00; // Thicker line color
const TRAJECTORY_TUBE_RADIUS = 0.005;

/**
 * Manages the visualization of the ball's predicted trajectory and the optimal hit point.
 */
export class TrajectoryVisualizer {
    private scene: THREE.Scene;
    private trajectoryTube: THREE.Mesh | null = null; // For the thicker part of the line
    private trajectoryLine: THREE.Line | null = null; // For the thinner part of the line
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
        let optimalHitPointIndex = -1;

        // Simulate the ball's movement for a number of steps.
        for (let i = 0; i < MAX_TRAJECTORY_POINTS; i++) {
            const oldPos = simBall.mesh.position.clone();
            trajectoryPoints.push(oldPos);

            // Update physics and check for collisions
            simBall._updatePhysics(TICK);
            simBall.checkCollision(oldPos);

            // Check for the optimal hit point.
            // We only care about the *first* hittable frame.
            if (optimalHitPointIndex === -1 && player.canHitBall(simBall)) {
                optimalHitPoint = simBall.mesh.position.clone();
                optimalHitPointIndex = i;
            }

            // Stop simulation if the ball is dead.
            if (simBall.status < 0) {
                break;
            }
        }

        if (optimalHitPointIndex !== -1) {
            // --- Trajectory before the hit marker (Thick Tube) ---
            const pointsBefore = trajectoryPoints.slice(0, optimalHitPointIndex + 1);
            if (pointsBefore.length > 1) {
                const curveBefore = new THREE.CatmullRomCurve3(pointsBefore);
                const tubeGeometry = new THREE.TubeGeometry(curveBefore, pointsBefore.length, TRAJECTORY_TUBE_RADIUS, 8, false);
                const tubeMaterial = new THREE.MeshBasicMaterial({ color: TRAJECTORY_TUBE_COLOR });
                this.trajectoryTube = new THREE.Mesh(tubeGeometry, tubeMaterial);
                this.scene.add(this.trajectoryTube);
            }

            // --- Trajectory after the hit marker (Thin Line) ---
            const pointsAfter = trajectoryPoints.slice(optimalHitPointIndex);
            if (pointsAfter.length > 1) {
                const lineGeometryAfter = new THREE.BufferGeometry().setFromPoints(pointsAfter);
                const lineMaterialAfter = new THREE.LineBasicMaterial({ color: TRAJECTORY_LINE_COLOR });
                this.trajectoryLine = new THREE.Line(lineGeometryAfter, lineMaterialAfter);
                this.scene.add(this.trajectoryLine);
            }
        } else {
            // If no hit point is found, draw the whole trajectory as a thin line.
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(trajectoryPoints);
            const lineMaterial = new THREE.LineBasicMaterial({ color: TRAJECTORY_LINE_COLOR });
            this.trajectoryLine = new THREE.Line(lineGeometry, lineMaterial);
            this.scene.add(this.trajectoryLine);
        }


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
        if (this.trajectoryTube) {
            this.trajectoryTube.geometry.dispose();
            (this.trajectoryTube.material as THREE.Material).dispose();
            this.scene.remove(this.trajectoryTube);
            this.trajectoryTube = null;
        }

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
