/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true, // `describe`, `it`, etc. をグローバルで利用可能にする
  },
});
