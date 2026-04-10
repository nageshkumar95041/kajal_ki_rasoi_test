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
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
      },
    }],
  },
  projects: [
    // --- Node environment for API / utility tests ---
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/__tests__/unit/**/*.test.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
      },
      // Unit tests only measure the lib files they actually test
      collectCoverageFrom: [
        'src/lib/utils.ts',
        'src/lib/auth.ts',
        '!src/**/*.d.ts',
      ],
      coverageThreshold: {
        global: {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },
    },
    // --- JSDOM environment for React component & hook tests ---
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
    // --- Integration tests (API route logic) ---
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
        global: {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },
    },
  ],
  // Global coverage — used when running ALL tests together (npm run test:coverage)
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/app/api/**/*.ts',
    'src/hooks/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
};

export default config;