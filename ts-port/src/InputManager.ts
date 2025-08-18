class InputManager {
    private static instance: InputManager;
    public keys: Set<string>;

    private constructor() {
        this.keys = new Set();
        window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
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
}

// Export a singleton instance
export const inputManager = InputManager.getInstance();
