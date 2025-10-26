# CannonSmash (TypeScript Port)

これは、C++で実装された3D卓球ゲーム「CannonSmash」のTypeScript移植版です。

## プロジェクトの目的

このプロジェクトの主な目的は、オリジナルのC++版 `cannonsmash` をTypeScriptに移植することです。

### 主要な目標

1.  **言語の移植:** C++のコードベースを、モダンで慣用的なTypeScriptに翻訳します。
2.  **機能の同等性:** TypeScript版が、オリジナルのC++版ゲームのすべての機能を持つようにします。
3.  **保守性:** クリーンで、十分に文書化され、テスト可能なTypeScriptコードを記述します。

## プロジェクトの実行方法

1.  `ts-port` ディレクトリに移動します:
    ```bash
    cd ts-port
    ```
2.  依存関係をインストールします:
    ```bash
    npm install
    ```
3.  開発サーバーを起動します:
    ```bash
    npm run dev
    ```
4.  ブラウザで表示されたURL（通常は `http://localhost:5173` など）にアクセスします。

## 主要技術スタック

-   **TypeScript**: 主な開発言語です。
-   **Vite**: 開発サーバーとビルドツールとして使用します。
-   **Three.js**: 3Dグラフィックスのレンダリングに使用します。

## オリジナル版

オリジナルのC++版ソースコードは以下のリポジトリで確認できます。

[https://github.com/nan/cannonsmash](https://github.com/nan/cannonsmash)
