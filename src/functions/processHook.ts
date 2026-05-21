import { app, InvocationContext } from "@azure/functions";
import { HookContext, HookType } from "../models/Hook";
import { Hook } from "../lib/Hook";
import { Medal } from "../lib/Medal";

// Ensure the queue exists before the Functions host begins polling it.
// Intentionally not awaited — creation completes well before the first poll cycle.
void Hook.ensureQueue();

// Register all hook handlers at module load time so they are available for
// every queue-triggered invocation of this function.
for (const type of Object.values(HookType)) {
  Hook.register(type, Medal.checkForDisbursement);
}

async function processHookHandler(
  message: unknown,
  context: InvocationContext
): Promise<void> {
  const hookContext = message as HookContext;

  if (!hookContext?.type || !hookContext?.userId) {
    context.error("[processHook] Invalid or missing hook context", {
      message,
    });
    return;
  }

  context.log("[processHook] processing", {
    type: hookContext.type,
    userId: hookContext.userId,
  });

  await Hook.run(hookContext);
}

app.storageQueue("processHook", {
  queueName: "hook-queue",
  connection: "AzureWebJobsStorage",
  handler: processHookHandler,
});
