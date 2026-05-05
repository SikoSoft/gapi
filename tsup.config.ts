import { defineConfig } from "tsup";
import { builtinModules } from "module";

const externals = [
  "argon2",
  "@prisma/client",
  "@azure/functions",
  "node:",
  ...builtinModules.filter((m) => !m.startsWith("_")),
];

export default defineConfig({
  entry: ["./src/**/*.ts"],
  format: "esm",
  platform: "node",
  noExternal: [new RegExp(`^(?!(${externals.join("|")}))`)],
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  clean: true,
});
