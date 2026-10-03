import { test } from "node:test";
import assert from "node:assert/strict";
import { isReadByOtherMembers, mergeMessages } from "../src/lib/messaging.ts";

test("read receipts require persisted timestamps from every other participant", () => {
  const message = { sender_id: "sender", created_at: "2026-10-03T00:00:00Z" };
  const sender = { id: "sender", last_read_at: "2026-10-03T00:01:00Z" };
  const reader = { id: "reader", last_read_at: "2026-10-03T00:01:00Z" };
  assert.equal(isReadByOtherMembers(message, [sender]), false);
  assert.equal(isReadByOtherMembers(message, [sender, { id: "reader" }]), false);
  assert.equal(isReadByOtherMembers(message, [sender, { ...reader, last_read_at: "2026-10-02T23:59:00Z" }]), false);
  assert.equal(isReadByOtherMembers(message, [sender, { ...reader, last_read_at: "invalid" }]), false);
  assert.equal(isReadByOtherMembers(message, [sender, reader]), true);
  assert.equal(isReadByOtherMembers(message, [sender, reader, { id: "third" }]), false);
});

test("older history survives reloads and repeated realtime pages without duplicates", () => {
  const older = { id: "a", created_at: "2026-10-02T00:00:00Z", content: "Older" };
  const first = { id: "b", created_at: "2026-10-03T00:00:00+00:00", content: "Initial" };
  const updated = { ...first, content: "Refreshed" };
  const newest = { id: "c", created_at: first.created_at, content: "Newest" };
  const messages = mergeMessages([first, older], [newest, updated, newest]);
  assert.deepEqual(messages.map(m => m.id), ["a", "b", "c"]);
  assert.equal(messages[1].content, "Refreshed");
  assert.deepEqual(mergeMessages(messages, [newest]), messages);
});
