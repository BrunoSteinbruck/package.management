import { defineConfig } from "vitest/config";

// Testes de unidade dos três apps e do shared, num runner só na raiz.
// Só código puro: nada aqui abre banco, Nest ou React Native.
export default defineConfig({
  test: {
    include: ["apps/**/*.spec.ts", "packages/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
