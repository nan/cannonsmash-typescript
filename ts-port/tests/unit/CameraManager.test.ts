// ts-port/tests/unit/CameraManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CameraManager } from '../../src/CameraManager';
import { Player } from '../../src/Player';
import { Ball } from '../../src/Ball';
import { TABLE_HEIGHT, TABLE_LENGTH } from '../../src/constants';

describe('CameraManager', () => {
    let mockCamera: THREE.PerspectiveCamera;
    let mockPlayer: Player;
    let mockBall: Ball;
    let cameraManager: CameraManager;

    beforeEach(() => {
        // Mock the camera with a spy on lookAt
        mockCamera = new THREE.PerspectiveCamera();
        vi.spyOn(mockCamera, 'lookAt');

        // Mock Player and Ball with real Vector3 for position
        mockPlayer = {
            mesh: {
                position: new THREE.Vector3(0, 0, TABLE_LENGTH / 2),
            },
        } as Player;

        mockBall = {
            mesh: {
                position: new THREE.Vector3(0, TABLE_HEIGHT, 0),
            },
        } as Ball;

        cameraManager = new CameraManager(mockCamera, mockPlayer, mockBall);
    });

    it('should initialize with default lookAt target', () => {
        cameraManager.update();

        // Initially, the camera should smoothly look towards the far side of the table.
        // We test the result after one update frame.
        const expectedTarget = new THREE.Vector3(0, TABLE_HEIGHT, -TABLE_LENGTH / 2);

        // The lookAtTarget starts at (0,0,0) and lerps towards the target.
        // After one update, it will be a small fraction of the way there.
        const lookAtCall = (mockCamera.lookAt as vi.Mock).mock.calls[0][0] as THREE.Vector3;

        expect(lookAtCall.x).toBeCloseTo(expectedTarget.x * 0.02);
        expect(lookAtCall.y).toBeCloseTo(expectedTarget.y * 0.02);
        expect(lookAtCall.z).toBeCloseTo(expectedTarget.z * 0.02);
    });

    it('should make the camera look at the ball when it is out of view', () => {
        // Position the ball far to the side, outside the default camera view angle
        mockBall.mesh.position.set(2.0, TABLE_HEIGHT, -TABLE_LENGTH / 4);

        cameraManager.update();

        // The lookAtTarget should now be lerping towards the ball's position
        const lookAtCall = (mockCamera.lookAt as vi.Mock).mock.calls[0][0] as THREE.Vector3;

        expect(lookAtCall.x).toBeCloseTo(mockBall.mesh.position.x * 0.02);
        expect(lookAtCall.y).toBeCloseTo(mockBall.mesh.position.y * 0.02);
        expect(lookAtCall.z).toBeCloseTo(mockBall.mesh.position.z * 0.02);
    });

    it('should adjust the camera Z position based on the player Z position', () => {
        // Move the player further back from the table
        const playerZ = TABLE_LENGTH / 2 + 1.0;
        mockPlayer.mesh.position.z = playerZ;

        cameraManager.update();

        // The camera's z position should be pulled back.
        // zOffset = playerPos.z / CAMERA_Z_OFFSET_FACTOR = 2.37 / 1.5 = 1.58
        const expectedZOffset = playerZ / 1.5;
        expect(mockCamera.position.z).toBeCloseTo(playerZ + expectedZOffset);
    });

    it('should clamp the lookAt target to prevent it from going below the ground', () => {
        // Position the ball below the minimum lookAt Y
        mockBall.mesh.position.set(2.0, -1.0, -TABLE_LENGTH / 4);

        cameraManager.update();

        const lookAtCall = (mockCamera.lookAt as vi.Mock).mock.calls[0][0] as THREE.Vector3;

        // The y-value of the lookAt target should be clamped at CAMERA_MIN_LOOKAT_Y (0.0)
        expect(lookAtCall.y).toBe(0.0);
    });
});
