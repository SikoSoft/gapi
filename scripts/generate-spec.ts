import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { writeFileSync } from "fs";
import { resolve } from "path";

// Must be called before any Zod schemas are instantiated (Zod v4 adds .openapi()
// as an own property at schema creation time, not via prototype chain).
extendZodWithOpenApi(z);

// Dynamic require so registry.ts (and its model imports) load AFTER the call above.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generateDocument } = require("../src/openapi/registry") as typeof import("../src/openapi/registry");

const document = generateDocument();
const outPath = resolve(process.cwd(), "openapi.json");
writeFileSync(outPath, JSON.stringify(document, null, 2));
console.log(`OpenAPI spec written to ${outPath}`);
