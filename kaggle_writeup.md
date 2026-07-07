# Kaggle Submission Report: Local Services Concierge Agent

## Problem Statement

Urban households often need help with urgent, small, local tasks: a leaking tap, a broken fan, a non-cooling AC, or a repair job already in progress. The search journey is fragmented. A user may ask a neighbour, browse multiple marketplaces, compare prices manually, call several technicians, and still lack confidence about availability or repair progress. For Bhubaneswar residents, the challenge is even more local: service quality and availability can vary significantly between Patia, Khandagiri, Nayapalli, Old Town, Unit 9, Saheed Nagar, and Jaydev Vihar.

This capstone implements a Local Services Concierge Agent that accepts natural language and turns it into an actionable service workflow. The agent can understand the requested service, infer urgency, find verified professionals, explain price expectations, schedule a booking, and track an existing repair. The demo intentionally uses mock data so judges can run it without credentials, external vendors, or paid APIs.

## Architecture

The system is organized around an ADK-style multi-agent pattern. Rather than one monolithic prompt, the application models separate responsibilities as specialized agents inside `agent.ts`. The intake agent extracts intent and entities. The safety agent validates and minimizes input. The matching agent queries trusted operational data. The booking agent confirms slots. The repair tracking agent retrieves state transitions.

The second pillar is the Model Context Protocol server in `mcp_server/index.ts`. It exposes service tools over a JSON interface and as direct TypeScript functions. This separation is important because real production agents should not invent prices, professional availability, or repair states. They should call controlled tools that enforce schemas and access policies. The mock MCP data includes professionals, service areas, ratings, slots, pricing bands, emergency surcharges, and repair status records.

The deployment pillar is Vercel. `vercel.json` maps `/api/agent` and `/api/mcp` to serverless TypeScript endpoints. `package.json` pins a modern Node runtime, strict TypeScript checks, and smoke tests. A reviewer can install dependencies, run the checks, and deploy immediately.

## The Build

The core build decision was to make the project robust without depending on a secret LLM key. Kaggle submissions should be reproducible, so the reasoning layer uses deterministic natural-language classification. This still demonstrates agent architecture because the routing, tool invocation, and response composition are explicit and inspectable. In a production version, the classifier can be replaced with Google ADK model calls while preserving the same sub-agent boundaries and MCP contracts.

The MCP server is intentionally defensive. Zod validates every request. Professional IDs must match the Bhubaneswar mock format. Tracking IDs must match the repair database pattern. Booking attempts fail if a professional or slot is invalid. The server returns no hidden internal fields and includes no credentials. Security comments are placed near the relevant code so judges can identify the rubric alignment quickly.

The user experience is designed for zero-shot natural language. If a user writes, “Find an urgent AC repair technician in Patia today,” the intake agent classifies the request as appliance repair, extracts Patia, marks the request urgent, and routes to matching. The matching agent asks the MCP layer for availability and returns the highest-rated verified professional with slots and pricing. If the user says, “Please book a plumber for a leaking tap in Khandagiri,” the flow continues into booking and returns a booking ID plus a safety note. If the user says, “Track BBSR-AC-7421,” the repair tracking agent retrieves the repair state and ETA.

This project is intentionally small enough to audit but complete enough to submit. It contains the code, deployment configuration, architecture documentation, diagrams, writeup, and video script. The result is a ready-to-submit capstone that demonstrates practical agent engineering: scoped tools, safe data access, multi-agent routing, and production deployment.

## Future Improvements

A real deployment would connect the MCP server to a vendor database, add authentication, integrate maps and travel-time estimates, and use a human-in-the-loop approval flow before payment. The multi-agent boundaries already support these upgrades. The matching agent can incorporate ranking features, the booking agent can manage payments and cancellations, and the tracking agent can subscribe to technician events. The current version provides the foundation without exposing users or judges to operational risk.

## Detailed System Design

The concierge is designed around the principle that a service marketplace agent should never blur reasoning with authority. Reasoning is used to understand a user's request and decide the next action. Authority comes from tools that own operational facts. This is why the code separates `agent.ts` from `mcp_server/index.ts`. The agent can infer that “my AC is not cooling in Patia” is an appliance repair request, but it must ask the MCP layer which professionals are verified, what slots are available, and what fees should be shown.

The intake step is intentionally transparent. It uses keyword and pattern matching so a judge can run the project without a model key and still see the full workflow. Categories cover plumbing, electrical work, appliance repair, cleaning, and carpentry. The area extractor recognizes common Bhubaneswar neighborhoods. The urgency detector recognizes words such as urgent, emergency, ASAP, immediately, and today. The tracking detector recognizes a structured tracking ID. These fields become the shared state passed to downstream agents.

The routing step is the heart of the ADK-style design. If a tracking ID is present, the request is routed directly to the repair tracking agent. If price words are present, the request is routed to the quote path. If booking words are present, the system performs matching first and then booking. Otherwise, it returns a ranked professional recommendation. This mirrors production agent orchestration: route first, call the smallest necessary tool set, and produce an answer grounded in returned data.

The safety step appears early because marketplace agents operate around homes, payments, and identity. Even in a mock project, the code demonstrates important habits. The request schema limits message size. The booking summary strips HTML-style characters and control characters. The tool schemas reject malformed IDs and invalid enum values. The response reminds users that the demo does not collect payment. Vercel response headers reduce browser-side risks. Most importantly, the repository includes no secrets, no API keys, and no hidden environment assumptions.

## MCP Server Details

The MCP server contains three mock datasets: verified professionals, pricing catalogs, and repair tracking states. The professional dataset includes category, service areas, rating, verification status, price band, available slots, and skills. The pricing catalog includes inspection fees, typical work ranges, and emergency surcharges. The repair dataset includes a state machine-like status, ETA, and human-readable update.

