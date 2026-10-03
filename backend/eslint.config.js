import tseslint from "typescript-eslint";
export default [
  { ignores: ["src/generated/**"] },
  {
    files: ["src/**/*.ts", "src/**/*.mts", "src/**/*.tsx"],
    languageOptions: { parser: tseslint.parser },
    rules: {
      "no-debugger": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-constant-binary-expression": "error",
      "no-sparse-arrays": "error",
      "constructor-super": "error",
      "valid-typeof": "error",
    },
  },
];
