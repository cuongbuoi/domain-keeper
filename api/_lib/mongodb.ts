import type { Db, MongoClient } from 'mongodb'

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

async function getClientPromise(): Promise<MongoClient> {
  if (global._mongoClientPromise) return global._mongoClientPromise

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables')
  }

  // Dynamic import để tránh top-level bundle crash; nếu mongodb fail load thì error
  // sẽ rơi vào try/catch của từng route handler -> response JSON chuẩn.
  const { MongoClient } = await import('mongodb')

  global._mongoClientPromise = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS: 8_000
  }).connect()
  return global._mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  const dbName = process.env.MONGODB_DB || 'domainkeeper'
  return client.db(dbName)
}

export const COLLECTIONS = {
  services: 'services',
  settings: 'settings'
} as const
