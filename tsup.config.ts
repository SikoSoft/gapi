import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/**/*.ts"],
  format: "esm",
  noExternal: [/^(?!(argon2|@prisma\/client|@azure\/functions))/],
  clean: true,
});
