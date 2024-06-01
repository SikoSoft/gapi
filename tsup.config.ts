import { defineConfig } from "tsup";

export default defineConfig({
  // Entry file(s) to start building from.
  entry: ["./src/**/*.ts"],
  // To output .mjs files
  format: "esm",
  // Optional: Include external packages inside the bundle. This was nescessary for a monorepo package in my case.
  noExternal: ["api-spec"],
  // Optional: Empty dist directory before build
  clean: true,
});
