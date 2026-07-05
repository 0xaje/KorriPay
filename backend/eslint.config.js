import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  {
    plugins: {
      import: importPlugin
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly'
      }
    },
    rules: {
      // ── Possible Errors ──────────────────────────────────────────────────
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',               // backend uses console logging

      // ── Best Practices ───────────────────────────────────────────────────
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-await': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',

      // ── Security Rules ───────────────────────────────────────────────────
      'no-prototype-builtins': 'warn',

      // ── Import rules ─────────────────────────────────────────────────────
      'import/no-duplicates': 'error',

      // ── Style (non-blocking) ─────────────────────────────────────────────
      'semi': ['warn', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }]
    },
    ignores: [
      'node_modules/**',
      'coverage/**',
      'scratch/**',
      'test/**'
    ]
  }
];
