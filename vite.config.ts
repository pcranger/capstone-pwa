import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "react-native": fileURLToPath(
        new URL("./src/platform/native.ts", import.meta.url),
      ),
      "react-native-safe-area-context": fileURLToPath(
        new URL("./src/platform/safeArea.tsx", import.meta.url),
      ),
      "@react-native-community/slider": fileURLToPath(
        new URL("./src/platform/slider.tsx", import.meta.url),
      ),
    },
  },
  worker: { format: 'es' },
  define: { __DEV__: false },
});
