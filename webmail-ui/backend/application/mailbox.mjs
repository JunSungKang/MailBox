import { messageBelongsToUser } from "../domain/mail-access.mjs";
export function createMailboxService({ repository, ingest = async () => {} }) {
  return {
    async listMailbox({ actor, box }) {
      if (!actor) return [];
      await repository.ensureMailDirs();
      await ingest(box);
      return (await repository.listStoredMessages(box)).filter((message) =>
        messageBelongsToUser(message, actor),
      );
    },
    async getMessage({ actor, box, id }) {
      if (!actor) return null;
      const message = await repository.readMessage(box, id);
      return messageBelongsToUser(message, actor) ? message : null;
    },
  };
}
