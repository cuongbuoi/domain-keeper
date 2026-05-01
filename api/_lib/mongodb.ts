import { MongoClient, type Db } from 'mongodb'

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function getClientPromise(): Promise<MongoClient> {
  if (global._mongoClientPromise) return global._mongoClientPromise

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables')
  }

  // serverSelectionTimeoutMS thấp để fail nhanh thay vì treo function 30s
  global._mongoClientPromise = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10_000
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
