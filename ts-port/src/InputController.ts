// ts-port/src/InputController.ts

import { inputManager } from './InputManager';
import { TABLE_WIDTH, TABLE_LENGTH } from './constants';
import { BallStatus } from './Ball';
import type { Player } from './Player';
import type { Ball } from './Ball';

// An interface to define the dependencies InputController has on the main Game class.
export interface IGameInputContext {
    player1: Player;
    ball: Ball;
    getService: () => number;
}

// --- Keyboard Targeting Constants ---
const KEY_MAP_X: { [key: string]: number } = {
    '1': -TABLE_WIDTH / 2 * 0.9, 'q': -TABLE_WIDTH / 2 * 0.9, 'a': -TABLE_WIDTH / 2 * 0.9, 'z': -TABLE_WIDTH / 2 * 0.9,
    '2': -TABLE_WIDTH / 2 * 0.9, 'w': -TABLE_WIDTH / 2 * 0.9, 's': -TABLE_WIDTH / 2 * 0.9, 'x': -TABLE_WIDTH / 2 * 0.9,
    '3': -TABLE_WIDTH / 2 * 0.9,
    'e': -TABLE_WIDTH / 2 * 0.75,
    'd': -TABLE_WIDTH / 2 * 0.6,
    '4': -TABLE_WIDTH / 2 * 0.45, 'c': -TABLE_WIDTH / 2 * 0.45,
    'r': -TABLE_WIDTH / 2 * 0.3,
    'f': -TABLE_WIDTH / 2 * 0.15,
    '5': 0, 'v': 0,
    't': TABLE_WIDTH / 2 * 0.15,
    'g': TABLE_WIDTH / 2 * 0.3,
    '6': TABLE_WIDTH / 2 * 0.45, 'b': TABLE_WIDTH / 2 * 0.45,
    'y': TABLE_WIDTH / 2 * 0.6,
    'h': TABLE_WIDTH / 2 * 0.75,
    '7': TABLE_WIDTH / 2 * 0.9, 'n': TABLE_WIDTH / 2 * 0.9, 'u': TABLE_WIDTH / 2 * 0.9, 'j': TABLE_WIDTH / 2 * 0.9,
    '8': TABLE_WIDTH / 2 * 0.9, 'm': TABLE_WIDTH / 2 * 0.9, 'i': TABLE_WIDTH / 2 * 0.9, 'k': TABLE_WIDTH / 2 * 0.9,
    '9': TABLE_WIDTH / 2 * 0.9, ',': TABLE_WIDTH / 2 * 0.9, 'o': TABLE_WIDTH / 2 * 0.9, 'l': TABLE_WIDTH / 2 * 0.9,
    '0': TABLE_WIDTH / 2 * 0.9, '.': TABLE_WIDTH / 2 * 0.9, 'p': TABLE_WIDTH / 2 * 0.9, ';': TABLE_WIDTH / 2 * 0.9,
};

const KEY_MAP_Y: { [key: string]: number } = {
    '1': TABLE_LENGTH / 12 * 5, '2': TABLE_LENGTH / 12 * 5, '3': TABLE_LENGTH / 12 * 5, '4': TABLE_LENGTH / 12 * 5, '5': TABLE_LENGTH / 12 * 5, '6': TABLE_LENGTH / 12 * 5, '7': TABLE_LENGTH / 12 * 5, '8': TABLE_LENGTH / 12 * 5, '9': TABLE_LENGTH / 12 * 5, '0': TABLE_LENGTH / 12 * 5,
    'q': TABLE_LENGTH / 12 * 4, 'w': TABLE_LENGTH / 12 * 4, 'e': TABLE_LENGTH / 12 * 4, 'r': TABLE_LENGTH / 12 * 4, 't': TABLE_LENGTH / 12 * 4, 'y': TABLE_LENGTH / 12 * 4, 'u': TABLE_LENGTH / 12 * 4, 'i': TABLE_LENGTH / 12 * 4, 'o': TABLE_LENGTH / 12 * 4, 'p': TABLE_LENGTH / 12 * 4,
    'a': TABLE_LENGTH / 12 * 3, 's': TABLE_LENGTH / 12 * 3, 'd': TABLE_LENGTH / 12 * 3, 'f': TABLE_LENGTH / 12 * 3, 'g': TABLE_LENGTH / 12 * 3, 'h': TABLE_LENGTH / 12 * 3, 'j': TABLE_LENGTH / 12 * 3, 'k': TABLE_LENGTH / 12 * 3, 'l': TABLE_LENGTH / 12 * 3, ';': TABLE_LENGTH / 12 * 3,
    'z': TABLE_LENGTH / 12 * 2, 'x': TABLE_LENGTH / 12 * 2, 'c': TABLE_LENGTH / 12 * 2, 'v': TABLE_LENGTH / 12 * 2, 'b': TABLE_LENGTH / 12 * 2, 'n': TABLE_LENGTH / 12 * 2, 'm': TABLE_LENGTH / 12 * 2, ',': TABLE_LENGTH / 12 * 2, '.': TABLE_LENGTH / 12 * 2,
};


export class InputController {
    private context: IGameInputContext;

    constructor(context: IGameInputContext) {
        this.context = context;
    }

    public handleInput() {
        const { player1, ball } = this.context;

        // --- Serve controls ---
        if (inputManager.isKeyJustPressed(' ')) {
            player1.changeServeType();
        }

        if (ball.status === BallStatus.WAITING_FOR_SERVE && this.context.getService() === player1.side) {
            if (inputManager.isMouseButtonJustPressed(0)) { // Left click
                player1.startServe(1);
            } else if (inputManager.isMouseButtonJustPressed(1)) { // Middle click
                player1.startServe(2);
            } else if (inputManager.isMouseButtonJustPressed(2)) { // Right click
                player1.startServe(3);
            }
        } else {
            // --- Rally hit controls ---
            if (player1.isInBackswing) {
                if (
                    inputManager.isMouseButtonJustPressed(0) || // Left click
                    inputManager.isMouseButtonJustPressed(1) || // Middle click
                    inputManager.isMouseButtonJustPressed(2)    // Right click
                ) {
                    player1.startForwardswing();
                }
            }
        }

        // --- Target controls ---
        const side = -1; // Target opponent's side
        let targetX = player1.targetPosition.x;
        let targetY = player1.targetPosition.y;
        let targetUpdated = false;

        for (const key in KEY_MAP_X) {
            if (inputManager.isKeyPressed(key)) {
                targetX = KEY_MAP_X[key];
                targetUpdated = true;
                break;
            }
        }
        for (const key in KEY_MAP_Y) {
            if (inputManager.isKeyPressed(key)) {
                targetY = KEY_MAP_Y[key] * side;
                targetUpdated = true;
                break;
            }
        }

        if (targetUpdated) {
            player1.targetPosition.set(targetX, targetY);
        }
    }
}
