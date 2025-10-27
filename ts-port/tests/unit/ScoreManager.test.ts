// ts-port/src/ScoreManager.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoreManager, IGameScopingContext } from '../../src/ScoreManager';
import { BallStatus } from '../../src/Ball';

// Mock IGameScoringContext
const createMockContext = (): IGameScoringContext => ({
  player1: { resetStatus: vi.fn() },
  player2: { resetStatus: vi.fn() },
  returnToDemo: vi.fn(),
});

describe('ScoreManager', () => {
  let context: IGameScopingContext;
  let scoreManager: ScoreManager;

  beforeEach(() => {
    context = createMockContext();
    // Vitest's JSDOM environment is empty by default, so create the scoreboard element for each test.
    document.body.innerHTML = '<div id="scoreboard"></div>';
    // Mock exitPointerLock as it's not implemented in JSDOM
    document.exitPointerLock = vi.fn();
    scoreManager = new ScoreManager(context);
    vi.useFakeTimers(); // Mock setTimeout
  });

  it('should initialize with scores at 0', () => {
    expect(scoreManager.score1).toBe(0);
    expect(scoreManager.score2).toBe(0);
    expect(scoreManager.isGameOver).toBe(false);
  });

  it('should reset scores and game state', () => {
    scoreManager.score1 = 5;
    scoreManager.score2 = 3;
    scoreManager.isGameOver = true;
    scoreManager.reset();
    expect(scoreManager.score1).toBe(0);
    expect(scoreManager.score2).toBe(0);
    expect(scoreManager.isGameOver).toBe(false);
  });

  it('should award a point to player 1 (human)', () => {
    scoreManager.awardPoint(BallStatus.IN_PLAY_TO_HUMAN); // A status that gives point to player 1
    expect(scoreManager.score1).toBe(1);
    expect(scoreManager.score2).toBe(0);
  });

  it('should award a point to player 2 (AI)', () => {
    scoreManager.awardPoint(BallStatus.IN_PLAY_TO_AI); // A status that gives point to AI
    expect(scoreManager.score1).toBe(0);
    expect(scoreManager.score2).toBe(1);
  });

  it('should not award points if the game is over', () => {
    scoreManager.isGameOver = true;
    scoreManager.awardPoint(BallStatus.IN_PLAY_TO_HUMAN);
    expect(scoreManager.score1).toBe(0);
    expect(scoreManager.score2).toBe(0);
  });

  it('should declare game over when a player reaches 11 points with a 2-point lead', () => {
    scoreManager.score1 = 10;
    scoreManager.score2 = 9;
    scoreManager.awardPoint(BallStatus.IN_PLAY_TO_HUMAN); // score -> 11-9
    expect(scoreManager.isGameOver).toBe(true);
    expect(document.getElementById('scoreboard')?.innerText).toBe('You Win!');
  });

  it('should not declare game over if score is 11 but lead is less than 2', () => {
    scoreManager.score1 = 10;
    scoreManager.score2 = 10;
    scoreManager.awardPoint(BallStatus.IN_PLAY_TO_HUMAN); // score -> 11-10
    expect(scoreManager.isGameOver).toBe(false);
  });

  it('should declare game over when score is 12-10', () => {
    scoreManager.score1 = 11;
    scoreManager.score2 = 10;
    scoreManager.awardPoint(BallStatus.IN_PLAY_TO_HUMAN); // score -> 12-10
    expect(scoreManager.isGameOver).toBe(true);
  });

  it('should call returnToDemo after a delay when the game ends', () => {
    scoreManager.score1 = 10;
    scoreManager.awardPoint(BallStatus.IN_PLAY_TO_HUMAN); // Game ends 11-0
    expect(context.returnToDemo).not.toHaveBeenCalled();
    vi.runAllTimers(); // Fast-forward time
    expect(context.returnToDemo).toHaveBeenCalled();
  });

  describe('getService logic for 11PTS game', () => {
    it('should give service to player 2 at 0-0', () => {
      // P2 serves (AI)
      expect(scoreManager.getService()).toBe(1);
    });

    it('should give service to player 1 at 2-0', () => {
      scoreManager.score1 = 2; // Total score 2, floor(2/2)%2=1 -> p1 serves
      // P1 serves (Human)
      expect(scoreManager.getService()).toBe(-1);
    });

    it('should alternate service every 1 point when score is 10-10', () => {
        scoreManager.score1 = 10;
        scoreManager.score2 = 10; // Total 20. (20 % 2 === 0 ? -1 : 1) => -1
        expect(scoreManager.getService()).toBe(-1);

        scoreManager.score1 = 11;
        scoreManager.score2 = 10; // Total 21. (21 % 2 === 1 ? -1 : 1) => 1
        expect(scoreManager.getService()).toBe(1);
    });
  });
});
