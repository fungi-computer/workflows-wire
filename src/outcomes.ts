import * as z from "zod";
import { appCapabilityIds } from "@fungi.computer/puffball";

/** Lowercase Workflow slug used by library files and host commands. */
export const workflowIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);

const identity = z.string().min(1).max(256);
const refusal = z.strictObject({
  /** Host-authored invocation refusal. */
  error: identity,
});

/** What the palette shows before a method's ports are ever fetched. */
const methodSummarySchema = z.lazy(() =>
  z.strictObject({
    /** Port details have not yet been loaded. */
    pending: z.literal(true).optional(),
    /** Human-readable method summary. */
    description: z.string().max(1000),
    /** Declared read, write or external effect. */
    effect: z.enum(["read", "write", "external"]),
    /** Declared approval mode. */
    approval: z.enum(["none", "queue", "simulate"]),
    /** Capabilities required by this method. */
    requires: z.array(z.string().max(80)).max(64),
    /** Digest identifying the declaration being summarized. */
    digest: z.string().max(128),
  }),
);
const eventSummarySchema = z.lazy(() =>
  z.strictObject({
    /** Human-readable event summary. */
    description: z.string().max(1000),
    /** Digest identifying the event declaration. */
    digest: z.string().max(128),
  }),
);
const entryIdentity = {
  /** Installation exposing these ports. */
  installationId: identity,
  /** App installed at this installation. */
  appId: identity,
  /** App display name shown in the palette. */
  displayName: z.string().max(256),
  /** Optional declared App icon. */
  icon: z.string().min(1).max(80).optional(),
  /** App capabilities included in the admitted catalog row. */
  capabilities: z.array(z.enum(appCapabilityIds)).optional(),
  /** Whether Workflow publication is granted to this installation. */
  workflowPublishGranted: z.boolean().optional(),
  /** Whether Workflow execution is granted to this installation. */
  workflowRunGranted: z.boolean().optional(),
};
/** `catalog({})`: a palette index over every installation, with no port schemas. */
const catalogIndexEntrySchema = z.lazy(() =>
  z.strictObject({
    ...entryIdentity,
    /** Method summaries indexed by declared name. */
    methods: z.record(z.string(), methodSummarySchema),
    /** Event summaries indexed by declared name. */
    events: z.record(z.string(), eventSummarySchema).optional(),
  }),
);
/** `catalog({installationId})`: that one installation's full declared ports. */
const catalogFullEntrySchema = z.lazy(() =>
  z.strictObject({
    ...entryIdentity,
    /** Complete JSON method declarations indexed by name. */
    methods: z.record(z.string(), z.json()),
    /** Complete JSON event declarations indexed by name. */
    events: z.record(z.string(), z.json()).optional(),
  }),
);
/** Select the palette index, or one installation's complete port declarations. */
export const catalogInputSchema = z.lazy(() =>
  z.strictObject({
    /** Select one installation, or omit to read the palette index. */
    installationId: identity.optional(),
  }),
);
/** App method declarations admitted by the host for the current invocation. */
export const catalogReplySchema = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Bounded palette index over admitted installations. */
      apps: z.array(catalogIndexEntrySchema).max(200),
    }),
    z.strictObject({
      /** Full port declarations for the selected installation. */
      app: catalogFullEntrySchema,
    }),
    refusal,
  ]),
);

