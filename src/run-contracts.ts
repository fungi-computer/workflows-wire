import * as z from "zod";
import { workflowIdSchema } from "@fungi.computer/braid";
import { publishedRunRowSchema, testRunRowSchema } from "./outcomes.js";

/** The App's `WORKFLOWS.runs` read, scoped to one Workflow when given. */
export const runsInputSchema = z.lazy(() =>
  z.strictObject({
    workflowId: workflowIdSchema.optional(),
  }),
);

/**
 * One listed run, from the stored source of truth. A published run adds the
 * App's own copy of the document at `commit`; a test run has no commit and
 * takes its title from the draft it ran. Display metadata never comes from Git.
 */
export const runListItemSchema = z.lazy(() =>
  z.union([
    publishedRunRowSchema.extend({
      version: z.number().int().positive().nullable(),
      title: z.string().nullable(),
    }),
    testRunRowSchema.extend({ title: z.string().nullable() }),
  ]),
);
/** Decoded run row with its pinned publication and display metadata. */
export type WorkflowRunListItem = z.output<typeof runListItemSchema>;

/**
 * The calling member's own id, so the Runs UI can tell its own runs from a
 * teammate's (an owner now sees every run in the installation, not only
 * their own) without guessing identity from the list itself.
 */
export const viewerReplySchema = z.lazy(() =>
  z.union([
    z.strictObject({ memberId: z.string() }),
    z.strictObject({ error: z.string() }),
  ]),
);
/** Calling member identity, or a refusal returned by the viewer read. */
export type ViewerReply = z.output<typeof viewerReplySchema>;
