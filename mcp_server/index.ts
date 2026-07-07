import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";

export type ServiceCategory = "plumbing" | "electrical" | "appliance_repair" | "cleaning" | "carpentry";

type Professional = {
  id: string;
  name: string;
  category: ServiceCategory;
  areas: string[];
  rating: number;
  verified: boolean;
  priceBand: "budget" | "standard" | "premium";
  slots: string[];
  skills: string[];
};

type RepairStatus = {
  trackingId: string;
  customerAlias: string;
  appliance: string;
  state: "received" | "diagnosing" | "parts_ordered" | "repairing" | "quality_check" | "out_for_delivery" | "completed";
  eta: string;
  lastUpdate: string;
};

const professionals: Professional[] = [
  { id: "PRO-BBSR-101", name: "Utkal PipeCare", category: "plumbing", areas: ["Patia", "Khandagiri", "Jaydev Vihar"], rating: 4.8, verified: true, priceBand: "standard", slots: ["2026-07-08T10:00:00+05:30", "2026-07-08T16:00:00+05:30"], skills: ["leak repair", "bathroom fitting", "water tank"] },
  { id: "PRO-BBSR-204", name: "SmartSpark Electricals", category: "electrical", areas: ["Saheed Nagar", "Unit 9", "Patia"], rating: 4.7, verified: true, priceBand: "standard", slots: ["2026-07-08T09:30:00+05:30", "2026-07-09T14:00:00+05:30"], skills: ["wiring", "inverter", "fan installation"] },
  { id: "PRO-BBSR-309", name: "ChillFix Appliances", category: "appliance_repair", areas: ["Nayapalli", "Patia", "Old Town"], rating: 4.9, verified: true, priceBand: "premium", slots: ["2026-07-08T12:00:00+05:30", "2026-07-10T11:00:00+05:30"], skills: ["ac", "refrigerator", "washing machine"] },
  { id: "PRO-BBSR-412", name: "GreenHome Cleaning", category: "cleaning", areas: ["Khandagiri", "Nayapalli", "Saheed Nagar"], rating: 4.6, verified: true, priceBand: "budget", slots: ["2026-07-08T08:00:00+05:30", "2026-07-09T08:00:00+05:30"], skills: ["deep cleaning", "kitchen", "bathroom"] },
  { id: "PRO-BBSR-515", name: "Odisha WoodWorks", category: "carpentry", areas: ["Old Town", "Jaydev Vihar", "Unit 9"], rating: 4.5, verified: true, priceBand: "standard", slots: ["2026-07-09T10:00:00+05:30", "2026-07-10T15:00:00+05:30"], skills: ["door repair", "modular furniture", "shelves"] }
];

const priceCatalog: Record<ServiceCategory, { inspectionFee: number; typicalRange: string; emergencySurcharge: number }> = {
  plumbing: { inspectionFee: 149, typicalRange: "₹300-₹1,500", emergencySurcharge: 250 },
  electrical: { inspectionFee: 179, typicalRange: "₹350-₹2,000", emergencySurcharge: 300 },
  appliance_repair: { inspectionFee: 249, typicalRange: "₹600-₹4,500", emergencySurcharge: 400 },
  cleaning: { inspectionFee: 99, typicalRange: "₹499-₹2,999", emergencySurcharge: 200 },
  carpentry: { inspectionFee: 199, typicalRange: "₹500-₹5,000", emergencySurcharge: 300 }
};

const repairs: RepairStatus[] = [
  { trackingId: "BBSR-AC-7421", customerAlias: "demo-user", appliance: "split AC", state: "parts_ordered", eta: "2026-07-09T18:00:00+05:30", lastUpdate: "Compressor capacitor ordered from Cuttack warehouse." },
  { trackingId: "BBSR-WM-8842", customerAlias: "demo-user", appliance: "washing machine", state: "quality_check", eta: "2026-07-08T17:00:00+05:30", lastUpdate: "Drum belt replaced; technician is running final spin test." }
];

const SearchSchema = z.object({ category: z.enum(["plumbing", "electrical", "appliance_repair", "cleaning", "carpentry"]), area: z.string().min(2).max(40), urgency: z.enum(["normal", "urgent"]).default("normal") });
const BookingSchema = z.object({ professionalId: z.string().regex(/^PRO-BBSR-\d{3}$/), slot: z.string().datetime({ offset: true }), customerAlias: z.string().min(2).max(40), issueSummary: z.string().min(5).max(240) });
const TrackingSchema = z.object({ trackingId: z.string().regex(/^BBSR-[A-Z]{2,3}-\d{4}$/) });

export function searchAvailability(input: z.infer<typeof SearchSchema>) {
  const args = SearchSchema.parse(input);
  return professionals
    .filter((pro) => pro.category === args.category && pro.verified && pro.areas.some((a) => a.toLowerCase() === args.area.toLowerCase()))
    .map((pro) => ({ ...pro, pricing: priceCatalog[pro.category], urgencyNote: args.urgency === "urgent" ? `Emergency surcharge ₹${priceCatalog[pro.category].emergencySurcharge} may apply.` : "No emergency surcharge." }))
    .sort((a, b) => b.rating - a.rating);
}

export function quoteService(input: Pick<z.infer<typeof SearchSchema>, "category"> & { urgent?: boolean }) {
  const category = SearchSchema.shape.category.parse(input.category);
  const catalog = priceCatalog[category];
  return { category, ...catalog, estimatedMinimum: catalog.inspectionFee + (input.urgent ? catalog.emergencySurcharge : 0), currency: "INR" };
}

export function createBooking(input: z.infer<typeof BookingSchema>) {
  const args = BookingSchema.parse(input);
  const pro = professionals.find((candidate) => candidate.id === args.professionalId);
  if (!pro) throw new Error("Professional not found");
  if (!pro.slots.includes(args.slot)) throw new Error("Selected slot is unavailable");
  return { bookingId: `BOOK-${Date.now().toString(36).toUpperCase()}`, professionalName: pro.name, slot: args.slot, status: "confirmed", safetyNote: "Share only the booking ID with the professional; no payment is collected by this demo agent." };
}

export function trackRepair(input: z.infer<typeof TrackingSchema>) {
  const args = TrackingSchema.parse(input);
  const status = repairs.find((repair) => repair.trackingId === args.trackingId);
  if (!status) throw new Error("Tracking ID not found in mock repair database");
  return status;
}

const toolHandlers = { searchAvailability, quoteService, createBooking, trackRepair } as const;

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "GET") {
    return sendJson(res, 200, { server: "bhubaneswar-local-services-mcp", protocol: "MCP-style JSON tools", tools: Object.keys(toolHandlers) });
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    const parsed = z.object({ tool: z.enum(["searchAvailability", "quoteService", "createBooking", "trackRepair"]), arguments: z.record(z.unknown()).default({}) }).parse(JSON.parse(body || "{}"));
    const result = toolHandlers[parsed.tool](parsed.arguments as never);
    return sendJson(res, 200, { ok: true, tool: parsed.tool, result });
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Invalid MCP request" });
  }
}
