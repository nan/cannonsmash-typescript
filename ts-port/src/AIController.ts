import * as THREE from 'three';
import { Ball } from './Ball';
import { Player } from './Player';
import {
    TABLE_HEIGHT, TABLE_LENGTH, TABLE_WIDTH,
    SWING_NORMAL, stype, TICK, SWING_DRIVE, SWING_CUT,
    AI_SERVE_STABLE_VELOCITY_THRESHOLD, AI_SERVE_POSITION_TOLERANCE,
    AI_SERVE_TARGET_DEPTH_DIVISOR, AI_SERVE_TARGET_X_RANDOM_FACTOR,
    AI_RALLY_TARGET_VELOCITY_ADJUST_HIGH_THRESHOLD, AI_RALLY_TARGET_VELOCITY_ADJUST_LOW_THRESHOLD,
    AI_RALLY_TARGET_VELOCITY_ADJUST_HIGH_DIVISOR, AI_RALLY_TARGET_VELOCITY_ADJUST_LOW_DIVISOR,
    AI_TRAJECTORY_THRESHOLD_SHORT, AI_TRAJECTORY_THRESHOLD_MEDIUM,
    AI_TARGET_DEPTH_SHORT_DIVISOR, AI_TARGET_DEPTH_MEDIUM_DIVISOR,
    AI_TARGET_DEPTH_DEEP_NUMERATOR, AI_TARGET_DEPTH_DEEP_DENOMINATOR,
    AI_TARGET_X_ZONE_FACTORS, AI_TARGET_X_MAX_FACTOR
} from './constants';
import type { Game } from './Game';
import { BallStatus } from './BallStatus';

/**
 * AIControllerクラスは、AIプレイヤーの思考と行動を管理します。
 * C++版のComControllerおよびComPenAttackControllerのロジックを移植したものです。
 */
export class AIController {
    private game: Game;
    private player: Player;
    private ball: Ball;
    private opponent: Player;

    // C++版の _prevBallstatus に相当。ボールの状態変化を検知するために使用。
    private prevBallStatus: number = 0;
    // C++版の _hitX に相当。予測したボールの打点（2Dベクトル）。
    private predictedHitPosition = new THREE.Vector2();

    // AIの挙動を制御する定数
    private readonly HOME_POSITION_X = 0.0;
    private readonly HOME_POSITION_Y = (TABLE_LENGTH / 2 + 0.5);
    private readonly RACKET_OFFSET_X = 0.3;
    private readonly MOVEMENT_ACCELERATION = 0.1;
    private readonly PLANTED_SWING_START_FRAME = 11;
    private readonly PLANTED_SWING_END_FRAME = 20;
    private readonly RALLY_MAX_SPEED = 5.0;
    private readonly POSITIONING_MAX_SPEED = 1.0;
    private readonly HITTING_ZONE_FAR_BOUNDARY = 0.3;
    private readonly HITTING_ZONE_NEAR_BOUNDARY = -0.6;
    private readonly WAIT_FOR_BETTER_SHOT_MARGIN = 0.01;

    constructor(game: Game, player: Player, ball: Ball, opponent: Player) {
        this.game = game;
        this.player = player;
        this.ball = ball;
        this.opponent = opponent;

        // 初期位置を設定
        this.predictedHitPosition.x = this.HOME_POSITION_X;
        this.predictedHitPosition.y = this.HOME_POSITION_Y * this.player.side;
    }

