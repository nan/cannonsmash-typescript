class InputManager {
    private static instance: InputManager;
    private keys: Set<string>;
    private previousKeys: Set<string>;
    private mouseButtons: Set<number>;
    private previousMouseButtons: Set<number>;

    // Pointer Lock API properties
    private mouseMovement: { x: number, y: number };
    public isPointerLocked: boolean;

    private constructor() {
        this.keys = new Set();
        this.previousKeys = new Set();
        this.mouseButtons = new Set();
        this.previousMouseButtons = new Set();
        this.mouseMovement = { x: 0, y: 0 };
        this.isPointerLocked = false;

        window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

        window.addEventListener('mousedown', (e) => this.mouseButtons.add(e.button));
        window.addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));

        // Prevent context menu on right-click
        window.addEventListener('contextmenu', (e) => e.preventDefault());

        // Pointer Lock event listeners
        document.addEventListener('pointerlockchange', this.handlePointerLockChange.bind(this), false);
        document.addEventListener('pointerlockerror', this.handlePointerLockError.bind(this), false);
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    }

    private handlePointerLockChange() {
        if (document.pointerLockElement) {
            this.isPointerLocked = true;
            console.log('Pointer locked');
        } else {
            this.isPointerLocked = false;
            console.log('Pointer unlocked');
        }
    }

    private handlePointerLockError() {
        console.error('Pointer lock error');
    }

    private handleMouseMove(e: MouseEvent) {
        if (this.isPointerLocked) {
            this.mouseMovement.x += e.movementX || 0;
            this.mouseMovement.y += e.movementY || 0;
        }
    }

    public static getInstance(): InputManager {
        if (!InputManager.instance) {
            InputManager.instance = new InputManager();
        }
        return InputManager.instance;
    }

    public update() {
        this.previousKeys = new Set(this.keys);
        this.previousMouseButtons = new Set(this.mouseButtons);
        // Reset mouse movement deltas at the end of the frame
        this.mouseMovement = { x: 0, y: 0 };
    }

    public isKeyPressed(key: string): boolean {
        return this.keys.has(key.toLowerCase());
    }

    public isKeyJustPressed(key: string): boolean {
        return this.keys.has(key.toLowerCase()) && !this.previousKeys.has(key.toLowerCase());
    }

    public getMouseMovement(): { x: number, y: number } {
        return this.mouseMovement;
    }

    public isMouseButtonDown(button: number): boolean {
        return this.mouseButtons.has(button);
    }

    public isMouseButtonJustPressed(button: number): boolean {
        return this.mouseButtons.has(button) && !this.previousMouseButtons.has(button);
    }
}

// Export a singleton instance
export const inputManager = InputManager.getInstance();
