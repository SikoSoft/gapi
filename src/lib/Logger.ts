import { InvocationContext } from "@azure/functions";

let _log = console.log.bind(console);
let _warn = console.warn.bind(console);
let _error = console.error.bind(console);

export const Logger = {
  setContext(context: InvocationContext) {
    _log = context.log.bind(context);
    _warn = context.warn.bind(context);
    _error = context.error.bind(context);
  },
  log: (...args: unknown[]) => _log(...args),
  warn: (...args: unknown[]) => _warn(...args),
  error: (...args: unknown[]) => _error(...args),
};
