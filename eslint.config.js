import globals from 'globals';

export default [{
  files: ['**/*.js'],
  ignores: ['node_modules/**', 'coverage/**'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
  rules: { 'no-console': ['warn', { allow: ['warn', 'error'] }], 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
}];
