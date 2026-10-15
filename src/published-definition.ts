import { contentDigest, type WorkflowDefinition } from "@fungi.computer/braid";
import * as Schema from "effect/Schema";
import type {
  PublishedDefinitionPort,
  WorkflowPublicationContext,
} from "@fungi.computer/braid/runtime";

/** The slice of {@link WorkflowPublicationContext} this port actually reads. */
export type WorkflowPublishedDefinitionContext = Pick<
  WorkflowPublicationContext,
  "installationId" | "git"
>;

/**
 * How a host reads one published Workflow definition back out of Git. The
 * Workflows App owns the Git layout (drafts, versions, the copy index); this
 * port only wraps that read into the braid-shaped `PublishedDefinition`.
 */
export type WorkflowPublishedReader = Readonly<{
  published(
    workflowId: string,
    at: { version: number } | { commit: string },
  ): Promise<Readonly<{
    definition: WorkflowDefinition;
    commit: string;
    version: number | null;
  }> | null>;
}>;

/** Trigger arm verification uses current admitted Git; direct starts carry the App's original row. */
export function createWorkflowPublishedDefinitionPort(
  createReader: (
    git: WorkflowPublishedDefinitionContext["git"],
  ) => WorkflowPublishedReader,
): PublishedDefinitionPort<WorkflowPublishedDefinitionContext> {
  return {
    async resolve({ git }, selector) {
      const reader = createReader(git);
      const published = await reader.published(selector.workflowId, selector);
      return published === null
        ? null
        : {
            workflowId: selector.workflowId,
            definition: published.definition,
            commit: published.commit,
            version: published.version,
            digest: await contentDigest(
              Schema.decodeUnknownSync(Schema.Json)(published.definition),
            ),
          };
    },
  };
}