    /**
     * AIの思考ルーチンを毎フレーム実行します。
     * C++版の Think() メソッドに相当します。
     * @param deltaTime フレーム間の経過時間
     */
    public update(deltaTime: number, game: Game) { // game is passed here now
        // --- Serve Logic ---
        if (this.ball.status === BallStatus.WAITING_FOR_SERVE && game.getService() === this.player.side) {
            // 1. Set the target to the home position for serving. This ensures the AI
            // moves to the correct spot before attempting to serve.
            this.predictedHitPosition.x = this.HOME_POSITION_X;
            this.predictedHitPosition.y = this.HOME_POSITION_Y * this.player.side;

            // 2. Check if the AI has arrived at the serving position and is stable.
            const playerVel = this.player.velocity;
            const playerPos = this.player.mesh.position;
            const targetPos = this.predictedHitPosition;
            const idealServePosX = targetPos.x - this.RACKET_OFFSET_X * this.player.side;

            const isStable = Math.abs(playerVel.x) < AI_SERVE_STABLE_VELOCITY_THRESHOLD && Math.abs(playerVel.z) < AI_SERVE_STABLE_VELOCITY_THRESHOLD;
            const isAtPosition = Math.abs(playerPos.x - idealServePosX) < AI_SERVE_POSITION_TOLERANCE && Math.abs(playerPos.z - targetPos.y) < AI_SERVE_POSITION_TOLERANCE;

            // 3. If ready, perform the serve.
            if (isStable && isAtPosition && this.player.swing === 0) {
                // Set a specific target for the serve
                const targetX = (Math.random() - 0.5) * (TABLE_WIDTH * AI_SERVE_TARGET_X_RANDOM_FACTOR);
                const targetZ = (TABLE_LENGTH / AI_SERVE_TARGET_DEPTH_DIVISOR) * -this.player.side;
                this.player.targetPosition.set(targetX, targetZ);

                // Start a specific serve type, similar to C++'s StartServe(3)
                this.player.startServe(3);
                return; // Don't do anything else this frame
            }
        }


        // 1. 打点予測 (Hitarea)
        if (this.prevBallStatus !== this.ball.status && this.ball.status >= 0) {
            this.calculateHitArea();
            this.prevBallStatus = this.ball.status;
        }

        // 2. 移動とスイングの判断
        this._updateMovement();

        // 3. スイング開始の判断
        // player.canInitiateSwing() を使うことで、ボールがバウンドする前でもスイング準備に入れるようにする
        if (this.player.swing === 0 && this.player.canInitiateSwing(this.ball)) {
            this.trySwing();
        }
    }

    /**
     * AIプレイヤーの移動速度を計算し、プレイヤーオブジェクトの速度を更新する。
     * このメソッドは `update` から毎フレーム呼び出される。
     */
    private _updateMovement() {
        const playerPos = this.player.mesh.position;
        const playerVel = this.player.velocity;

        // ボールが返球されるまでのおおよその時間を計算 (C++: hitT)
        let timeToHit = -1.0;
        if (this.ball.velocity.z !== 0.0) {
            timeToHit = (this.predictedHitPosition.y - this.ball.mesh.position.z) / this.ball.velocity.z - 0.02;
        }

        // AIがラケットでボールを捉えるための、理想的なX座標を計算 (C++: mx)
        const racketOffsetX = this.RACKET_OFFSET_X * this.player.side;
        let idealRacketX;
        // C++: if ( theBall.GetStatus() == 8 || ... )
        if (this.ball.status === BallStatus.WAITING_FOR_SERVE) {
            // For serving, always use the forehand side for positioning.
            idealRacketX = playerPos.x + racketOffsetX;
        } else {
            const forehandDist = Math.abs(this.predictedHitPosition.x - (playerPos.x + racketOffsetX));
            const backhandDist = Math.abs(this.predictedHitPosition.x - (playerPos.x - racketOffsetX));
            idealRacketX = (forehandDist < backhandDist) ? (playerPos.x + racketOffsetX) : (playerPos.x - racketOffsetX);
        }

        // スイングの特定フレームでは、移動計算を停止して体を安定させる
        if (this.player.swing > this.PLANTED_SWING_START_FRAME && this.player.swing <= this.PLANTED_SWING_END_FRAME) {
            // no-op
        } else {
            if (timeToHit > 0.0) {
                // 【ラリー中の移動】予測時間に基づいて目標速度を計算し、そこに向けて加速する
                const targetVx = (this.predictedHitPosition.x - idealRacketX) / timeToHit;
                if (targetVx > playerVel.x + this.MOVEMENT_ACCELERATION) {
                    playerVel.x += this.MOVEMENT_ACCELERATION;
                } else if (targetVx < playerVel.x - this.MOVEMENT_ACCELERATION) {
                    playerVel.x -= this.MOVEMENT_ACCELERATION;
                } else {
                    playerVel.x = targetVx;
                }

                const targetVz = (this.predictedHitPosition.y - playerPos.z) / timeToHit;
                if (targetVz > playerVel.z + this.MOVEMENT_ACCELERATION) {
                    playerVel.z += this.MOVEMENT_ACCELERATION;
                } else if (targetVz < playerVel.z - this.MOVEMENT_ACCELERATION) {
                    playerVel.z -= this.MOVEMENT_ACCELERATION;
                } else {
                    playerVel.z = targetVz;
                }
            } else {
                // 【ポジショニング中の移動】カスタムブレーキロジックを用いて目標地点へ移動
                const distanceX = this.predictedHitPosition.x - idealRacketX;
                if (playerVel.x * Math.abs(playerVel.x * this.MOVEMENT_ACCELERATION) / 2 < distanceX) {
                    playerVel.x += this.MOVEMENT_ACCELERATION;
                } else {
                    playerVel.x -= this.MOVEMENT_ACCELERATION;
                }

                const distanceZ = this.predictedHitPosition.y - playerPos.z;
                if (playerVel.z * Math.abs(playerVel.z * this.MOVEMENT_ACCELERATION) / 2 < distanceZ) {
                    playerVel.z += this.MOVEMENT_ACCELERATION;
                } else {
                    playerVel.z -= this.MOVEMENT_ACCELERATION;
                }
            }
        }

        // 【動的な速度制限】状況に応じて最大速度を切り替える
        if (this.player.canInitiateSwing(this.ball)) {
            // ラリー中は素早く動く
            if (playerVel.lengthSq() > this.RALLY_MAX_SPEED * this.RALLY_MAX_SPEED) {
                playerVel.normalize().multiplyScalar(this.RALLY_MAX_SPEED);
            }
        } else {
            // サーブ待ちなどの位置調整中は、振動を防ぐために低速にする
            if (playerVel.lengthSq() > this.POSITIONING_MAX_SPEED * this.POSITIONING_MAX_SPEED) {
                playerVel.normalize().multiplyScalar(this.POSITIONING_MAX_SPEED);
            }
        }
    }

