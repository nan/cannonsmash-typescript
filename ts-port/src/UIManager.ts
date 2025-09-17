export class UIManager {
    private demoScreen: HTMLElement;
    private pauseScreen: HTMLElement;
    private gameOverScreen: HTMLElement;
    private gameOverMessage: HTMLElement;

    constructor(demoScreen: HTMLElement, pauseScreen: HTMLElement, gameOverScreen: HTMLElement) {
        this.demoScreen = demoScreen;
        this.pauseScreen = pauseScreen;
        this.gameOverScreen = gameOverScreen;
        this.gameOverMessage = document.getElementById('game-over-message')!;
    }

    public showDemoScreen(): void {
        this.demoScreen.classList.remove('hidden');
        this.pauseScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
    }

    public showPauseScreen(): void {
        this.demoScreen.classList.add('hidden');
        this.pauseScreen.classList.remove('hidden');
        this.gameOverScreen.classList.add('hidden');
    }

    public showGameScreen(): void {
        this.demoScreen.classList.add('hidden');
        this.pauseScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
    }

    public showGameOverScreen(didPlayerWin: boolean): void {
        this.gameOverMessage.innerText = didPlayerWin ? 'You Win!' : 'You Lose!';
        this.demoScreen.classList.add('hidden');
        this.pauseScreen.classList.add('hidden');
        this.gameOverScreen.classList.remove('hidden');
    }
}
