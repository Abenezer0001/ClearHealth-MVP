import { test } from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { buildUserLookupFilter } from "../user-id-filter";

test("buildUserLookupFilter includes ObjectId and string fallbacks for valid ObjectId ids", () => {
  const id = new ObjectId().toHexString();
  const filter = buildUserLookupFilter(id) as { $or: Array<Record<string, unknown>> };

  assert.ok(Array.isArray(filter.$or));
  assert.equal(filter.$or.length, 3);
  assert.deepEqual(filter.$or[0], { _id: new ObjectId(id) });
  assert.deepEqual(filter.$or[1], { _id: id });
  assert.deepEqual(filter.$or[2], { id });
});

test("buildUserLookupFilter keeps string-based matching for non-ObjectId ids", () => {
  const id = "user_12345";
  const filter = buildUserLookupFilter(id) as { $or: Array<Record<string, unknown>> };

  assert.ok(Array.isArray(filter.$or));
  assert.equal(filter.$or.length, 2);
  assert.deepEqual(filter.$or[0], { _id: id });
  assert.deepEqual(filter.$or[1], { id });
});
