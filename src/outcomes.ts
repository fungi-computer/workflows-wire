import * as z from "zod";
import { appCapabilityIds } from "@fungi.computer/puffball";

export const workflowIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);

const identity = z.string().min(1).max(256);
const refusal = z.strictObject({ error: identity });

/** What the palette shows before a method's ports are ever fetched. */
const methodSummarySchema = z.strictObject({
  pending: z.literal(true).optional(),
  description: z.string().max(1000),
  effect: z.enum(["read", "write", "external"]),
  approval: z.enum(["none", "queue", "simulate"]),
  requires: z.array(z.string().max(80)).max(64),
  digest: z.string().max(128),
});
const eventSummarySchema = z.strictObject({
  description: z.string().max(1000),
  digest: z.string().max(128),
});
const entryIdentity = {
  installationId: identity,
  appId: identity,
  displayName: z.string().max(256),
  icon: z.string().min(1).max(80).optional(),
  capabilities: z.array(z.enum(appCapabilityIds)).optional(),
  workflowPublishGranted: z.boolean().optional(),
  workflowRunGranted: z.boolean().optional(),
};
/** `catalog({})`: a palette index over every installation, with no port schemas. */
const catalogIndexEntrySchema = z.strictObject({
  ...entryIdentity,
  methods: z.record(z.string(), methodSummarySchema),
  events: z.record(z.string(), eventSummarySchema).optional(),
});
/** `catalog({installationId})`: that one installation's full declared ports. */
const catalogFullEntrySchema = z.strictObject({
  ...entryIdentity,
  methods: z.record(z.string(), z.json()),
  events: z.record(z.string(), z.json()).optional(),
});
export const catalogInputSchema = z.strictObject({
  installationId: identity.optional(),
});
/** App method declarations admitted by the host for the current invocation. */
export const catalogReplySchema = z.union([
  z.strictObject({ apps: z.array(catalogIndexEntrySchema).max(200) }),
  z.strictObject({ app: catalogFullEntrySchema }),
  refusal,
]);

export const workflowIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  graph: z.string().optional(),
  node: z.string().optional(),
  trigger: z.string().optional(),
  port: z.string().optional(),
  edge: z.number().optional(),
});
export const runReply = z.union([
  z.strictObject({
    kind: z.enum(["started", "replay", "conflict"]),
    runId: identity,
    planDigest: identity,
  }),
  z.strictObject({
    kind: z.literal("invalid"),
    issues: z.array(workflowIssueSchema),
  }),
  z.strictObject({ error: identity }),
]);

export const cancelReplySchema = z.union([
  z.strictObject({ kind: z.enum(["cancelled", "terminal"]) }),
  z.strictObject({ kind: z.literal("refused"), reason: z.literal("denied") }),
  z.strictObject({ error: z.string() }),
]);

export const runOutcomeSchema = z.enum(["active", "terminal", "cancelled"]);

export const statusReply = z.union([
  z.strictObject({
    runId: identity,
    planDigest: identity,
    outcome: runOutcomeSchema,
    title: z.string().max(120),
    events: z.array(z.record(z.string(), z.json())).max(4096),
    reviews: z.array(z.record(z.string(), z.json())).max(256),
    status: identity,
    output: z.json(),
    error: z.json(),
  }),
  refusal,
]);
export const answerReviewReply = z.union([
  z.strictObject({
    result: z.enum(["accepted", "denied", "not_waiting", "invalid"]),
  }),
  refusal,
]);

const id = z.string().min(1).max(256);
const denied = z.strictObject({ error: id });
export const scheduleArmReplySchema = z.union([
  z.strictObject({ kind: z.literal("armed"), scheduleId: id }),
  z.strictObject({
    kind: z.literal("refused"),
    reason: z.string(),
    issues: z.array(z.json()).optional(),
  }),
  denied,
]);
export const triggerDisarmReplySchema = z.union([
  z.strictObject({ kind: z.enum(["disarmed", "not_found"]) }),
  denied,
]);
export const schedulesReplySchema = z.union([
  z.strictObject({
    schedules: z.array(
      z.strictObject({
        scheduleId: id,
        workflowId: workflowIdSchema,
        triggerId: id,
        nextDueAt: z.number().int(),
        state: z.enum(["active", "paused", "cancelled", "finished"]),
        lastError: z.string().nullable(),
      }),
    ),
  }),
  denied,
]);

export const workflowRunSourceSchema = z.enum([
  "manual",
  "schedule",
  "event",
  "agent",
  "key",
]);
/** The Agent Session (`sessionId`) stays host-side; the wire names only the Agent/key and its grantor. */
export const workflowRunInitiatedBySchema = z.union([
  z.strictObject({ kind: z.literal("member"), memberId: id }),
  z.strictObject({
    kind: z.literal("agent"),
    agentId: id,
    grantorMemberId: id,
  }),
  z.strictObject({
    kind: z.literal("key"),
    keyId: id,
    grantorMemberId: id,
  }),
]);
export const runsReplySchema = z.union([
  z.strictObject({
    runs: z
      .array(
        z.strictObject({
          runId: id,
          workflowId: workflowIdSchema,
          commit: z.string(),
          source: workflowRunSourceSchema,
          triggerId: id.optional(),
          initiatedBy: workflowRunInitiatedBySchema,
          startedAt: z.number(),
        }),
      )
      .max(50),
  }),
  denied,
]);

export const eventArmReplySchema = z.union([
  z.strictObject({ kind: z.literal("armed"), eventTriggerId: id }),
  z.strictObject({
    kind: z.literal("refused"),
    reason: z.string(),
    issues: z.array(z.json()).optional(),
  }),
  denied,
]);
export const eventTriggersReplySchema = z.union([
  z.strictObject({
    eventTriggers: z.array(
      z.strictObject({
        eventTriggerId: id,
        workflowId: workflowIdSchema,
        triggerId: id,
        emitterInstallationId: id,
        event: id,
        state: z.enum(["active", "paused"]),
        lastError: z.string().nullable(),
      }),
    ),
  }),
  denied,
]);
