import * as z from "zod";
import { runDeliverySchema } from "./trigger-contracts.js";
import { defineIdFamily } from "@fungi.computer/cairn/id";
import * as S from "effect/Schema";
import { sha256DigestSchema } from "@fungi.computer/puffball/effect";
import {
  gitAccessSchema,
  bindingsSelectionSchema,
} from "@fungi.computer/braid/git-access";
import { gitSha1Schema } from "@fungi.computer/puffball/git-representation";
import {
  workflowIdSchema,
  workflowIssueSchema as issueSchema,
} from "./outcomes.js";
/** Source Workflow and commit recorded when importing or forking a document. */
export const provenanceSchema = z.lazy(() =>
  z.union([
    z.strictObject({
      kind: z.literal("import"),
      workflowId: workflowIdSchema,
      version: z.number().int().positive(),
      commit: gitSha1Schema,
      sha256: z.string().refine(S.is(sha256DigestSchema)),
      origin: z.string().max(256).optional(),
    }),
    z.strictObject({
      kind: z.literal("fork"),
      workflowId: workflowIdSchema,
      commit: gitSha1Schema,
    }),
  ]),
);
const identity = z.string().min(1).max(256);
/** Shared run request fields: identity, bindings, JSON input and optional delivery. */
export const runBase = z.strictObject({
  requestId: identity,
  workflowId: workflowIdSchema,
  bindings: bindingsSelectionSchema,
  input: z.record(z.string(), z.json()),
  delivery: runDeliverySchema.optional(),
});
/** Run request pinned to either a published version or an exact Git commit. */
export const publishedRun = z.lazy(() =>
  z.union([
    runBase.extend({ version: z.number().int().positive() }),
    runBase.extend({ commit: gitSha1Schema }),
  ]),
);
/** Wire document containing definition, node layout, provenance and commit. */
export const document = z.strictObject({
  provenance: provenanceSchema.optional(),
  definition: z.record(z.string(), z.json()),
  layout: z.record(
    z.string(),
    z.strictObject({ x: z.number(), y: z.number() }),
  ),
  commit: gitSha1Schema,
});
const invalid = z.strictObject({
  kind: z.literal("invalid"),
  issues: z.array(issueSchema),
});
/** Nonnegative revision used to fence draft replacements. */
export const revisionSchema = z.number().int().nonnegative();
/** Editable document with a draft revision instead of a published commit. */
export const draftDocument = document
  .omit({ commit: true })
  .extend({ revision: revisionSchema });
