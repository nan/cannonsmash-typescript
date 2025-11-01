import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Field } from '../../src/Field';
import * as THREE from 'three';

// Mock the entire 'three' module.
// When mocking classes that will be instantiated with `new`, the mock implementation
// must be a proper function/class, not an arrow function returning an object.
vi.mock('three', async () => {
    const actualThree = await vi.importActual('three') as typeof THREE;

    return {
        ...actualThree,
        TextureLoader: vi.fn().mockImplementation(function () {
            this.load = vi.fn().mockReturnValue({
                wrapS: 0,
                wrapT: 0,
                repeat: { set: vi.fn() },
            });
            return this;
        }),
        Group: vi.fn().mockImplementation(function () {
            this.add = vi.fn();
            this.children = [];
            this.position = { set: vi.fn(), copy: vi.fn() };
            this.rotation = { y: 0 };
            return this;
        }),
        Mesh: vi.fn().mockImplementation(function () {
            this.add = vi.fn();
            this.rotation = { x: 0, y: 0, z: 0 };
            this.position = { x: 0, y: 0, z: 0, copy: vi.fn(), set: vi.fn() };
            return this;
        }),
        DirectionalLight: vi.fn().mockImplementation(function () {
            this.position = { copy: vi.fn() };
            return this;
        }),
        AmbientLight: vi.fn(),
        RingGeometry: vi.fn(),
        MeshBasicMaterial: vi.fn(),
        PlaneGeometry: vi.fn(),
        MeshStandardMaterial: vi.fn(),
        BoxGeometry: vi.fn(),
    };
});

describe('Field', () => {
    let field: Field;

    beforeEach(() => {
        vi.clearAllMocks();
        // Instantiate the class under test, which will use the mocks defined above
        field = new Field();
    });

    it('should create a main mesh group on initialization', () => {
        expect(THREE.Group).toHaveBeenCalled();
        expect(field.mesh).toBeDefined();
        // The first group created is the main `field.mesh`
        expect(field.mesh).toBe(vi.mocked(THREE.Group).mock.results[0].value);
    });

    it('should create a target indicator mesh', () => {
        expect(field.targetIndicator).toBeDefined();
        // Check that the indicator was created using the correct geometry and material
        expect(THREE.Mesh).toHaveBeenCalledWith(expect.any(THREE.RingGeometry), expect.any(THREE.MeshBasicMaterial));
    });

    it('should add all high-level components to the main mesh group', () => {
        const mainMeshAddMock = vi.mocked(field.mesh.add);

        // Expected children: 2 lights, floor, 4 walls, table group, net, target indicator
        const EXPECTED_CHILD_COUNT = 10;
        expect(mainMeshAddMock).toHaveBeenCalledTimes(EXPECTED_CHILD_COUNT);

        // Check that the target indicator instance was one of the added children
        expect(mainMeshAddMock).toHaveBeenCalledWith(field.targetIndicator);
    });

    it('should create and add two lights to the scene', () => {
        expect(THREE.DirectionalLight).toHaveBeenCalledOnce();
        expect(THREE.AmbientLight).toHaveBeenCalledOnce();

        const mainMeshAddMock = vi.mocked(field.mesh.add);
        expect(mainMeshAddMock).toHaveBeenCalledWith(expect.any(THREE.DirectionalLight));
        expect(mainMeshAddMock).toHaveBeenCalledWith(expect.any(THREE.AmbientLight));
    });

    it('should create and add a floor and four walls', () => {
        // 1 floor + 4 walls + 1 net = 6 plane geometries total
        expect(THREE.PlaneGeometry).toHaveBeenCalledTimes(6);
    });

    it('should create a table group with all its components', () => {
        // Expect one group for `field.mesh` and one for the `tableGroup`
        expect(THREE.Group).toHaveBeenCalledTimes(2);

        // Find the table group instance by checking what was added to the main mesh
        const mainMeshAddMock = vi.mocked(field.mesh.add);
        const tableGroupInstance = mainMeshAddMock.mock.calls
            .map(call => call[0])
            .find(arg => arg instanceof vi.mocked(THREE.Group));

        expect(tableGroupInstance).toBeDefined();

        const tableGroupAddMock = vi.mocked(tableGroupInstance.add);
        // Expected table children: 1 tabletop + 5 lines + 4 legs
        const EXPECTED_TABLE_CHILD_COUNT = 10;
        expect(tableGroupAddMock).toHaveBeenCalledTimes(EXPECTED_TABLE_CHILD_COUNT);

        // Verify that BoxGeometry was used for table parts
        expect(THREE.BoxGeometry).toHaveBeenCalled();
    });

    it('should create and add a net', () => {
        const mainMeshAddMock = vi.mocked(field.mesh.add);
        const addedMeshes = mainMeshAddMock.mock.calls
            .map(call => call[0])
            .filter(arg => arg instanceof vi.mocked(THREE.Mesh));

        // Floor + 4 Walls + Net + TargetIndicator = 7 meshes directly under field.mesh
        // (The table parts are under a separate group)
        expect(addedMeshes.length).toBe(7);
    });
});
