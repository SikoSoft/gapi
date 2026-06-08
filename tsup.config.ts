import { defineConfig } from "tsup";
import { builtinModules } from "module";

const externals = [
  "argon2",
  "@prisma/client",
  "@azure/functions",
  "@azure/storage-blob",
  "@azure/storage-queue",
  "@azure/storage-common",
  "node:",
  ...builtinModules.filter((m) => !m.startsWith("_")),
];

export default defineConfig({
  entry: ["./src/**/*.ts"],
  format: "esm",
  platform: "node",
  noExternal: [new RegExp(`^(?!(${externals.join("|")}))`)],
  banner: {
    js: `import { createRequire as __tsupCreateRequire } from 'module'; const require = __tsupCreateRequire(import.meta.url);`,
  },
  clean: true,
});
