import * as THREE from 'three';
import { Ball } from './Ball';
import { Player } from './Player';
import { SWING_NORMAL, TICK, stype } from './constants';

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
        this.hide();

        // 1. Get the full trajectory prediction from the Player class.
        // This avoids duplicating the simulation logic here.
        const prediction = player.predictOptimalPlayerPosition(startBall);
        const { trajectory, hitIndex } = prediction;

        // 2. If no valid hit point was found, draw the whole trajectory as a simple line.
        if (hitIndex === -1) {
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(trajectory);
            const lineMaterial = new THREE.LineBasicMaterial({ color: TRAJECTORY_LINE_COLOR });
            this.trajectoryLine = new THREE.Line(lineGeometry, lineMaterial);
            this.scene.add(this.trajectoryLine);
            return;
        }

        // 3. A hit point was found, so calculate the timing marker position.
        const swingParams = stype.get(SWING_NORMAL);
        if (!swingParams) return; // Should not happen

        const swingLagFrames = swingParams.hitStart - swingParams.backswing; // e.g., 20 - 10 = 10 frames
        const markerIndex = Math.max(0, hitIndex - swingLagFrames);
        const markerPosition = trajectory[markerIndex];

        // 4. Draw the visuals based on the marker's timing.

        // --- Trajectory before the marker (Thick Tube) ---
        const pointsBefore = trajectory.slice(0, markerIndex + 1);
        if (pointsBefore.length > 1) {
            const curveBefore = new THREE.CatmullRomCurve3(pointsBefore);
            const tubeGeometry = new THREE.TubeGeometry(curveBefore, pointsBefore.length, TRAJECTORY_TUBE_RADIUS, 8, false);
            const tubeMaterial = new THREE.MeshBasicMaterial({ color: TRAJECTORY_TUBE_COLOR });
            this.trajectoryTube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            this.scene.add(this.trajectoryTube);
        }

        // --- Trajectory after the marker (Thin Line) ---
        const pointsAfter = trajectory.slice(markerIndex);
        if (pointsAfter.length > 1) {
            const lineGeometryAfter = new THREE.BufferGeometry().setFromPoints(pointsAfter);
            const lineMaterialAfter = new THREE.LineBasicMaterial({ color: TRAJECTORY_LINE_COLOR });
            this.trajectoryLine = new THREE.Line(lineGeometryAfter, lineMaterialAfter);
            this.scene.add(this.trajectoryLine);
        }

        // --- Timing Marker ---
        const markerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: OPTIMAL_HIT_MARKER_COLOR });
        this.optimalHitMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.optimalHitMarker.position.copy(markerPosition);
        this.scene.add(this.optimalHitMarker);
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
