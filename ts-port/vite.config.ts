/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: false,
    include: ['tests/unit/**/*.test.ts'],
  },
});
