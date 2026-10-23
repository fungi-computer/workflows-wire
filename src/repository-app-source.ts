import * as S from "effect/Schema";
import {
  appIdSchema,
  sourceRevisionSchema,
} from "@fungi.computer/puffball/effect";

/** A registered repository App as the host reports it to the calling installation:
 * read-only identity from the source owner and the live caller. Hosts and Apps
 * share this wire; an App never imports the host package for it.
 * Reading it neither registers a repository nor selects or runs a Computer. */
export const repositoryWorkflowSourceSchema = S.Struct({
  appId: appIdSchema,
  installationId: S.String.check(S.isMinLength(1), S.isMaxLength(256)),
  callerAppId: appIdSchema,
  callerSourceRevision: sourceRevisionSchema,
});
