module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-essential',
    '@vue/eslint-config-prettier'
  ],
  parser: 'vue-eslint-parser',
  rules: {
    'vue/multi-word-component-names': 'off'
  }
}
