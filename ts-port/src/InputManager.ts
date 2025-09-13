class InputManager {
    private static instance: InputManager;
    private keys: Set<string>;
    private previousKeys: Set<string>;
    private mousePosition: { x: number, y: number };
    private mouseButtons: Set<number>;
    private previousMouseButtons: Set<number>;
    private justPressedMouseButtons: Set<number>;

    private constructor() {
        this.keys = new Set();
        this.previousKeys = new Set();
        this.mousePosition = { x: 0, y: 0 };
        this.mouseButtons = new Set();
        this.previousMouseButtons = new Set();
        this.justPressedMouseButtons = new Set();
    }

    public init(canvas: HTMLCanvasElement) {
        window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

        canvas.addEventListener('mousemove', (e) => {
            this.mousePosition.x = e.clientX;
            this.mousePosition.y = e.clientY;
        });
        canvas.addEventListener('mousedown', (e) => {
            this.mouseButtons.add(e.button);
            this.justPressedMouseButtons.add(e.button);
        });
        canvas.addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
        // Prevent context menu on right-click
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    public static getInstance(): InputManager {
        if (!InputManager.instance) {
            InputManager.instance = new InputManager();
        }
        return InputManager.instance;
    }

    public update() {
        console.log("InputManager.update called");
        this.previousKeys = new Set(this.keys);
        this.previousMouseButtons = new Set(this.mouseButtons);
        this.justPressedMouseButtons.clear();
    }

    public isKeyPressed(key: string): boolean {
        return this.keys.has(key.toLowerCase());
    }

    public isKeyJustPressed(key: string): boolean {
        return this.keys.has(key.toLowerCase()) && !this.previousKeys.has(key.toLowerCase());
    }

    public getMousePosition(): { x: number, y: number } {
        return this.mousePosition;
    }

    public isMouseButtonDown(button: number): boolean {
        return this.mouseButtons.has(button);
    }

    public isMouseButtonJustPressed(button: number): boolean {
        return this.justPressedMouseButtons.has(button);
    }
}

// Export a singleton instance
export const inputManager = InputManager.getInstance();