`searchAvailability` validates category, area, and urgency. It returns only verified professionals serving the requested area. It attaches pricing context so the agent can answer with both who and how much. `quoteService` is useful when a user is not ready to book and only asks for cost. `createBooking` checks that the professional exists and that the requested slot is one of the advertised slots. This prevents the booking agent from confirming impossible appointments. `trackRepair` validates the tracking ID format and returns only matching repair records.

This design is deliberately close to how a real MCP integration would evolve. The mock arrays could be replaced by a database, a CRM, or third-party marketplace APIs without rewriting the agent. The important contract is stable: tools accept validated JSON arguments and return structured data. The agent remains an orchestrator rather than a database owner.

## Deployability and Operations

The application is prepared for Vercel serverless deployment. `/api/agent` exposes the user-facing concierge endpoint. `/api/mcp` exposes the tool endpoint. The TypeScript build runs with strict mode, exact optional property types, and modern Node module resolution. A smoke test exercises search, booking, quote, and tracking scenarios. The deployment model is simple enough for judges: install dependencies, run `npm run check`, run `npm run test:smoke`, and deploy.

Operationally, the current demo is stateless. Bookings return a deterministic confirmation object with a generated ID, but they do not mutate the mock slot array. That is a conscious capstone choice: stateless serverless functions are easy to test and avoid accidental persistence. In production, booking state would move into a transactional database with idempotency keys, cancellation policies, technician acceptance, and customer notifications.

## Evaluation Against the Rubric

For the agent and multi-agent requirement, the submission includes named agents, explicit routing, and tool-backed task execution. For the MCP requirement, the submission provides a separate MCP-style server with tools for availability, pricing, booking, and repair tracking. For deployability, the project includes Vercel configuration, Node engine constraints, build scripts, and endpoint routing. For documentation, the README contains setup instructions, architecture notes, and Mermaid diagrams. For communication deliverables, the repository includes this writeup and a five-minute video script.

The submission is also designed to be judge-friendly. Comments in the code call out agent skills and security features. The data is local, so there is no account setup. The smoke test prints readable outputs. The endpoints can be invoked with curl or Vercel Dev. The entire repository is compact, but every required artifact is present.

## Limitations and Responsible Scope

The project should not be mistaken for a real emergency dispatch platform. It does not verify live technician identity, process payments, or guarantee arrival. It is a capstone prototype that demonstrates how such a system could be safely structured. A production rollout would need background checks, consent flows, data protection policies, audit logs, customer support escalation, payment compliance, and dispute resolution.

The deterministic classifier is also a deliberate compromise. It gives reproducible behavior with no external keys. A future version could use a hosted model through ADK, add embeddings for service taxonomy matching, and support multilingual Odia/Hindi/English requests. Because the present architecture already separates intake, routing, safety, matching, booking, and tracking, those upgrades can be introduced incrementally.

## Conclusion

The Local Services Concierge Agent solves a concrete everyday problem while showcasing practical AI engineering. It turns natural language into service actions, grounds responses in an MCP tool layer, and deploys as serverless APIs. It demonstrates that robust agent systems are not only about model intelligence; they are about boundaries, validation, orchestration, and trustworthy data access. For the Kaggle AI Agents Intensive Vibe Coding Capstone, this repository provides a complete, zero-shot, ready-to-submit package with code, documentation, diagrams, writeup, video script, tests, and deployment configuration.

## Example User Journeys

A homeowner with a leaking tap can type a short sentence instead of filling out a form. The intake agent maps “leaking tap” to plumbing and identifies the requested neighborhood if supplied. The matching agent then returns a professional who actually serves that neighborhood. The response includes the inspection fee and typical range so the user is not surprised later. If the user includes booking language, the booking agent chooses the top verified match and the earliest slot. The final answer is concise, but the returned JSON contains the full route and data for debugging.

A second user may have a refrigerator problem but only wants to know the likely cost. In that case, the quote path avoids unnecessary booking. This matters because good agents should not force a transaction when the user's intent is informational. The agent gives inspection fees, typical repair ranges, and urgent surcharge behavior. This creates trust and reduces support calls.

A third user may already have an appliance in repair. Instead of searching the marketplace again, the user can provide a tracking ID. The tracking agent bypasses matching and booking entirely, calls the repair status tool, and reports the current state. This shows that the concierge is not merely a lead-generation bot; it supports the service lifecycle after the appointment.

## Why This Architecture Is Extensible

The most important engineering quality is replaceability. The mock MCP tools are small, but their interfaces are the seams where real systems would connect. A professional availability database could replace the array used by `searchAvailability`. A pricing engine could replace the static catalog used by `quoteService`. A booking microservice could replace the deterministic confirmation in `createBooking`. A repair workshop dashboard could publish status updates consumed by `trackRepair`.

The agent would not need to change dramatically because it depends on capabilities rather than storage details. This is the same reason multi-agent boundaries matter. If the platform later adds negotiation, cancellation, technician chat, or multilingual support, each feature can be introduced as a new specialist or tool rather than a risky rewrite of the whole assistant.

## Reliability Choices

The project favors predictable execution. All examples can run offline after dependencies are installed. The smoke test covers each major path. TypeScript strictness catches schema and optional-property mistakes before deployment. The serverless handlers return JSON for both success and error states. The cache-control header prevents stale operational data from being reused by clients.

The code also avoids overclaiming. It does not pretend that mock data is live. It labels safety notes clearly. It does not store private customer information. These decisions are important for responsible AI submissions because a polished demo should still communicate its boundaries.
