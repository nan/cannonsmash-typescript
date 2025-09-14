export class UIManager {
    private demoScreen: HTMLElement;
    private pauseScreen: HTMLElement;

    constructor(demoScreen: HTMLElement, pauseScreen: HTMLElement) {
        this.demoScreen = demoScreen;
        this.pauseScreen = pauseScreen;
    }

    public showDemoScreen(): void {
        this.demoScreen.classList.remove('hidden');
        this.pauseScreen.classList.add('hidden');
    }

    public showPauseScreen(): void {
        this.demoScreen.classList.add('hidden');
        this.pauseScreen.classList.remove('hidden');
    }

    public showGameScreen(): void {
        this.demoScreen.classList.add('hidden');
        this.pauseScreen.classList.add('hidden');
    }
}
