class InputManager {
    private static instance: InputManager;
    private keys: Set<string>;
    private mousePosition: { x: number, y: number };
    private mouseButtons: Set<number>;

    private constructor() {
        this.keys = new Set();
        this.mousePosition = { x: 0, y: 0 };
        this.mouseButtons = new Set();

        window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

        window.addEventListener('mousemove', (e) => {
            this.mousePosition.x = e.clientX;
            this.mousePosition.y = e.clientY;
        });
        window.addEventListener('mousedown', (e) => this.mouseButtons.add(e.button));
        window.addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
    }

    public static getInstance(): InputManager {
        if (!InputManager.instance) {
            InputManager.instance = new InputManager();
        }
        return InputManager.instance;
    }

    public isKeyPressed(key: string): boolean {
        return this.keys.has(key.toLowerCase());
    }

    public getMousePosition(): { x: number, y: number } {
        return this.mousePosition;
    }

    public isMouseButtonDown(button: number): boolean {
        return this.mouseButtons.has(button);
    }
}

// Export a singleton instance
export const inputManager = InputManager.getInstance();