/** Validation issue with optional graph, node, trigger, port or edge location. */
export const workflowIssueSchema = z.lazy(() =>
  z.object({
    /** Machine-readable validation issue category. */
    code: z.string(),
    /** Human-readable validation explanation. */
    message: z.string(),
    /** Graph containing the invalid declaration. */
    graph: z.string().optional(),
    /** Node associated with this issue. */
    node: z.string().optional(),
    /** Trigger associated with this issue. */
    trigger: z.string().optional(),
    /** Port associated with this issue. */
    port: z.string().optional(),
    /** Edge index associated with this issue. */
    edge: z.number().optional(),
  }),
);
/** Run admission result, including replay/conflict, invalid input or refusal. */
export const runReply = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Admission, replay or request-conflict discriminator. */
      kind: z.enum(["started", "replay", "conflict"]),
      /** Identity of the run selected by admission. */
      runId: identity,
      /** Digest of the admitted plan. */
      planDigest: identity,
    }),
    z.strictObject({
      /** The run request failed validation. */
      kind: z.literal("invalid"),
      /** Validation issues explaining the refusal. */
      issues: z.array(workflowIssueSchema),
    }),
    z.strictObject({
      /** Host-authored invocation refusal. */
      error: identity,
    }),
  ]),
);

/** Cancellation result, an already-terminal run, or an authority refusal. */
export const cancelReplySchema = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Cancellation completed, or the run was already terminal. */
      kind: z.enum(["cancelled", "terminal"]),
    }),
    z.strictObject({
      /** The cancellation was refused. */
      kind: z.literal("refused"),
      /** Caller lacked authority to cancel the run. */
      reason: z.literal("denied"),
    }),
    z.strictObject({
      /** Host-authored invocation error. */
      error: z.string(),
    }),
  ]),
);

/** Lifecycle outcome reported for a Workflow run. */
export const runOutcomeSchema = z.enum(["active", "terminal", "cancelled"]);

/** Bounded run status snapshot with events, reviews, output and error. */
export const statusReply = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Identity of the inspected run. */
      runId: identity,
      /** Digest of the run's admitted plan. */
      planDigest: identity,
      /** Current run lifecycle outcome. */
      outcome: runOutcomeSchema,
      /** Human-readable run title. */
      title: z.string().max(120),
      /** Bounded run event records. */
      events: z.array(z.record(z.string(), z.json())).max(4096),
      /** Bounded review records associated with the run. */
      reviews: z.array(z.record(z.string(), z.json())).max(256),
      /** Run status label supplied by the host. */
      status: identity,
      /** JSON run output. */
      output: z.json(),
      /** JSON run error. */
      error: z.json(),
    }),
    refusal,
  ]),
);
/** Result of answering a waiting run review, or an invocation refusal. */
export const answerReviewReply = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Acceptance, denial, absence of a waiting review or invalid answer. */
      result: z.enum(["accepted", "denied", "not_waiting", "invalid"]),
    }),
    refusal,
  ]),
);

const id = z.string().min(1).max(256);
const denied = z.strictObject({
  /** Host-authored invocation refusal. */
  error: id,
});
/** Schedule-trigger admission or its refusal details. */
export const scheduleArmReplySchema = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Schedule-trigger registration was armed. */
      kind: z.literal("armed"),
      /** Identity of the armed schedule registration. */
      scheduleId: id,
    }),
    z.strictObject({
      /** Schedule-trigger registration was refused. */
      kind: z.literal("refused"),
      /** Host-authored reason for the refusal. */
      reason: z.string(),
      /** Optional validation issues associated with the trigger. */
      issues: z.array(z.json()).optional(),
    }),
    denied,
  ]),
);
/** Trigger disarm result, including an absent trigger or denied invocation. */
export const triggerDisarmReplySchema = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Registration was disarmed or was already absent. */
      kind: z.enum(["disarmed", "not_found"]),
    }),
    denied,
  ]),
);
/** Future admission paused, or no controllable active registration found. */
export const schedulePauseReplySchema = z.lazy(() =>
  z.union([z.strictObject({ kind: z.enum(["paused", "not_found"]) }), denied]),
);
/** One bounded installation page; continue strictly after nextCursor. */
export const schedulesReplySchema = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Schedule-trigger registrations visible to this invocation. */
      schedules: z
        .array(
          z.strictObject({
            /** Identity of the schedule registration. */
            scheduleId: id,
            /** Installation owning the Workflow schedule and its control door. */
            installationId: id,
            /** Workflow whose published trigger was armed. */
            workflowId: workflowIdSchema,
            /** Trigger identity within the published definition. */
            triggerId: id,
            /** Next occurrence time in epoch milliseconds. */
            nextDueAt: z.number().int(),
            /** Current schedule lifecycle state. */
            state: z.enum(["active", "paused", "cancelled", "finished"]),
            /** Latest scheduling failure, or null when absent. */
            lastError: z.string().nullable(),
          }),
        )
        .max(100),
      /** Last visible schedule id when another page exists; otherwise null. */
      nextCursor: id.nullable(),
    }),
    denied,
  ]),
);

