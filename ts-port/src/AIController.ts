import * as THREE from 'three';
import { Ball } from './Ball';
import { Player } from './Player';
import { TABLE_LENGTH } from './constants';

/**
 * AIControllerクラスは、AIプレイヤーの思考と行動を管理します。
 * C++版のComControllerおよびComPenAttackControllerのロジックを移植したものです。
 */
export class AIController {
    private player: Player;
    private ball: Ball;
    private opponent: Player;

    // C++版の _prevBallstatus に相当。ボールの状態変化を検知するために使用。
    private prevBallStatus: number = 0;
    // C++版の _hitX に相当。予測したボールの打点（2Dベクトル）。
    private predictedHitPosition = new THREE.Vector2();

    // AIのホームポジション（待機位置）
    private readonly HOME_POSITION_X = 0.0;
    private readonly HOME_POSITION_Y = -(TABLE_LENGTH / 2 + 0.5);

    constructor(player: Player, ball: Ball, opponent: Player) {
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
    public update(deltaTime: number) {
        // 1. 打点予測 (Hitarea)
        if (this.prevBallStatus !== this.ball.status && this.ball.status >= 0) {
            this.calculateHitArea();
            this.prevBallStatus = this.ball.status;
        }

        // 2. 移動 (Movement) & 3. スイング (Swing)
        const ballPos = this.ball.mesh.position;
        const ballVel = this.ball.velocity;
        const playerPos = this.player.mesh.position;
        const playerVel = this.player.velocity;

        // C++: hitT = (_hitX[1] - theBall.GetX()[1])/theBall.GetV()[1]-TICK;
        // 2Dのyは3Dのzに対応
        let hitT = -1.0;
        if (ballVel.z !== 0.0) {
            hitT = (this.predictedHitPosition.y - ballPos.z) / ballVel.z - 0.02;
        }

        // C++: mx = m_parent->GetX()[0]+m_parent->GetSide()*0.3; (or -0.3)
        // 理想的なラケットのX座標
        const racketOffsetX = 0.3 * this.player.side;
        const forehandDist = Math.abs(this.predictedHitPosition.x - (playerPos.x + racketOffsetX));
        const backhandDist = Math.abs(this.predictedHitPosition.x - (playerPos.x - racketOffsetX));
        const idealRacketX = (forehandDist < backhandDist) ? (playerPos.x + racketOffsetX) : (playerPos.x - racketOffsetX);


        if (this.player.swing > 10 && this.player.swing <= 20) {
            // スイング中は移動ロジックを適用しない
        } else {
            if (hitT > 0.0) {
                let vx = (this.predictedHitPosition.x - idealRacketX) / hitT;
                playerVel.x = THREE.MathUtils.damp(playerVel.x, vx, 0.1, deltaTime);

                let vz = (this.predictedHitPosition.y - playerPos.z) / hitT;
                playerVel.z = THREE.MathUtils.damp(playerVel.z, vz, 0.1, deltaTime);
            } else {
                // ボールが通り過ぎた場合など、単純に目標に向かう
                let vx = (this.predictedHitPosition.x - idealRacketX > 0) ? 1 : -1;
                playerVel.x = THREE.MathUtils.damp(playerVel.x, vx, 0.1, deltaTime);
            }
        }

        // 速度制限
        const maxSpeed = 5.0;
        if (playerVel.length() > maxSpeed) {
            playerVel.normalize().multiplyScalar(maxSpeed);
        }

        // スイング開始の判断
        // C++: if ( fabs( theBall.GetX()[1]+theBall.GetV()[1]*0.1 - _hitX[1] ) < 0.2 ...
        if (Math.abs(ballPos.z + ballVel.z * 0.1 - this.predictedHitPosition.y) < 0.2 && this.player.swing === 0) {
            if (this.player.canHitBall(this.ball)) {
                // 返球の目標地点を設定
                this.setTarget();

                // フォアかバックかを判断
                const swingSide = (playerPos.x - ballPos.x) * this.player.side < 0; // true:フォア, false:バック
                const spinCategory = swingSide ? 3 : 1;

                this.player.startSwing(spinCategory);
            }
        }
    }

    /**
     * C++版の Hitarea に相当。
     * ボールの状況に応じて、AIが狙うべき打点を計算し、`predictedHitPosition`を更新する。
     */
    private calculateHitArea() {
        if (this.isOpponentHit()) {
            const top = this.getBallTop();
            if (top.maxHeight > 0) {
                this.predictedHitPosition.copy(top.position);
            }
        } else if (this.ball.status === 8) {
            // サーブを待っている状態。相手がサーブ権を持っているなら、待機位置に移動。
            // TODO: Gameクラスからサーブ権情報を取得する必要がある
            // if (game.getService() !== this.player.side) {
                 this.predictedHitPosition.x = this.HOME_POSITION_X;
                 this.predictedHitPosition.y = this.HOME_POSITION_Y * this.player.side;
            // }
        } else if (this.ball.status < 6) {
            // ラリーが続いていない場合、ホームポジションに戻る
            this.predictedHitPosition.x = this.HOME_POSITION_X;
            this.predictedHitPosition.y = this.HOME_POSITION_Y * this.player.side;
        }
    }

    /**
     * C++版の isOpponentHit に相当。
     * ボールが相手プレイヤーから打たれた状態かどうかを判定する。
     * @returns 相手が打ったボールであればtrue
     */
    private isOpponentHit(): boolean {
        const status = this.ball.status;
        const side = this.player.side;
        // 相手が打った後、自コートに向かっている状態
        if ((status === 0 && side === -1) || (status === 2 && side === 1)) {
            return true;
        }
        // 相手が打った後、ネットを越えて自コートでバウンドした状態
        if ((status === 1 && side === -1) || (status === 3 && side === 1)) {
            return true;
        }
        return false;
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
            if ((simBall.status === 1 && this.player.side === -1) ||
                (simBall.status === 3 && this.player.side === 1)) {
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
     * C++版の SetTargetX に相当。
     * AIの返球先となる目標座標を相手コートに設定する。
     */
    private setTarget() {
        // 相手コートのX座標をランダムに決定
        // TABLE_WIDTH / 2 * 0.9 とすることで、少し内側を狙う
        const targetX = (Math.random() - 0.5) * (TABLE_WIDTH * 0.9);

        // 相手コートのZ座標をランダムに決定
        // sideが-1なら、相手コートは正のZ方向。0からTABLE_LENGTH/2の間。
        // 0.25から0.75を掛けることで、ネット際やエンドライン際を避ける。
        const targetZ = (TABLE_LENGTH / 2) * (0.25 + Math.random() * 0.5) * -this.player.side;

        this.player.targetPosition.set(targetX, targetZ);
    }
}
