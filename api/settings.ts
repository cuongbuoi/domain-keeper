import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb, COLLECTIONS } from './_lib/mongodb'

type SettingsDoc = {
  adminEmail: string
  updatedAt?: Date
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getDb()
    const col = db.collection<SettingsDoc>(COLLECTIONS.settings)

    if (req.method === 'GET') {
      const doc = await col.findOne({})
      return res.status(200).json({ adminEmail: doc?.adminEmail ?? '' })
    }

    if (req.method === 'PUT') {
      const adminEmail = String(req.body?.adminEmail ?? '').trim()
      if (!adminEmail) return res.status(400).json({ error: 'adminEmail là bắt buộc' })
      await col.updateOne({}, { $set: { adminEmail, updatedAt: new Date() } }, { upsert: true })
      return res.status(200).json({ adminEmail })
    }

    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[api/settings]', err)
    return res.status(500).json({ error: err.message ?? 'Internal error' })
  }
}
