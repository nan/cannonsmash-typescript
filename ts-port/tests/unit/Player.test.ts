// ts-port/tests/unit/Player.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Player, STATUS_MAX, SERVEPARAM } from '../../src/Player';
import type { GameAssets } from '../../src/AssetManager';
import { Ball, BallStatus } from '../../src/Ball';
import { TABLE_LENGTH } from '../../src/constants';
import { SERVE_MIN, SERVE_MAX, SERVE_NORMAL } from '../../src/SwingTypes';

// Mock dependencies from 'three' and its addons
vi.mock('three/addons/utils/SkeletonUtils.js', () => ({
    clone: vi.fn(scene => scene), // A simple mock that returns the scene
}));

// Mock the AnimationMixer, AnimationAction, and other related components from THREE
const mockAction = {
    setLoop: vi.fn().mockReturnThis(),
    clampWhenFinished: vi.fn().mockReturnThis(),
    fadeOut: vi.fn().mockReturnThis(),
    reset: vi.fn().mockReturnThis(),
    fadeIn: vi.fn().mockReturnThis(),
    play: vi.fn().mockReturnThis(),
    getClip: vi.fn().mockReturnValue({ duration: 1, name: 'mockClip' }),
    isRunning: vi.fn().mockReturnValue(false),
    paused: false,
    time: 0,
};

const mockMixer = {
    clipAction: vi.fn(() => mockAction),
    addEventListener: vi.fn(),
    update: vi.fn(),
};

// Mock the THREE library itself to intercept constructor calls
vi.mock('three', async () => {
    const originalThree = await vi.importActual('three') as typeof THREE;

    class MockGroup extends originalThree.Group {
        constructor() {
            super();
            this.add = vi.fn();
            this.traverse = vi.fn();
        }
    }

    class MockAnimationMixer {
        constructor() {
            // Return the mockMixer object so that the test's expectations on clipAction etc. still work
            return mockMixer;
        }
    }

    return {
        ...originalThree,
        AnimationMixer: MockAnimationMixer,
        Group: MockGroup,
    };
});


describe('Player', () => {
    let mockAssets: GameAssets;
    let player: Player;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock assets, including a GLTF model structure with animations
        mockAssets = {
            playerModel: {
                scene: new THREE.Group(),
                animations: [
                    { name: 'Default', duration: 1 },
                    { name: 'Fnormal', duration: 1 },
                    { name: 'Fcut', duration: 1 },
                ]
            },
        } as unknown as GameAssets;

        player = new Player(mockAssets, false, 1);
    });

    it('should initialize with default values', () => {
        expect(player).toBeInstanceOf(Player);
        expect(player.isAi).toBe(false);
        expect(player.side).toBe(1);
        expect(player.state).toBe('IDLE');
        expect(player.status).toBe(STATUS_MAX);
        expect(player.swing).toBe(0);
        expect(player.isInBackswing).toBe(false);
        expect(player.targetPosition.x).toBe(0);
        // Initial target z-position is set based on side and table length
        expect(player.targetPosition.y).toBeCloseTo(-TABLE_LENGTH / 4);
    });

    it('should set state to IDLE and play the default animation', () => {
        // Set an initial state other than IDLE to ensure the method logic runs
        player.state = 'BACKSWING';
        vi.clearAllMocks();

        player.setState('IDLE');
        expect(player.state).toBe('IDLE');
        expect(player.isInBackswing).toBe(false);
        expect(mockMixer.clipAction).toHaveBeenCalledWith(expect.objectContaining({ name: 'Default' }));
    });

    it('should cycle through serve types when changeServeType is called', () => {
        // The player's swingType starts as SWING_NORMAL = 0
        player.changeServeType(); // Should start the cycle at SERVE_NORMAL
        expect(player.swingType).toBe(SERVE_NORMAL);

        player.changeServeType();
        expect(player.swingType).toBe(SERVE_NORMAL + 1);

        player.changeServeType();
        expect(player.swingType).toBe(SERVE_NORMAL + 2);

        player.changeServeType();
        expect(player.swingType).toBe(SERVE_MAX);

        player.changeServeType(); // Should wrap around to the minimum serve type
        expect(player.swingType).toBe(SERVE_MIN);
    });

    it('should not change serve type if a swing is already in progress', () => {
        player.swing = 1; // Simulate a swing
        player.swingType = 0;
        player.changeServeType();
        expect(player.swingType).toBe(0);
    });

    it('canServe should return true for the correct player side and ball status', () => {
        const mockBall = { status: BallStatus.TOSS_P1 } as Ball;
        expect(player.canServe(mockBall)).toBe(true);

        const player2 = new Player(mockAssets, false, -1);
        const mockBallP2 = { status: BallStatus.TOSS_P2 } as Ball;
        expect(player2.canServe(mockBallP2)).toBe(true);
    });

    it('canServe should return false for an incorrect side or ball status', () => {
        const mockBallWrongStatus = { status: BallStatus.RALLY_TO_AI } as Ball;
        expect(player.canServe(mockBallWrongStatus)).toBe(false);

        const mockBallWrongSide = { status: BallStatus.TOSS_P2 } as Ball;
        expect(player.canServe(mockBallWrongSide)).toBe(false);
    });

    it('should start a serve correctly and set the right spin', () => {
        const result = player.startServe(2); // spinCategory 2 for 0.1 y-spin
        expect(result).toBe(true);
        expect(player.swing).toBe(1);
        expect(player.swingType).toBe(SERVE_NORMAL);
        // Check spin values from SERVEPARAM table for SERVE_NORMAL, category 2
        expect(player.spin.x).toBe(0.0);
        expect(player.spin.y).toBe(0.1);
        expect(mockMixer.clipAction).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fcut' }));
    });

    it('should not start a serve if already swinging', () => {
        player.swing = 1; // Player is in the middle of a swing
        const result = player.startServe(1);
        expect(result).toBe(false);
    });

    it('should add to status and clamp at the maximum value', () => {
        player.status = 180;
        player.addStatus(50); // 180 + 50 = 230, which should be clamped
        expect(player.status).toBe(STATUS_MAX); // STATUS_MAX is 200
    });

    it('should subtract from status and clamp at the minimum value', () => {
        player.status = 10;
        player.addStatus(-20); // 10 - 20 = -10, which should be clamped
        expect(player.status).toBe(1);
    });

    it('should reset status to the maximum value', () => {
        player.status = 50; // Set a low status
        player.resetStatus();
        expect(player.status).toBe(STATUS_MAX);
    });
});
