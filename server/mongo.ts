import { MongoClient, type Db } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

function getMongoUri(): string {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error("DATABASE_URL is required");
  }
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error("DATABASE_URL must be a MongoDB URI (mongodb:// or mongodb+srv://)");
  }
  return uri;
}

export async function getMongoDb(): Promise<Db> {
  if (!clientPromise) {
    const client = new MongoClient(getMongoUri());
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  return client.db();
}

export async function getNextSequence(name: string): Promise<number> {
  const db = await getMongoDb();
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return (result?.seq as number | undefined) ?? 1;
}
