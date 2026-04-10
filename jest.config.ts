import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { jsx: 'react-jsx', esModuleInterop: true },
    }],
  },
  projects: [
    // --- Unit tests ---
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/unit/**/*.test.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
      },
      collectCoverageFrom: [
        'src/lib/utils.ts',
        'src/lib/auth.ts',
        '!src/**/*.d.ts',
      ],
      coverageThreshold: {
        global: { branches: 70, functions: 75, lines: 75, statements: 75 },
      },
    },
    // --- Component tests ---
    {
      displayName: 'component',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/__tests__/component/**/*.test.tsx'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|scss)$': '<rootDir>/src/__tests__/__mocks__/styleMock.ts',
      },
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', esModuleInterop: true } }],
      },
      collectCoverageFrom: [
        'src/hooks/**/*.ts',
        '!src/**/*.d.ts',
      ],
    },
    // --- Integration tests ---
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
      },
      collectCoverageFrom: [
        'src/app/api/**/*.ts',
        '!src/**/*.d.ts',
      ],
      coverageThreshold: {
        global: { branches: 70, functions: 75, lines: 75, statements: 75 },
      },
    },
  ],
  // Used only when running all tests together (npm run test:coverage)
  collectCoverageFrom: [
    'src/lib/utils.ts',
    'src/lib/auth.ts',
    'src/hooks/**/*.ts',
    'src/app/api/**/*.ts',
    '!src/**/*.d.ts',
  ],
  // No global threshold here — each project enforces its own.
  // Global threshold was causing false failures when running a single suite.
  coverageReporters: ['text', 'lcov', 'html'],
};

export default config;