import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

/**
 * Why the timeout increase?
 * MongoMemoryServer downloads a real MongoDB binary on first run.
 * This can take 30-120 seconds depending on internet speed.
 * After the first download it's cached — subsequent runs are instant.
 *
 * Why let mongod be undefined initially?
 * The variable is declared at module level so stopTestDB can access it.
 * We use a definite assignment guard in stopTestDB to handle the case
 * where startTestDB timed out and mongod was never assigned.
 */
let mongod: MongoMemoryServer | undefined;

export async function startTestDB(): Promise<void> {
  mongod = await MongoMemoryServer.create({
    instance: {
      // Use a random available port — avoids port conflicts
      // when running multiple test files in parallel
      port: undefined,
    },
  });

  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

export async function stopTestDB(): Promise<void> {
  await mongoose.disconnect();
  // Guard — if startTestDB timed out, mongod is undefined
  if (mongod) {
    await mongod.stop();
  }
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key]?.deleteMany({});
  }
}
