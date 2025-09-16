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

        // 1. Get the authoritative optimal hit point from the Player's prediction logic.
        const prediction = player.predictOptimalHittingPoint(startBall);
        if (!prediction || !prediction.position) return; // Can't draw if no prediction.
        const optimalHitPoint = prediction.position;

        const simBall = startBall.clone();
        const trajectoryPoints: THREE.Vector3[] = [];
        let optimalHitPointIndex = -1;
        let minDistanceToOptimalSq = Infinity;

        // 2. Simulate the trajectory to get the points for the line.
        for (let i = 0; i < MAX_TRAJECTORY_POINTS; i++) {
            const currentPos = simBall.mesh.position.clone();
            trajectoryPoints.push(currentPos);

            // Find the point in the trajectory that is closest to the predicted optimal point.
            // This ensures the marker is exactly on the drawn line.
            const distanceSq = currentPos.distanceToSquared(optimalHitPoint);
            if (distanceSq < minDistanceToOptimalSq) {
                minDistanceToOptimalSq = distanceSq;
                optimalHitPointIndex = i;
            }

            // Stop if we are well past the optimal point and it was a bounce hit, to save computation.
            if (prediction.isBounceHit && minDistanceToOptimalSq < 0.01 && simBall.velocity.y < 0) {
                 if (currentPos.z > optimalHitPoint.z + 0.5) break;
            }

            const oldPos = simBall.mesh.position.clone();
            simBall._updatePhysics(TICK);
            simBall.checkCollision(oldPos);

            if (simBall.status < 0) {
                break;
            }
        }

        // 3. Draw the visuals.
        if (optimalHitPointIndex !== -1) {
            // Update the optimalHitPoint to be the exact point on the trajectory line.
            const finalOptimalHitPoint = trajectoryPoints[optimalHitPointIndex];

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

            // --- Optimal Hit Marker ---
            const markerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: OPTIMAL_HIT_MARKER_COLOR });
            this.optimalHitMarker = new THREE.Mesh(markerGeometry, markerMaterial);
            this.optimalHitMarker.position.copy(finalOptimalHitPoint);
            this.scene.add(this.optimalHitMarker);

        } else {
            // If no hit point is found, draw the whole trajectory as a thin line.
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(trajectoryPoints);
            const lineMaterial = new THREE.LineBasicMaterial({ color: TRAJECTORY_LINE_COLOR });
            this.trajectoryLine = new THREE.Line(lineGeometry, lineMaterial);
            this.scene.add(this.trajectoryLine);
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
