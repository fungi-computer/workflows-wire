import { workflowRunRequestIds } from "@fungi.computer/workflows-wire";

const requestId = workflowRunRequestIds.request.generate();
console.log(workflowRunRequestIds.request.parse(requestId).ok);
