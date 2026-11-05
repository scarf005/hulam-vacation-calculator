import { defineConfig } from "vite-plus"

export default defineConfig({
  fmt: {
    semi: false,
    ignorePatterns: ["dist/**", "*.html"],
  },
  lint: {
    ignorePatterns: ["dist/**", "*.html"],
  },
})
