import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb, COLLECTIONS } from '../_lib/mongodb'
import { pickServicePayload, serializeService, type ServiceDoc } from '../_lib/serializer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = await getDb()
    const col = db.collection<ServiceDoc>(COLLECTIONS.services)

    if (req.method === 'GET') {
      const docs = await col.find().sort({ registrationDate: 1 }).toArray()
      return res.status(200).json(docs.map(serializeService))
    }

    if (req.method === 'POST') {
      const payload = pickServicePayload(req.body)
      if (!payload.domain || !payload.customerName || !payload.registrationDate) {
        return res.status(400).json({ error: 'domain, customerName, registrationDate là bắt buộc' })
      }
      const doc: ServiceDoc = { ...payload, createdAt: new Date() }
      const result = await col.insertOne(doc)
      return res.status(201).json(serializeService({ _id: result.insertedId, ...doc }))
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[api/services]', err)
    return res.status(500).json({ error: err.message ?? 'Internal error' })
  }
}
