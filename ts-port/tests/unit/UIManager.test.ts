import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UIManager } from '../../src/UIManager';

describe('UIManager', () => {
    let uiManager: UIManager;
    let mockDemoScreen: HTMLElement;
    let mockPauseScreen: HTMLElement;

    beforeEach(() => {
        // Create mock HTML elements using the jsdom environment provided by Vitest
        mockDemoScreen = document.createElement('div');
        mockPauseScreen = document.createElement('div');

        // Spy on the classList methods to track calls
        vi.spyOn(mockDemoScreen.classList, 'add');
        vi.spyOn(mockDemoScreen.classList, 'remove');
        vi.spyOn(mockPauseScreen.classList, 'add');
        vi.spyOn(mockPauseScreen.classList, 'remove');

        uiManager = new UIManager(mockDemoScreen, mockPauseScreen);
    });

    afterEach(() => {
        // Restore the original methods after each test
        vi.restoreAllMocks();
    });

    it('should show the demo screen and hide the pause screen', () => {
        uiManager.showDemoScreen();

        expect(mockDemoScreen.classList.remove).toHaveBeenCalledWith('hidden');
        expect(mockPauseScreen.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('should show the pause screen and hide the demo screen', () => {
        uiManager.showPauseScreen();

        expect(mockDemoScreen.classList.add).toHaveBeenCalledWith('hidden');
        expect(mockPauseScreen.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('should hide both the demo and pause screens for the game screen', () => {
        uiManager.showGameScreen();

        expect(mockDemoScreen.classList.add).toHaveBeenCalledWith('hidden');
        expect(mockPauseScreen.classList.add).toHaveBeenCalledWith('hidden');
    });
});