/** Published document identified by Workflow, version, commit and content digest. */
export const publishedDocument = document.extend({
  workflowId: workflowIdSchema,
  version: z.number().int().positive(),
  digest: z.string().refine(S.is(sha256DigestSchema)),
});
/** Draft save result, including revision conflict or validation issues. */
export const saveReply = z.union([
  z.strictObject({ kind: z.literal("saved"), revision: revisionSchema }),
  z.strictObject({
    kind: z.literal("conflict"),
    current: draftDocument.nullable(),
  }),
  invalid,
]);
const reviewedNode = { graph: z.string(), node: z.string() };
/** Share review listing Git access, write/external nodes and trigger configuration. */
export const shareReview = z.strictObject({
  gitAccess: z.array(
    z.union([
      gitAccessSchema.options[0].extend(reviewedNode),
      gitAccessSchema.options[1].extend(reviewedNode),
    ]),
  ),
  writeNodes: z.array(
    z.strictObject({
      graph: z.string(),
      node: z.string(),
      appId: z.string(),
      method: z.string(),
      effect: z.enum(["write", "external"]),
    }),
  ),
  // Definition decoding owns trigger grammar; this reply transports configuration only.
  triggers: z.array(z.json()),
});
/** Import/fork result with the saved draft and review, or a typed refusal. */
export const shareCopyReply = z.lazy(() =>
  z.union([
    z.strictObject({
      kind: z.literal("saved"),
      revision: revisionSchema,
      title: z.string(),
      review: shareReview,
    }),
    saveReply.options[1],
    invalid,
    z.strictObject({
      kind: z.literal("missing_apps"),
      appIds: z.array(z.string()),
    }),
    z.strictObject({
      kind: z.enum([
        "too_large",
        "digest_mismatch",
        "invalid_bundle",
        "not_found",
      ]),
    }),
  ]),
);
/** Exported bundle bytes and digest, or a missing/oversized bundle result. */
export const shareExportReply = z.lazy(() =>
  z.union([
    z.strictObject({
      bytes: z.string(),
      sha256: z.string().refine(S.is(sha256DigestSchema)),
    }),
    z.strictObject({ kind: z.enum(["not_found", "too_large"]) }),
  ]),
);
/** Mint and validate identities for asynchronous Workflow publication attempts. */
export const publicationIds = defineIdFamily({
  family: "workflow-publication",
  version: 1,
  kinds: { publication: { prefix: "publication" } },
});
/** Publication identity accepted by the maintained publication id family. */
export const publicationIdSchema = z.lazy(() =>
  z
    .string()
    .min(1)
    .max(256)
    .refine((value) => publicationIds.publication.is(value)),
);
/** Publication failure categories returned by the host. */
export const publicationFailure = z.enum([
  "git_conflict",
  "publication_failed",
  "too_large",
  "access_changed",
]);
/** Completed publication's exact commit and assigned version. */
export const publicationComplete = z.lazy(() =>
  z.strictObject({
    kind: z.literal("published"),
    commit: gitSha1Schema,
    version: z.number().int().positive(),
  }),
);
/** Pending publication identified for subsequent status reads. */
export const publicationPending = z.lazy(() =>
  z.strictObject({
    kind: z.literal("publishing"),
    publicationId: publicationIdSchema,
  }),
);
/** Failed publication and its typed failure reason. */
export const publicationFailed = z.lazy(() =>
  z.strictObject({
    kind: z.literal("failed"),
    reason: publicationFailure,
  }),
);
/** Current publication outcome, including an unknown publication identity. */
export const publicationStatus = z.lazy(() =>
  z.union([
    publicationPending,
    publicationComplete,
    publicationFailed,
    z.strictObject({ kind: z.literal("not_found") }),
  ]),
);
/** Another publication attempt currently owns the publication operation. */
export const publicationElsewhere = z.lazy(() =>
  z.strictObject({
    kind: z.literal("publishing_elsewhere"),
  }),
);
/** Publication command result, including pending work, conflict or validation issues. */
export const publishReply = z.lazy(() =>
  z.union([
    publicationElsewhere,
    publicationComplete,
    publicationPending,
    publicationFailed,
    z.strictObject({
      kind: z.literal("conflict"),
      head: gitSha1Schema.nullable(),
    }),
    invalid,
  ]),
);
/** Published version with commit identity, commit time and commit message. */
export const version = z.strictObject({
  version: z.number().int().positive(),
  commit: gitSha1Schema,
  committedAt: z.number(),
  message: z.string(),
});
/** Identify one Workflow within the library. */
export const workflow = z.strictObject({ workflowId: workflowIdSchema });
/** Bounded library rows with draft revision and optional published reference. */
export const listings = z.lazy(() =>
  z
    .array(
      z.strictObject({
        workflowId: workflowIdSchema,
        title: z.string(),
        draftRevision: revisionSchema.nullable(),
        published: z
          .strictObject({
            commit: gitSha1Schema,
            version: z.number().int().positive().nullable(),
          })
          .nullable(),
      }),
    )
    .max(100),
);
/** Bounded Git history rows without a published-version number. */
export const history = z.array(version.omit({ version: true })).max(50);

/** A missing index is not an empty Git repository; only write paths reconstruct it. */
export const libraryPageInput = z.lazy(() =>
  z.strictObject({
    limit: z.number().int().min(1).max(100).default(100),
    after: workflowIdSchema.optional(),
  }),
);
/** One library page with an optional exclusive cursor for the next page. */
export const libraryPage = z.lazy(() =>
  z.strictObject({
    items: listings,
    next: workflowIdSchema.optional(),
  }),
);
/** Indexed library page, or an explicit indication that its index is missing. */
export const libraryListing = z.lazy(() =>
  z.union([libraryPage, z.strictObject({ kind: z.literal("unindexed") })]),
);

/** A missing screen copy needs an explicit foreground rebuild, never a hidden Git read. */
export const rebuilding = z.lazy(() =>
  z.strictObject({ kind: z.literal("rebuilding") }),
);
/** Draft/published document read, absence, or an explicit copy-rebuild state. */
export const documentRead = z.lazy(() =>
  z.union([draftDocument, document, z.null(), rebuilding]),
);
/** Published version rows, or an explicit copy-rebuild state. */
export const versionsRead = z.lazy(() =>
  z.union([z.array(version), rebuilding]),
);
/** Bounded copy-rebuild continuation, optionally targeting one pinned document. */
export const rebuildCopiesInput = z.lazy(() =>
  z.strictObject({
    cursor: z.string().max(1024).nullable(),
    target: workflow
      .extend({
        at: z.strictObject({ commit: gitSha1Schema }),
      })
      .optional(),
  }),
);
/** Copy-rebuild progress and the cursor needed to continue unfinished work. */
export const rebuildCopiesReply = z.lazy(() =>
  z.strictObject({
    done: z.boolean(),
    cursor: z.string().max(1024).nullable(),
  }),
);
