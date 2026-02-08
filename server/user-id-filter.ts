import { ObjectId } from "mongodb";

type UserLookupFilter = {
  $or: Array<Record<string, string | ObjectId>>;
};

export function buildUserLookupFilter(sessionUserId: string): UserLookupFilter {
  const filters: UserLookupFilter["$or"] = [{ _id: sessionUserId }, { id: sessionUserId }];

  if (ObjectId.isValid(sessionUserId)) {
    filters.unshift({ _id: new ObjectId(sessionUserId) });
  }

  return { $or: filters };
}
