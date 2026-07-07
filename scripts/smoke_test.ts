import { runConciergeAgent } from "../agent.js";

const scenarios = [
  "Find an urgent AC repair technician in Patia today",
  "Please book a plumber for a leaking tap in Khandagiri",
  "What is the price for electrical fan installation?",
  "Track BBSR-AC-7421"
];

for (const message of scenarios) {
  const result = await runConciergeAgent({ message, customerAlias: "smoke-test" });
  if (!result.reply || result.route.length < 2) throw new Error(`Bad response for: ${message}`);
  console.log(`${result.intent}: ${result.reply}`);
}
