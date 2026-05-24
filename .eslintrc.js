module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'prettier/@typescript-eslint',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  rules: {
    // 由 @typescript-eslint 接管；若在 .ts 里再打开核心 no-unused-vars 会与 TS AST / 导出语义打架
    'no-unused-vars': 'off',
    /**
     * 当前栈为 ESLint 6 + @typescript-eslint ~4：`no-unused-vars` 仍会漏标记装饰器中使用的符号
     *（如 @Module/@Injectable/@Prop/@Catch），也会产生「导出类未使用」类误报。关闭后依赖 TS 编译与人工审查；
     * 若将来升级到 ESLint ≥ 8 + @typescript-eslint ≥ 6（及 flat config），再评估恢复为 warn。
     */
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    // v4 `@typescript-eslint/recommended` 默认开启；与 Nest 惯例（不写显式导出类型）对齐
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
