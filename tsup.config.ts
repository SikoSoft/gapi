import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/**/*.ts"],
  format: "esm",
  // Bundle all node_modules into dist to minimize zip size on deployment.
  // argon2 and @prisma/client are excluded because they contain native binaries
  // that must remain in node_modules as platform-specific files.
  noExternal: [/.*/],
  external: ["argon2", "@prisma/client"],
  clean: true,
});
