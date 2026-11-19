import { defineConfig } from 'vitest/config';

// the test files each start a real server on the same database: one after the other
export default defineConfig({ test: { fileParallelism: false } });
