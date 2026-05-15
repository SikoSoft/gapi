import * as t from "io-ts";

export const frontEndLogSchema = t.intersection([
  t.type({
    type: t.union([t.literal("error"), t.literal("unhandledrejection")]),
    message: t.string,
    url: t.string,
    userAgent: t.string,
    timestamp: t.number,
  }),
  t.partial({
    stack: t.string,
    source: t.string,
    lineno: t.number,
    colno: t.number,
  }),
]);

export type FrontEndLogPayload = t.TypeOf<typeof frontEndLogSchema>;
