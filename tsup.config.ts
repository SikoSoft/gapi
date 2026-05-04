import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/**/*.ts"],
  format: "esm",
  platform: "node",
  noExternal: [/^(?!(argon2|@prisma\/client|@azure\/functions))/],
  clean: true,
});
