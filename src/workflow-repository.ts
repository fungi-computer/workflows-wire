import {
  workflowDefinitionSchema,
  workflowIdSchema,
  type Issue,
} from "@fungi.computer/braid";
import type { GitBinding } from "@fungi.computer/agar/git";
import {
  countingGit,
  ReadCopyBudgetExceeded,
} from "@fungi.computer/agar/read-copy";
import * as S from "effect/Schema";
import * as z from "zod";
import { provenanceSchema } from "./library-contracts.js";

/**
 * The read side of a Workflows library's Git layout, shared by the Workflows
 * App and the hosts that read its published definitions: one repository,
 * `workflows`, one `workflows/<id>.json` file per Workflow (its definition
 * plus `layout` and optional `provenance`), and one `<id>@v<n>` tag per
 * published version on `main`'s ancestry.
 */
export const workflowLibraryRepository = "trellis";
// Git's SHA-1 identity for an empty tree: no directory entry can be present.
const emptyTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/** Where one Workflow's file lives in its library repository. */
export const workflowFilePath = (id: string) =>
  `workflows/${workflowIdSchema.parse(id)}.json`;

const layoutSchema = S.Record(S.String, S.Struct({ x: S.Finite, y: S.Finite }));
export const workflowDraftSchema = S.Struct({
  definition: workflowDefinitionSchema,
  layout: layoutSchema,
  provenance: S.optionalKey(
    S.declare(
      (value): value is z.output<typeof provenanceSchema> =>
        provenanceSchema.safeParse(value).success,
    ),
  ),
});
/** One Workflow file's decoded content. */
export type WorkflowDraft = typeof workflowDraftSchema.Type;
/** A Workflow file's content at the commit it was read from. */
export type WorkflowDocument = WorkflowDraft & { readonly commit: string };

export type WorkflowReadGit = Pick<
  GitBinding,
  "readCommit" | "readTree" | "readBlob"
>;

/** Read the immediate Workflow directory without following symlinks or submodules. */
export async function workflowFiles(
  git: WorkflowReadGit,
  commit: string | null,
) {
  if (!commit || /^0{40}$/.test(commit)) return [];
  const metadata = await git.readCommit(workflowLibraryRepository, commit);
  if (!metadata || metadata.treeHash === emptyTree) return [];
  const directory = (
    await git.readTree(workflowLibraryRepository, metadata.treeHash)
  )?.find((entry) => entry.name === "workflows" && entry.type === "tree");
  return directory
    ? ((await git.readTree(workflowLibraryRepository, directory.hash)) ?? [])
    : [];
}

/** Changed Workflow IDs in one accepted ref update, including deletions and mode changes. */
export async function changedWorkflowIds(
  git: WorkflowReadGit,
  before: string,
  after: string,
) {
  const previous = new Map(
    (await workflowFiles(git, before)).map((entry) => [
      entry.name,
      `${entry.mode}:${entry.hash}`,
    ]),
  );
  const current = new Map(
    (await workflowFiles(git, after)).map((entry) => [
      entry.name,
      `${entry.mode}:${entry.hash}`,
    ]),
  );
  return [...new Set([...previous.keys(), ...current.keys()])]
    .filter(
      (name) =>
        name.endsWith(".json") &&
        workflowIdSchema.safeParse(name.slice(0, -5)).success &&
        previous.get(name) !== current.get(name),
    )
    .map((name) => name.slice(0, -5));
}

/** Decode a pushed file separately from the admitted catalog's semantic validation. */
export async function inspectWorkflowFile(
  git: WorkflowReadGit,
  workflowId: string,
  commit: string,
): Promise<
  | { kind: "missing" }
  | { kind: "valid"; draft: WorkflowDraft }
  | { kind: "invalid"; issues: readonly Issue[] }
> {
  const name = workflowFilePath(workflowId).slice("workflows/".length);
  const entry = (await workflowFiles(git, commit)).find(
    (item) => item.name === name,
  );
  if (!entry) return { kind: "missing" };
  if (entry.mode !== "100644" && entry.mode !== "100755")
    return {
      kind: "invalid",
      issues: [{ code: "schema", message: "Workflow must be a regular file" }],
    };
  const bytes = await git.readBlob(workflowLibraryRepository, entry.hash);
  if (!bytes)
    return {
      kind: "invalid",
      issues: [{ code: "schema", message: "Workflow blob is missing" }],
    };
  try {
    const file = z
      .record(z.string(), z.json())
      .parse(JSON.parse(new TextDecoder().decode(bytes)));
    const { layout = {}, provenance, ...definition } = file;
    const content = { definition, layout };
    const decode = S.decodeUnknownSync(workflowDraftSchema);
    // A file without provenance stays without it; the key is optional.
    const draft = Object.hasOwn(file, "provenance")
      ? decode({ ...content, provenance }, { onExcessProperty: "error" })
      : decode(content, { onExcessProperty: "error" });
    return { kind: "valid", draft };
  } catch (cause) {
    if (
      !(cause instanceof SyntaxError) &&
      !(cause instanceof z.ZodError) &&
      !S.isSchemaError(cause)
    )
      throw cause;
    return {
      kind: "invalid",
      issues: [
        {
          code: "schema",
          message: "Workflow definition or layout failed decoding",
        },
      ],
    };
  }
}

