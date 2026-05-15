module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:vue/vue3-essential",
    "@vue/eslint-config-prettier",
  ],
  parser: "vue-eslint-parser",
  globals: {
    process: "readonly",
    global: "readonly",
    navigator: "readonly",
  },
  rules: {
    "vue/multi-word-component-names": "off",
  },
};
