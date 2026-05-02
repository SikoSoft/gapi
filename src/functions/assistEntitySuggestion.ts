import { app, InvocationContext, Timer } from "@azure/functions";
import { Assist } from "../lib/Assist";

export async function assistEntitySuggestion(
  _myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("Assist entity suggestion timer triggered");

  const result = await Assist.getListConfigSuggestions();

  if (result.isErr()) {
    context.error("Failed to get list config suggestions:", result.error);
    return;
  }

  context.log("Assist entity suggestions completed successfully");
}

app.timer("assistEntitySuggestion", {
  schedule: "0 0 0,12 * * *",
  handler: assistEntitySuggestion,
});
