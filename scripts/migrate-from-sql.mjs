// Đọc dump SQL của Supabase, parse 2 bảng services + settings và đẩy vào MongoDB.
// Cách dùng: node scripts/migrate-from-sql.mjs <path-to-dump.sql>
// Yêu cầu env: MONGODB_URI, MONGODB_DB

import fs from 'node:fs'
import path from 'node:path'
import { MongoClient } from 'mongodb'

const dumpPath = process.argv[2]
if (!dumpPath) {
  console.error('Usage: node scripts/migrate-from-sql.mjs <path-to-dump.sql>')
  process.exit(1)
}

const MONGODB_URI = process.env.MONGODB_URI
const MONGODB_DB = process.env.MONGODB_DB || 'domainkeeper'
if (!MONGODB_URI) {
  console.error('MONGODB_URI is required')
  process.exit(1)
}

const sql = fs.readFileSync(path.resolve(dumpPath), 'utf8')

function extractCopyBlock(tableName) {
  const re = new RegExp(`^COPY public\\.${tableName} \\(([^)]+)\\) FROM stdin;\\n([\\s\\S]*?)^\\\\\\.`, 'm')
  const match = sql.match(re)
  if (!match) return null
  const columns = match[1].split(',').map((c) => c.trim())
  const rows = match[2]
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const values = line.split('\t').map((v) => (v === '\\N' ? null : v))
      const row = {}
      columns.forEach((col, i) => (row[col] = values[i]))
      return row
    })
  return rows
}

const servicesRaw = extractCopyBlock('services') ?? []
const settingsRaw = extractCopyBlock('settings') ?? []

console.log(`Tìm thấy ${servicesRaw.length} services, ${settingsRaw.length} settings`)

const services = servicesRaw.map((r) => ({
  domain: r.domain,
  customerName: r.customer_name,
  customerEmail: r.customer_email ?? '',
  registrationDate: r.registration_date,
  amount: Number(r.amount),
  type: r.type,
  notes: r.notes ?? '',
  lastNotifiedYear: Number(r.last_notified_year ?? 0),
  lastPaymentYear: Number(r.last_payment_year ?? 0),
  createdAt: r.created_at ? new Date(r.created_at) : new Date(),
  legacyId: Number(r.id)
}))

const settings = settingsRaw.map((r) => ({
  adminEmail: r.admin_email,
  updatedAt: r.created_at ? new Date(r.created_at) : new Date()
}))

const client = new MongoClient(MONGODB_URI)
await client.connect()
const db = client.db(MONGODB_DB)

if (services.length > 0) {
  await db.collection('services').deleteMany({})
  await db.collection('services').insertMany(services)
  console.log(`✅ Đã insert ${services.length} services`)
}

if (settings.length > 0) {
  await db.collection('settings').deleteMany({})
  await db.collection('settings').insertOne(settings[0])
  console.log(`✅ Đã insert settings: ${settings[0].adminEmail}`)
}

await client.close()
console.log('Done.')
