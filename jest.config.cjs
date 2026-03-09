/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/packages/**/*.test.ts"],
  moduleNameMapper: {
    "^@caseworkbench/core$": "<rootDir>/packages/core/src/index.ts"
  },
  transform: {
    "^.+\\.ts$": [require.resolve("ts-jest"), { tsconfig: "<rootDir>/tsconfig.base.json" }]
  }
};
