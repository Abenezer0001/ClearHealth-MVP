import { ObjectId, type Collection, type Document, type WithId } from "mongodb";

export async function findUserBySessionId(
  userCollection: Collection<Document>,
  sessionUserId: string,
): Promise<WithId<Document> | null> {
  if (ObjectId.isValid(sessionUserId)) {
    const byObjectId = await userCollection.findOne({ _id: new ObjectId(sessionUserId) });
    if (byObjectId) return byObjectId;
  }

  const byStringId = await userCollection.findOne({ _id: sessionUserId } as Document);
  if (byStringId) return byStringId;

  return userCollection.findOne({ id: sessionUserId });
}
