import * as THREE from 'three';
import { Ball } from './Ball';
import { Player } from './Player';
import { SWING_NORMAL, TABLE_LENGTH, TICK, stype } from './constants';

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

        const simBall = startBall.clone();
        const trajectoryPoints: THREE.Vector3[] = [];

        let hitPointIndex = -1;
        let maxHeight = -1.0;

        // 1. Simulate the ball's trajectory and find the optimal HIT point (not the marker point yet).
        // This logic mimics Player.predictOptimalPlayerPosition.
        for (let i = 0; i < MAX_TRAJECTORY_POINTS; i++) {
            const currentPos = simBall.mesh.position.clone();
            trajectoryPoints.push(currentPos);

            // Condition to check if the ball has bounced on the player's side.
            if ((simBall.status === 3 && player.side === 1) || (simBall.status === 1 && player.side === -1)) {
                if (currentPos.y > maxHeight) {
                    if (Math.abs(currentPos.z) < TABLE_LENGTH / 2 + 1.0 &&
                        Math.abs(currentPos.z) > TABLE_LENGTH / 2 - 0.5)
                    {
                        maxHeight = currentPos.y;
                        hitPointIndex = i; // Store the index of the highest point
                    }
                }
            }

            const oldPos = simBall.mesh.position.clone();
            simBall._updatePhysics(TICK);
            simBall.checkCollision(oldPos);

            if (simBall.status < 0) {
                break;
            }
        }

        // 2. If a hit point was found, calculate the TIMING MARKER's position.
        if (hitPointIndex !== -1) {
            const swingParams = stype.get(SWING_NORMAL);
            if (!swingParams) return; // Should not happen

            const swingLagFrames = swingParams.hitStart; // e.g., 20 frames
            const markerIndex = Math.max(0, hitPointIndex - swingLagFrames);
            const markerPosition = trajectoryPoints[markerIndex];

            // 3. Draw the visuals based on the marker's timing.

            // --- Trajectory before the marker (Thick Tube) ---
            const pointsBefore = trajectoryPoints.slice(0, markerIndex + 1);
            if (pointsBefore.length > 1) {
                const curveBefore = new THREE.CatmullRomCurve3(pointsBefore);
                const tubeGeometry = new THREE.TubeGeometry(curveBefore, pointsBefore.length, TRAJECTORY_TUBE_RADIUS, 8, false);
                const tubeMaterial = new THREE.MeshBasicMaterial({ color: TRAJECTORY_TUBE_COLOR });
                this.trajectoryTube = new THREE.Mesh(tubeGeometry, tubeMaterial);
                this.scene.add(this.trajectoryTube);
            }

            // --- Trajectory after the marker (Thin Line) ---
            const pointsAfter = trajectoryPoints.slice(markerIndex);
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
