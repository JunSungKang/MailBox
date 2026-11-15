import "server-only";
import * as repository from "../../backend/infrastructure/filesystem/message-repository.mjs";
import { ingest } from "../../backend/ingestion/coordinator.mjs";
import { createMailboxService } from "../../backend/application/mailbox.mjs";
export const mailboxService = createMailboxService({ repository, ingest });
