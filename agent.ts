import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { createBooking, quoteService, searchAvailability, trackRepair, type ServiceCategory } from "./mcp_server/index.js";

type AgentName = "intake_agent" | "matching_agent" | "booking_agent" | "repair_tracking_agent" | "safety_agent";

type ConciergeResponse = {
  route: AgentName[];
  intent: string;
  reply: string;
  data?: unknown;
};

const RequestSchema = z.object({ message: z.string().min(2).max(1000), customerAlias: z.string().min(2).max(40).default("demo-user") });

const categoryKeywords: Record<ServiceCategory, string[]> = {
  plumbing: ["plumb", "pipe", "leak", "tap", "faucet", "water"],
  electrical: ["electric", "wiring", "fan", "switch", "power", "inverter"],
  appliance_repair: ["ac", "fridge", "refrigerator", "washing", "appliance", "cooling"],
  cleaning: ["clean", "deep clean", "kitchen", "bathroom", "maid"],
  carpentry: ["carpenter", "wood", "door", "shelf", "furniture"]
};
const areas = ["Patia", "Khandagiri", "Jaydev Vihar", "Saheed Nagar", "Unit 9", "Nayapalli", "Old Town"];

function classify(message: string): { intent: "track" | "book" | "search" | "quote"; category: ServiceCategory; area: string; urgent: boolean; trackingId?: string } {
  const text = message.toLowerCase();
  const trackingId = message.match(/BBSR-[A-Z]{2,3}-\d{4}/)?.[0];
  const category = (Object.entries(categoryKeywords).find(([, words]) => words.some((word) => text.includes(word)))?.[0] ?? "appliance_repair") as ServiceCategory;
  const area = areas.find((candidate) => text.includes(candidate.toLowerCase())) ?? "Patia";
  const urgent = /urgent|emergency|today|asap|immediately/.test(text);
  const intent = trackingId ? "track" : /book|confirm|schedule/.test(text) ? "book" : /price|quote|cost|fee/.test(text) ? "quote" : "search";
  return trackingId ? { intent, category, area, urgent, trackingId } : { intent, category, area, urgent };
}

function safeSummary(message: string) {
  return message.replace(/[\r\n<>]/g, " ").slice(0, 220);
}

export async function runConciergeAgent(input: z.infer<typeof RequestSchema>): Promise<ConciergeResponse> {
  const request = RequestSchema.parse(input);
  const route: AgentName[] = ["intake_agent", "safety_agent"];
  const classification = classify(request.message);

  // SECURITY: The safety agent performs deterministic input minimisation before any tool call.
  // It strips HTML/control characters and never asks for Aadhaar, cards, passwords, or API keys.
  const issueSummary = safeSummary(request.message);

  if (classification.intent === "track" && classification.trackingId) {
    route.push("repair_tracking_agent");
    const status = trackRepair({ trackingId: classification.trackingId });
    return { route, intent: "repair_tracking", data: status, reply: `Repair ${status.trackingId} for your ${status.appliance} is currently '${status.state}'. ETA: ${status.eta}. Latest update: ${status.lastUpdate}` };
  }

  if (classification.intent === "quote") {
    route.push("matching_agent");
    const quote = quoteService({ category: classification.category, urgent: classification.urgent });
    return { route, intent: "service_quote", data: quote, reply: `For ${classification.category.replace("_", " ")} in Bhubaneswar, inspection starts at ₹${quote.inspectionFee}; typical work ranges ${quote.typicalRange}. Estimated minimum now: ₹${quote.estimatedMinimum}.` };
  }

  route.push("matching_agent");
  const matches = searchAvailability({ category: classification.category, area: classification.area, urgency: classification.urgent ? "urgent" : "normal" });
  if (matches.length === 0) {
    return { route, intent: "no_match", data: { category: classification.category, area: classification.area }, reply: `I could not find a verified ${classification.category.replace("_", " ")} professional in ${classification.area}. Try Patia, Khandagiri, Nayapalli, Saheed Nagar, Old Town, Unit 9, or Jaydev Vihar.` };
  }

  if (classification.intent === "book") {
    route.push("booking_agent");
    const best = matches[0];
    if (!best) throw new Error("Unexpected empty match list");
    const booking = createBooking({ professionalId: best.id, slot: best.slots[0]!, customerAlias: request.customerAlias, issueSummary });
    return { route, intent: "booking_confirmed", data: { booking, professional: best }, reply: `Booked ${booking.professionalName} for ${booking.slot}. Your booking ID is ${booking.bookingId}. ${booking.safetyNote}` };
  }

  const top = matches[0]!;
  return { route, intent: "professional_match", data: matches, reply: `Best match: ${top.name} (${top.rating}/5) in ${classification.area}. Next slots: ${top.slots.join(", ")}. Pricing: inspection ₹${top.pricing.inspectionFee}, typical ${top.pricing.typicalRange}. Say 'book' to confirm.` };
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "GET") {
    return sendJson(res, 200, { name: "Local Services Concierge Agent", example: "POST /api/agent { message: 'Book an urgent AC repair in Patia' }" });
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    const payload = RequestSchema.parse(JSON.parse(body || "{}"));
    return sendJson(res, 200, await runConciergeAgent(payload));
  } catch (error) {
    return sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid request" });
  }
}