/** Origin category recorded for a run: manual, schedule, event, Agent or key. */
export const workflowRunSourceSchema = z.enum([
  "manual",
  "schedule",
  "event",
  "agent",
  "key",
]);
/** The Agent Session (`sessionId`) stays host-side; the wire names only the Agent/key and its grantor. */
export const workflowRunInitiatedBySchema = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Run initiated directly by a member. */
      kind: z.literal("member"),
      /** Identity of the initiating member. */
      memberId: id,
    }),
    z.strictObject({
      /** Run initiated by an Agent. */
      kind: z.literal("agent"),
      /** Identity of the initiating Agent. */
      agentId: id,
      /** Member whose grant authorizes the invocation. */
      grantorMemberId: id,
    }),
    z.strictObject({
      /** Run initiated by a named key. */
      kind: z.literal("key"),
      /** Identity of the initiating key. */
      keyId: id,
      /** Member whose grant authorizes the invocation. */
      grantorMemberId: id,
    }),
  ]),
);
/** Bounded recent-run rows with their source, initiator and pinned commit. */
export const runsReplySchema = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Bounded recent runs visible to this invocation. */
      runs: z
        .array(
          z.strictObject({
            /** Identity of the recorded run. */
            runId: id,
            /** Workflow selected by the run. */
            workflowId: workflowIdSchema,
            /** Exact published commit used by the run. */
            commit: z.string(),
            /** Origin category recorded at admission. */
            source: workflowRunSourceSchema,
            /** Published trigger that initiated the run, when applicable. */
            triggerId: id.optional(),
            /** Host-admitted initiating principal and grantor. */
            initiatedBy: workflowRunInitiatedBySchema,
            /** Run start timestamp. */
            startedAt: z.number(),
          }),
        )
        .max(50),
    }),
    denied,
  ]),
);

/** Event-trigger admission or its refusal details. */
export const eventArmReplySchema = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Event-trigger registration was armed. */
      kind: z.literal("armed"),
      /** Identity of the armed event registration. */
      eventTriggerId: id,
    }),
    z.strictObject({
      /** Event-trigger registration was refused. */
      kind: z.literal("refused"),
      /** Host-authored reason for the refusal. */
      reason: z.string(),
      /** Optional validation issues associated with the trigger. */
      issues: z.array(z.json()).optional(),
    }),
    denied,
  ]),
);
/** Visible event-trigger rows with emitter, event and current state. */
export const eventTriggersReplySchema = z.lazy(() =>
  z.union([
    z.strictObject({
      /** Event-trigger registrations visible to this invocation. */
      eventTriggers: z.array(
        z.strictObject({
          /** Identity of the event registration. */
          eventTriggerId: id,
          /** Workflow whose published trigger was armed. */
          workflowId: workflowIdSchema,
          /** Trigger identity within the published definition. */
          triggerId: id,
          /** Installation supplying the subscribed event. */
          emitterInstallationId: id,
          /** Declared event name. */
          event: id,
          /** Current event registration state. */
          state: z.enum(["active", "paused"]),
          /** Latest event-trigger failure, or null when absent. */
          lastError: z.string().nullable(),
        }),
      ),
    }),
    denied,
  ]),
);
