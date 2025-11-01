import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assetManager } from '../../src/AssetManager';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFAnimationPointerExtension } from '@needle-tools/three-animation-pointer';

// Mock the dependencies
vi.mock('three/addons/loaders/GLTFLoader.js', () => {
  const GLTFLoader = vi.fn();
  GLTFLoader.prototype.register = vi.fn((callback) => {
    // Simulate the loader calling the registration callback with a dummy parser
    callback({});
  });
  GLTFLoader.prototype.load = vi.fn();
  return { GLTFLoader };
});

vi.mock('@needle-tools/three-animation-pointer', () => {
  const GLTFAnimationPointerExtension = vi.fn();
  return { GLTFAnimationPointerExtension };
});

describe('AssetManager', () => {
  beforeEach(() => {
    // Clear all mocks before each test to ensure test isolation
    vi.clearAllMocks();
  });

  it('should call GLTFLoader to load the player model', async () => {
    const mockGltf = { scene: {}, animations: [] } as unknown as GLTF;

    // Configure the mock loader to simulate a successful load
    (GLTFLoader.prototype.load as vi.Mock).mockImplementation((path, onLoad) => {
      onLoad(mockGltf);
    });

    const assets = await assetManager.loadAll();

    // Since mocks are cleared, we only check for calls within this test.
    // A new loader is created inside the `loadPlayerModel` method.
    expect(GLTFLoader).toHaveBeenCalledTimes(1);
    expect(GLTFLoader.prototype.register).toHaveBeenCalledTimes(1);
    expect(GLTFAnimationPointerExtension).toHaveBeenCalledTimes(1);
    expect(GLTFLoader.prototype.load).toHaveBeenCalledWith(
      'player.glb',
      expect.any(Function), // onLoad callback
      undefined,            // onProgress callback
      expect.any(Function)  // onError callback
    );

    expect(assets.playerModel).toBe(mockGltf);
  });

  it('should reject the promise if the player model fails to load', async () => {
    const mockError = new Error('Failed to load model');

    // Configure the mock loader to simulate a failed load
    (GLTFLoader.prototype.load as vi.Mock).mockImplementation((path, onLoad, onProgress, onError) => {
      onError(mockError);
    });

    await expect(assetManager.loadAll()).rejects.toThrow('Failed to load model');

    expect(GLTFLoader).toHaveBeenCalledTimes(1);
    expect(GLTFLoader.prototype.load).toHaveBeenCalledTimes(1);
  });
});
