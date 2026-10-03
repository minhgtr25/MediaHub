export function isReadByOtherMembers(
  message: { sender_id: string; created_at: string },
  members: { id: string; last_read_at?: string | null }[],
): boolean {
  const sentAt = new Date(message.created_at).getTime();
  const readers = members.filter(member => member.id !== message.sender_id);
  return Number.isFinite(sentAt) && readers.length > 0 && readers.every(member =>
    !!member.last_read_at && new Date(member.last_read_at).getTime() >= sentAt,
  );
}
export function mergeMessages<T extends { id: string; created_at: string }>(previous: T[], newest: T[]): T[] {
  const unique = new Map(previous.map(message => [message.id, message]));
  newest.forEach(message => unique.set(message.id, message));
  return [...unique.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
