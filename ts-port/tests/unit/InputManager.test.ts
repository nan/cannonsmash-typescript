// ts-port/tests/unit/InputManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { inputManager } from '../../src/InputManager';

describe('InputManager', () => {

    // Before each test, reset the state by simulating key/button releases
    // and calling the update method to clear the "just pressed" state.
    beforeEach(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
        window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
        inputManager.update();
    });

    it('should detect if a key is currently pressed', () => {
        // Simulate pressing the 'a' key
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        expect(inputManager.isKeyPressed('a')).toBe(true);
        expect(inputManager.isKeyPressed('b')).toBe(false);
    });

    it('should detect if a key was just pressed in the current frame', () => {
        // Frame 1: Key is pressed
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        expect(inputManager.isKeyJustPressed('a')).toBe(true);

        // Frame 2: Call update, which cycles the state
        inputManager.update();
        expect(inputManager.isKeyJustPressed('a')).toBe(false); // No longer "just" pressed
        expect(inputManager.isKeyPressed('a')).toBe(true); // Still held down
    });

    it('should handle key releases', () => {
        // Press the key, then release it
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        expect(inputManager.isKeyPressed('a')).toBe(true);
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
        expect(inputManager.isKeyPressed('a')).toBe(false);
    });

    it('should detect if a mouse button is currently down', () => {
        window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
        expect(inputManager.isMouseButtonDown(0)).toBe(true);
        expect(inputManager.isMouseButtonDown(1)).toBe(false);
    });

    it('should detect if a mouse button was just pressed', () => {
        // Frame 1: Button is pressed
        window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
        expect(inputManager.isMouseButtonJustPressed(0)).toBe(true);

        // Frame 2: After update
        inputManager.update();
        expect(inputManager.isMouseButtonJustPressed(0)).toBe(false);
        expect(inputManager.isMouseButtonDown(0)).toBe(true);
    });

    it('should update pointer lock status on pointerlockchange event', () => {
        // Simulate acquiring pointer lock
        Object.defineProperty(document, 'pointerLockElement', { value: document.body, configurable: true });
        document.dispatchEvent(new Event('pointerlockchange'));
        expect(inputManager.isPointerLocked).toBe(true);

        // Simulate releasing pointer lock
        Object.defineProperty(document, 'pointerLockElement', { value: null, configurable: true });
        document.dispatchEvent(new Event('pointerlockchange'));
        expect(inputManager.isPointerLocked).toBe(false);
    });

    it('should track mouse movement when pointer is locked', () => {
        // Acquire lock
        Object.defineProperty(document, 'pointerLockElement', { value: document.body, configurable: true });
        document.dispatchEvent(new Event('pointerlockchange'));

        // Simulate mouse movement
        const movementX = 10;
        const movementY = -5;
        window.dispatchEvent(new MouseEvent('mousemove', { movementX, movementY }));

        const movement = inputManager.getMouseMovement();
        expect(movement.x).toBe(movementX);
        expect(movement.y).toBe(movementY);
    });

    it('should not track mouse movement when pointer is not locked', () => {
        // Ensure lock is not active
        Object.defineProperty(document, 'pointerLockElement', { value: null, configurable: true });
        document.dispatchEvent(new Event('pointerlockchange'));

        // Simulate mouse movement
        window.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: -5 }));

        const movement = inputManager.getMouseMovement();
        // The movement should be 0 because the update() call in beforeEach resets it.
        expect(movement.x).toBe(0);
        expect(movement.y).toBe(0);
    });
});