    /**
     * C++版のComPenAttackController::Think()内のスイング判断ロジックを移植したもの。
     * 未来予測を行い、適切なタイミングでスイングを開始する。
     */
    private trySwing() {
        // 1. Ask the player object to predict the best swing for the situation.
        const { swingType, spinCategory } = this.player.getPredictedSwing(this.ball);

        const swingParams = stype.get(swingType);
        if (!swingParams) return;

        const hitFrames = swingParams.hitStart;
        if (hitFrames <= 1) return; // Animation delay is required for this logic.

        // 2. Simulate the ball's state 'hitFrames' into the future.
        const simBall = this.ball.clone();
        for (let i = 0; i < hitFrames - 1; i++) {
            const oldPos = simBall.mesh.position.clone();
            simBall._updatePhysics(TICK);
            simBall.checkCollision(oldPos);
        }

        // 3. Predict the player's position 'hitFrames' into the future.
        const playerPos = this.player.mesh.position;
        const playerVel = this.player.velocity;
        const simPlayerPos = new THREE.Vector2(
            playerPos.x + playerVel.x * (hitFrames - 1) * TICK,
            playerPos.z + playerVel.z * (hitFrames - 1) * TICK,
        );

        // 4. Check if the ball will be in a hittable zone in the future.
        const futurePlayerBallZDiff = (simPlayerPos.y - simBall.mesh.position.z) * this.player.side;
        if (this.player.canHitBall(simBall) &&
            futurePlayerBallZDiff < this.HITTING_ZONE_FAR_BOUNDARY &&
            futurePlayerBallZDiff > this.HITTING_ZONE_NEAR_BOUNDARY) {

            // 5. Fine-tuning: check if waiting one more frame is better.
            const simBallNextFrame = simBall.clone();
            const oldPos = simBallNextFrame.mesh.position.clone();
            simBallNextFrame._updatePhysics(TICK);
            simBallNextFrame.checkCollision(oldPos);

            const simPlayerPosNextFrame = new THREE.Vector2(
                playerPos.x + playerVel.x * hitFrames * TICK,
                playerPos.z + playerVel.z * hitFrames * TICK,
            );
            const zDiffNextFrame = (simPlayerPosNextFrame.y - simBallNextFrame.mesh.position.z) * this.player.side;

            if (Math.abs(zDiffNextFrame) < Math.abs(futurePlayerBallZDiff) - this.WAIT_FOR_BETTER_SHOT_MARGIN) {
                return; // Wait for a better time.
            }

            // 6. Initiate the swing.
            this.setRallyTarget(simBall);
            this.player.startSwing(this.ball, spinCategory);
        }
    }

    /**
     * C++版の Hitarea に相当。
     * ボールの状況に応じて、AIが狙うべき打点を計算し、`predictedHitPosition`を更新する。
     */
    private calculateHitArea() {
        if (this.player.canInitiateSwing(this.ball)) {
            const top = this.getBallTop();
            if (top.maxHeight > 0) {
                this.predictedHitPosition.copy(top.position);
            }
        } else if (this.ball.status === BallStatus.WAITING_FOR_SERVE) {
            // Ball is ready for serve, but it's not our turn. Move to ready position.
            this.predictedHitPosition.x = this.HOME_POSITION_X;
            this.predictedHitPosition.y = this.HOME_POSITION_Y * this.player.side;
        } else if (this.ball.status <= BallStatus.SERVE_TO_HUMAN) { // Any in-play status
            // Rally is not in progress, return to home position.
            this.predictedHitPosition.x = this.HOME_POSITION_X;
            this.predictedHitPosition.y = this.HOME_POSITION_Y * this.player.side;
        }
    }

