import * as z from "zod";
import { bindingsSelectionSchema } from "@fungi.computer/braid/git-access";
import { gitSha1Schema } from "@fungi.computer/puffball/git-representation";
import { workflowIdSchema } from "@fungi.computer/braid";

const id = z.string().min(1).max(256);
/** The Agent Session (chat) that receives the ending of every run it covers. */
export const runDeliverySchema = z.strictObject({ agentId: id, sessionId: id });
/** Agent and Session selected to receive run endings. */
export type RunDelivery = z.output<typeof runDeliverySchema>;
/** One chat the member may choose for run reports: an existing Agent Session. */
export const chatsReplySchema = z.lazy(() =>
  z.union([
    z.strictObject({
      chats: z
        .array(runDeliverySchema.extend({ title: z.string().max(4_096) }))
        .max(200),
    }),
    z.strictObject({ error: z.literal("not_granted") }),
  ]),
);
/** The published trigger supplies cadence or event matching; the host supplies authority scope. */
export const triggerTargetSchema = z.lazy(() =>
  z.strictObject({
    workflowId: workflowIdSchema,
    commit: gitSha1Schema,
    triggerId: z.string().min(1).max(80),
    bindings: bindingsSelectionSchema,
    delivery: runDeliverySchema.optional(),
  }),
);
/** Identify the schedule-trigger registration to disarm. */
export const scheduleDisarmInputSchema = z.strictObject({ scheduleId: id });
/** Identify the event-trigger registration to disarm. */
export const eventDisarmInputSchema = z.strictObject({ eventTriggerId: id });
/** Trigger listing takes no caller-supplied filters. */
export const triggerListInputSchema = z.strictObject({});
/** Published trigger, pinned commit, selected bindings and optional run delivery. */
export type WorkflowTriggerTarget = z.output<typeof triggerTargetSchema>;

/** Host binding input carries the App-owned immutable row digest, never caller input. */
export type WorkflowTriggerArmTarget = WorkflowTriggerTarget &
  Readonly<{ digest: string }>;
