import { defineIdFamily } from "@fungi.computer/cairn/id";

/** Typed id codec for Workflow run requests: mint and validate
 * `workflow_request_*` ids. Hosts derive run ids from the request. */
export const workflowRunRequestIds = defineIdFamily({
  family: "agar-workflow-run",
  version: 1,
  kinds: {
    request: { prefix: "workflow_request" },
  },
});
