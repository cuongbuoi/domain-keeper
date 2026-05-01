import { MongoClient, type Db } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'domainkeeper'

if (!uri) {
  throw new Error('MONGODB_URI is required')
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

const clientPromise: Promise<MongoClient> =
  global._mongoClientPromise ?? (global._mongoClientPromise = new MongoClient(uri).connect())

export async function getDb(): Promise<Db> {
  const client = await clientPromise
  return client.db(dbName)
}

export const COLLECTIONS = {
  services: 'services',
  settings: 'settings'
} as const
