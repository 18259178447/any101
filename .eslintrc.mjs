export default {
  env: {
    es2022: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-constant-condition': ['error', { checkLoops: false }],
    'prefer-const': 'warn',
    'no-var': 'error',
    'object-shorthand': 'warn',
    'prefer-arrow-callback': 'warn',
  },
};