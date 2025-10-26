// ts-port/src/ScoreManager.ts

import { BallStatus } from './Ball';

// An interface to define the dependencies ScoreManager has on the main Game class.
// This avoids a direct circular dependency.
export interface IGameScoringContext {
    player1: { resetStatus: () => void };
    player2: { resetStatus: () => void };
    returnToDemo: () => void;
}

type GameMode = '5PTS' | '11PTS' | '21PTS';

export class ScoreManager {
    private context: IGameScoringContext;
    private scoreboardElement: HTMLElement;

    // Game state properties
    public score1 = 0;
    public score2 = 0;
    private game1 = 0;
    private game2 = 0;
    private gameMode: GameMode = '11PTS';
    public isGameOver = false;

    constructor(context: IGameScoringContext) {
        this.context = context;
        this.scoreboardElement = document.getElementById('scoreboard')!;
        this.reset();
    }

    public reset(): void {
        this.score1 = 0;
        this.score2 = 0;
        this.isGameOver = false;
        this.updateScoreboard();
    }

    private updateScoreboard() {
        if (this.isGameOver) {
             // In endGame, the text is set explicitly. Don't overwrite it.
            return;
        }
        this.scoreboardElement.innerText = `${this.score1} - ${this.score2}`;
    }

    private pointWonBy(playerSide: number) {
        if (this.isGameOver) return;

        if (playerSide === 1) {
            this.score1++;
        } else {
            this.score2++;
        }
        this.updateScoreboard();

        // Check for game over
        const p1Score = this.score1;
        const p2Score = this.score2;
        // TODO: Move 11 and 2 to constants based on gameMode
        const gameOver = (p1Score >= 11 || p2Score >= 11) && Math.abs(p1Score - p2Score) >= 2;

        if (gameOver) {
            this.endGame(p1Score > p2Score);
        } else {
            // Reset player statuses to full at the end of each point.
            this.context.player1.resetStatus();
            this.context.player2.resetStatus();
        }
    }

    private endGame(player1Won: boolean) {
        if (this.isGameOver) return;
        this.isGameOver = true;

        document.exitPointerLock();
        this.scoreboardElement.innerText = player1Won ? 'You Win!' : 'You Lose!';

        // Return to demo after a delay
        setTimeout(() => {
            this.context.returnToDemo();
            // Dispatch an event to notify UI to return to demo screen
            document.dispatchEvent(new CustomEvent('gameended'));
        }, 4000);
    }

    public awardPoint(prevBallStatus: number) {
        if (this.isGameOver) return;

        switch (prevBallStatus) {
            case BallStatus.IN_PLAY_TO_AI:
            case BallStatus.SERVE_TO_AI:
            case BallStatus.TOSS_P1:
            case BallStatus.RALLY_TO_HUMAN:
            case BallStatus.SERVE_TO_HUMAN:
                this.pointWonBy(-1); // AI scores
                break;
            default:
                this.pointWonBy(1); // Player scores
                break;
        }
    }

    public getService(): number {
        let serviceOwner = 0;
        switch (this.gameMode) {
            case '5PTS':
                serviceOwner = this._getService5PTS();
                break;
            case '11PTS':
                serviceOwner = this._getService11PTS();
                break;
            case '21PTS':
                serviceOwner = this._getService21PTS();
                break;
        }

        if ((this.game1 + this.game2) % 2 === 1) {
            serviceOwner = -serviceOwner;
        }

        return -serviceOwner;
    }

    private _getService11PTS(): number {
        const totalScore = this.score1 + this.score2;
        if (this.score1 >= 10 && this.score2 >= 10) {
            return (totalScore % 2 === 1 ? -1 : 1);
        } else {
            return (Math.floor(totalScore / 2) % 2 === 0) ? -1 : 1;
        }
    }

    private _getService21PTS(): number {
        const totalScore = this.score1 + this.score2;
        if (this.score1 >= 20 && this.score2 >= 20) {
            return (totalScore % 2 === 1 ? -1 : 1);
        } else {
            return (Math.floor(totalScore / 5) % 2 === 0) ? -1 : 1;
        }
    }

    private _getService5PTS(): number {
        const totalScore = this.score1 + this.score2;
        return (totalScore % 2 === 0 ? -1 : 1);
    }
}
