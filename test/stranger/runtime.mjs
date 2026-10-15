import assert from "node:assert/strict";
import { workflowRunRequestIds } from "@fungi.computer/workflows-wire";
const id = workflowRunRequestIds.request.generate();
assert.equal(workflowRunRequestIds.request.parse(id).ok, true);
