import * as z from "zod";
import { workflowIdSchema } from "@fungi.computer/braid";
import {
  workflowRunSourceSchema,
  workflowRunInitiatedBySchema,
} from "./outcomes.js";

/** The App's `WORKFLOWS.runs` read, scoped to one Workflow when given. */
export const runsInputSchema = z.strictObject({
  workflowId: workflowIdSchema.optional(),
});

/**
 * One listed run, from the stored source of truth plus the App's own copy of
 * the published document at `commit`; display metadata never comes from Git.
 */
export const runListItemSchema = z.strictObject({
  runId: z.string(),
  workflowId: workflowIdSchema,
  commit: z.string(),
  version: z.number().int().positive().nullable(),
  startedAt: z.number(),
  title: z.string().nullable(),
  source: workflowRunSourceSchema,
  triggerId: z.string().optional(),
  initiatedBy: workflowRunInitiatedBySchema,
});
export type WorkflowRunListItem = z.output<typeof runListItemSchema>;

/**
 * The calling member's own id, so the Runs UI can tell its own runs from a
 * teammate's (an owner now sees every run in the installation, not only
 * their own) without guessing identity from the list itself.
 */
export const viewerReplySchema = z.union([
  z.strictObject({ memberId: z.string() }),
  z.strictObject({ error: z.string() }),
]);
export type ViewerReply = z.output<typeof viewerReplySchema>;
