# Testing Strategy

This project uses a dual-level testing strategy to ensure code quality and application stability.

- **Unit/Integration Tests:** Using [Vitest](https://vitest.dev/) to test individual modules and their interactions. This allows for fast, targeted testing of the core game logic without needing a browser.
- **End-to-End (E2E) Tests:** Using [Playwright](https://playwright.dev/) to simulate user interactions in a real browser. This ensures the application as a whole is functioning correctly, from the UI to the underlying logic.

All test commands should be run from the `ts-port/` directory.

## Running Unit Tests

Unit tests are located alongside the source files they test, with a `.test.ts` extension (e.g., `ScoreManager.test.ts`).

To run all unit tests once:
```bash
npm run test:unit
```

To run unit tests in watch mode, which is useful during development:
```bash
npm run test:unit -- --watch
```

To open the Vitest UI, which provides an interactive way to view test results:
```bash
npm run test:ui
```

## Running End-to-End Tests

E2E tests are located in the `ts-port/tests/` directory, with a `.spec.ts` extension. The configuration in `playwright.config.ts` will automatically start the Vite development server before running the tests.

To run all E2E tests:
```bash
npx playwright test
```

To view the HTML report of the last E2E test run:
```bash
npx playwright show-report
```

## Running All Tests

To run the entire test suite (both unit and E2E tests) sequentially, use the main test command. This is the command that should be run before committing changes to ensure everything is working correctly.

```bash
npm test
```
