import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/**/*.ts"],
  format: "esm",
  // Bundle all node_modules into dist to minimize zip size on deployment.
  // Exclusions:
  //   argon2, @prisma/client — native binaries, must stay in node_modules
  //   @azure/functions — thin CJS wrapper around @azure/functions-core, which is
  //     injected by the Azure Functions host at runtime and is never in node_modules;
  //     bundling it causes an unresolvable require() at build time
  noExternal: [/^(?!(argon2|@prisma\/client|@azure\/functions))/],
  clean: true,
});
