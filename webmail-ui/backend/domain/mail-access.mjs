function addressBelongsToUser(value, userId) {
  const addresses =
    String(value || "")
      .toLowerCase()
      .match(/[a-z0-9._%+-]+@[a-z0-9.-]+/g) || [];
  return addresses.some((address) => address.split("@")[0] === userId);
}
export function messageBelongsToUser(message, userId) {
  if (!userId || !message) return false;
  if (message.box === "sent") return addressBelongsToUser(message.from, userId);
  return (
    Array.isArray(message.to) &&
    message.to.some((recipient) => addressBelongsToUser(recipient, userId))
  );
}
