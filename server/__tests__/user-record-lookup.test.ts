import { test } from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { findUserBySessionId } from "../user-record-lookup";

type MockCollection = {
  findOne: (query: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
};

test("findUserBySessionId prefers ObjectId _id when session id is ObjectId-like", async () => {
  const sessionUserId = new ObjectId().toHexString();
  const expected = { _id: new ObjectId(sessionUserId), role: "patient" };
  const calls: Array<Record<string, unknown>> = [];

  const collection: MockCollection = {
    findOne: async (query) => {
      calls.push(query);
      if (query._id instanceof ObjectId) {
        return expected;
      }
      return null;
    },
  };

  const user = await findUserBySessionId(collection as never, sessionUserId);
  assert.deepEqual(user, expected);
  assert.equal(calls.length, 1);
  assert.ok(calls[0]._id instanceof ObjectId);
});

test("findUserBySessionId falls back to id when _id lookups miss", async () => {
  const sessionUserId = "user_123";
  const expected = { _id: "mongo-doc-1", id: sessionUserId, role: "coordinator" };
  const calls: Array<Record<string, unknown>> = [];

  const collection: MockCollection = {
    findOne: async (query) => {
      calls.push(query);
      if (query.id === sessionUserId) {
        return expected;
      }
      return null;
    },
  };

  const user = await findUserBySessionId(collection as never, sessionUserId);
  assert.deepEqual(user, expected);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { _id: sessionUserId });
  assert.deepEqual(calls[1], { id: sessionUserId });
});
