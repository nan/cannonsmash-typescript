import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrajectoryVisualizer } from '../../src/TrajectoryVisualizer';
import * as THREE from 'three';
import type { Ball } from '../../src/Ball';
import type { Player } from '../../src/Player';
// Import the actual stype map to spy on it
import { stype, SwingType } from '../../src/SwingTypes';

// Mock the entire 'three' module with distinct mocks for each geometry
vi.mock('three', async () => {
    const actualThree = await vi.importActual('three') as typeof THREE;

    const MockMaterial = vi.fn(function (this: any) {
        this.dispose = vi.fn();
        return this;
    });

    const MockGeometry = vi.fn(function (this: any) {
        this.dispose = vi.fn();
        this.setFromPoints = vi.fn();
        return this;
    });

    return {
        ...actualThree,
        BufferGeometry: vi.fn().mockImplementation(MockGeometry),
        TubeGeometry: vi.fn().mockImplementation(MockGeometry),
        SphereGeometry: vi.fn().mockImplementation(MockGeometry),

        LineBasicMaterial: MockMaterial,
        MeshBasicMaterial: MockMaterial,

        Line: vi.fn(function (this: any) {
            this.geometry = new (vi.fn().mockImplementation(MockGeometry))();
            this.material = new (vi.fn().mockImplementation(MockMaterial))();
            return this;
        }),
        Mesh: vi.fn(function (this: any) {
            this.position = { copy: vi.fn() };
            this.geometry = new (vi.fn().mockImplementation(MockGeometry))();
            this.material = new (vi.fn().mockImplementation(MockMaterial))();
            return this;
        }),
        // Corrected: Use a proper function for the constructor mock
        CatmullRomCurve3: vi.fn(function (this: any) {
            return this;
        }),
        Vector3: actualThree.Vector3,
    };
});

describe('TrajectoryVisualizer', () => {
    let visualizer: TrajectoryVisualizer;
    let mockScene: THREE.Scene;
    let mockPlayer: Player;
    let mockBall: Ball;
    let mockTrajectory: THREE.Vector3[];

    beforeEach(() => {
        vi.clearAllMocks();

        // Spy on and mock the 'get' method of the actual `stype` map
        vi.spyOn(stype, 'get').mockReturnValue({
            backswing: 10, hitStart: 20
        } as SwingType);

        mockScene = {
            add: vi.fn(),
            remove: vi.fn(),
        } as unknown as THREE.Scene;

        visualizer = new TrajectoryVisualizer(mockScene);

        mockTrajectory = Array.from({ length: 15 }, (_, i) => new THREE.Vector3(i, i, i));
        mockPlayer = { predictOptimalPlayerPosition: vi.fn() } as unknown as Player;
        mockBall = {} as Ball;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('show() method', () => {
        it('should display a simple line if no optimal hit index is found', () => {
            vi.mocked(mockPlayer.predictOptimalPlayerPosition).mockReturnValue({
                trajectory: mockTrajectory,
                hitIndex: -1,
            });
            visualizer.show(mockBall, mockPlayer);
            expect(THREE.Line).toHaveBeenCalledOnce();
            expect(mockScene.add).toHaveBeenCalledWith(expect.any(THREE.Line));
            expect(THREE.TubeGeometry).not.toHaveBeenCalled();
            expect(THREE.SphereGeometry).not.toHaveBeenCalled();
        });

        it('should display a tube, a line, and a marker if an optimal hit index is found', () => {
            vi.mocked(mockPlayer.predictOptimalPlayerPosition).mockReturnValue({
                trajectory: mockTrajectory,
                hitIndex: 12, // Use an index that guarantees pointsBefore.length > 1
            });
            visualizer.show(mockBall, mockPlayer);
            expect(THREE.TubeGeometry).toHaveBeenCalledOnce();
            expect(THREE.Line).toHaveBeenCalledOnce();
            expect(THREE.SphereGeometry).toHaveBeenCalledOnce();
            expect(mockScene.add).toHaveBeenCalledTimes(3);
        });

        it('should call hide() to clear previous visuals', () => {
            const hideSpy = vi.spyOn(visualizer, 'hide');
            vi.mocked(mockPlayer.predictOptimalPlayerPosition).mockReturnValue({
                trajectory: mockTrajectory,
                hitIndex: -1,
            });
            visualizer.show(mockBall, mockPlayer);
            expect(hideSpy).toHaveBeenCalledOnce();
        });
    });

    describe('hide() method', () => {
        it('should remove all visuals and dispose of their resources', () => {
            vi.mocked(mockPlayer.predictOptimalPlayerPosition).mockReturnValue({
                trajectory: mockTrajectory,
                hitIndex: 12, // Use an index that guarantees all objects are created
            });
            visualizer.show(mockBall, mockPlayer);

            const mockTube = vi.mocked(THREE.Mesh).mock.instances[0];
            const mockLine = vi.mocked(THREE.Line).mock.instances[0];
            const mockMarker = vi.mocked(THREE.Mesh).mock.instances[1];

            visualizer.hide();

            expect(mockScene.remove).toHaveBeenCalledWith(mockTube);
            expect(mockScene.remove).toHaveBeenCalledWith(mockLine);
            expect(mockScene.remove).toHaveBeenCalledWith(mockMarker);

            expect(mockTube.geometry.dispose).toHaveBeenCalledOnce();
            expect(mockTube.material.dispose).toHaveBeenCalledOnce();
            expect(mockLine.geometry.dispose).toHaveBeenCalledOnce();
            expect(mockLine.material.dispose).toHaveBeenCalledOnce();
            expect(mockMarker.geometry.dispose).toHaveBeenCalledOnce();
            expect(mockMarker.material.dispose).toHaveBeenCalledOnce();
        });
    });
});