    /**
     * C++版の GetBallTop に相当。
     * 物理シミュレーションを行い、ボールが自コートでバウンドした後の最高到達点を予測する。
     * @returns ボールの最高到達点の高さと、その時の2D座標
     */
    private getBallTop(): { maxHeight: number; position: THREE.Vector2 } {
        const simBall = this.ball.clone();
        let maxHeight = -1.0;
        const peakPosition = new THREE.Vector2();

        // 最大500フレーム（10秒）先までシミュレーション
        for (let i = 0; i < 500; i++) {
            // ボールが自コートでバウンドした後の状態かチェック
            if ((simBall.status === BallStatus.RALLY_TO_AI && this.player.side === -1) ||
                (simBall.status === BallStatus.RALLY_TO_HUMAN && this.player.side === 1)) {
                // 最高到達点を更新
                if (simBall.mesh.position.y > maxHeight) {
                    maxHeight = simBall.mesh.position.y;
                    peakPosition.x = simBall.mesh.position.x;
                    peakPosition.y = simBall.mesh.position.z; // 2D座標のyは3Dのz
                }
            }
            // 1フレーム分の物理演算を進める
            const oldPos = simBall.mesh.position.clone();
            simBall._updatePhysics(0.02); // 50Hz
            simBall.checkCollision(oldPos);

            // ボールがデッド状態になったらシミュレーション終了
            if (simBall.status === -1) {
                break;
            }
        }
        return { maxHeight, position: peakPosition };
    }

    /**
     * C++版の `SetTargetX` および `Think` 内のラリー時のターゲット計算ロジックを移植。
     * ラリー中の返球先となる目標座標（X, Z）を相手コートに設定する。
     * @param simBall 予測に使用した未来のボールオブジェクト
     */
    private setRallyTarget(simBall: Ball) {
        // --- 1. Target X Calculation (based on SetTargetX) ---
        const width = TABLE_WIDTH / 2; // LEVEL_NORMAL相当
        const randIndex = Math.floor(Math.random() * AI_TARGET_X_ZONE_FACTORS.length);
        let targetX = width * AI_TARGET_X_ZONE_FACTORS[randIndex];

        const playerVelX = this.player.velocity.x;
        if (playerVelX > AI_RALLY_TARGET_VELOCITY_ADJUST_HIGH_THRESHOLD) {
            targetX += TABLE_WIDTH / AI_RALLY_TARGET_VELOCITY_ADJUST_HIGH_DIVISOR;
        } else if (playerVelX > AI_RALLY_TARGET_VELOCITY_ADJUST_LOW_THRESHOLD) {
            targetX += TABLE_WIDTH / AI_RALLY_TARGET_VELOCITY_ADJUST_LOW_DIVISOR;
        } else if (playerVelX < -AI_RALLY_TARGET_VELOCITY_ADJUST_HIGH_THRESHOLD) {
            targetX -= TABLE_WIDTH / AI_RALLY_TARGET_VELOCITY_ADJUST_HIGH_DIVISOR;
        } else if (playerVelX < -AI_RALLY_TARGET_VELOCITY_ADJUST_LOW_THRESHOLD) {
            targetX -= TABLE_WIDTH / AI_RALLY_TARGET_VELOCITY_ADJUST_LOW_DIVISOR;
        }

        // Clamp the target to be within the table bounds
        const maxTargetX = TABLE_WIDTH / 2 * AI_TARGET_X_MAX_FACTOR;
        if (targetX > maxTargetX) {
            targetX = maxTargetX;
        }
        if (targetX < -maxTargetX) {
            targetX = -maxTargetX;
        }


        // --- 2. Target Z Calculation (based on trajectory) ---
        let targetZ = this.player.targetPosition.y; // Get current target Z for the division
        const ballHeight = simBall.mesh.position.y;
        const ballZ = simBall.mesh.position.z;
        const side = this.player.side;
        const trajectoryRatio = (ballHeight - TABLE_HEIGHT) / Math.abs(ballZ - targetZ);

        if (trajectoryRatio < AI_TRAJECTORY_THRESHOLD_SHORT) {
            targetZ = (TABLE_LENGTH / AI_TARGET_DEPTH_SHORT_DIVISOR) * -side;
        } else if (trajectoryRatio < AI_TRAJECTORY_THRESHOLD_MEDIUM) {
            targetZ = (TABLE_LENGTH / AI_TARGET_DEPTH_MEDIUM_DIVISOR) * -side;
        } else {
            targetZ = (TABLE_LENGTH * AI_TARGET_DEPTH_DEEP_NUMERATOR / AI_TARGET_DEPTH_DEEP_DENOMINATOR) * -side;
        }

        this.player.targetPosition.set(targetX, targetZ);
    }
}