/** One Workflow's file at `commit`, or null when it is absent or invalid. */
export async function readWorkflowAt(
  git: WorkflowReadGit,
  workflowId: string,
  commit: string | null,
): Promise<WorkflowDocument | null> {
  if (!commit) return null;
  const inspected = await inspectWorkflowFile(git, workflowId, commit);
  return inspected.kind === "valid" ? { ...inspected.draft, commit } : null;
}

/** A Workflow's published versions, newest first, from its `<id>@v<n>` tags. */
export function versionRefs(
  workflowId: string,
  references: Awaited<ReturnType<GitBinding["refs"]>>,
) {
  const prefix = `refs/tags/${workflowId}@v`;
  return references
    .flatMap((ref) => {
      if (
        !ref.name.startsWith(prefix) ||
        !/^[1-9][0-9]*$/.test(ref.name.slice(prefix.length))
      )
        return [];
      const version = Number(ref.name.slice(prefix.length));
      return Number.isSafeInteger(version)
        ? [{ version, commit: ref.hash }]
        : [];
    })
    .sort((a, b) => b.version - a.version);
}

/** Batched first-parent reads retain every merge parent; the caller owns its IO budget. */
export async function workflowCommitIsAncestor(
  git: GitBinding,
  before: string,
  after: string,
) {
  const pending = [after];
  const seen = new Set<string>();
  while (pending.length && seen.size < 4096) {
    const head = pending.pop();
    if (!head || seen.has(head)) continue;
    const limit = Math.min(1000, 4096 - seen.size);
    const commits = await git.log(workflowLibraryRepository, {
      ref: head,
      limit,
    });
    // LIFO: defer the page continuation beneath this page's merge parents.
    if (commits.length === limit) {
      const parent = commits.at(-1)?.parents[0];
      if (parent) pending.push(parent);
    }
    // Newest merge parents go on top, matching the ordinary ancestry walk.
    for (const commit of [...commits].reverse()) {
      if (commit.hash === before) return true;
      if (seen.has(commit.hash)) continue;
      seen.add(commit.hash);
      pending.push(...commit.parents.slice(1));
    }
  }
  return false;
}

/** Each Git object read at most once while one listing runs. */
export function listingGit(git: GitBinding): WorkflowReadGit {
  const once = <T>(load: (name: string, hash: string) => Promise<T>) => {
    const pending = new Map<string, Promise<T>>();
    return (name: string, hash: string) => {
      const key = `${name}/${hash}`;
      let value = pending.get(key);
      if (!value) {
        value = load(name, hash);
        pending.set(key, value);
      }
      return value;
    };
  };
  return {
    readCommit: once((name, hash) => git.readCommit(name, hash)),
    readTree: once((name, hash) => git.readTree(name, hash)),
    readBlob: once((name, hash) => git.readBlob(name, hash)),
  };
}

/**
 * One published Workflow: a version tag, or a commit, on `main`'s ancestry.
 * `copied` answers from a caller's own read copy of that commit when it has
 * one; otherwise the file is read from Git within a bounded read budget.
 */
export async function readPublishedWorkflow(
  git: GitBinding,
  workflowId: string,
  at: { version: number } | { commit: string },
  copied: (commit: string) => WorkflowDocument | null = () => null,
): Promise<(WorkflowDocument & { readonly version: number | null }) | null> {
  workflowIdSchema.parse(workflowId);
  const controller = new AbortController();
  const current = countingGit(git, {
    limit: 40,
    signal: controller.signal,
  }).git;
  try {
    if (!(await current.info(workflowLibraryRepository))) return null;
    const references = await current.refs(workflowLibraryRepository);
    const main = references.find((ref) => ref.name === "refs/heads/main")?.hash;
    if (!main) return null;
    const tagged = versionRefs(workflowId, references);
    const version =
      "version" in at
        ? tagged.find((item) => item.version === at.version)
        : tagged.find((item) => item.commit === at.commit);
    const commit = "commit" in at ? at.commit : version?.commit;
    if (!commit || !(await workflowCommitIsAncestor(current, commit, main)))
      return null;
    // The live main ancestry admits publication; a read copy never does.
    const document =
      copied(commit) ?? (await readWorkflowAt(current, workflowId, commit));
    return document ? { ...document, version: version?.version ?? null } : null;
  } catch (cause) {
    if (cause instanceof ReadCopyBudgetExceeded) return null;
    throw cause;
  } finally {
    controller.abort();
  }
}
