import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb, COLLECTIONS } from '../_lib/mongodb'
import { pickServicePayload, serializeService, toObjectId, type ServiceDoc } from '../_lib/serializer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const _id = await toObjectId(req.query.id)
    if (!_id) return res.status(400).json({ error: 'Invalid id' })

    const db = await getDb()
    const col = db.collection<ServiceDoc>(COLLECTIONS.services)

    if (req.method === 'PUT') {
      const payload = pickServicePayload(req.body)
      const result = await col.findOneAndUpdate({ _id }, { $set: payload }, { returnDocument: 'after' })
      if (!result) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json(serializeService(result))
    }

    if (req.method === 'PATCH') {
      const allowed = ['lastNotifiedYear', 'lastPaymentYear'] as const
      const update: Record<string, unknown> = {}
      for (const key of allowed) {
        if (key in req.body) update[key] = Number(req.body[key])
      }
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No allowed fields to update' })
      }
      const result = await col.findOneAndUpdate({ _id }, { $set: update }, { returnDocument: 'after' })
      if (!result) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json(serializeService(result))
    }

    if (req.method === 'DELETE') {
      const result = await col.deleteOne({ _id })
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Not found' })
      return res.status(204).end()
    }

    res.setHeader('Allow', 'PUT, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[api/services/:id]', err)
    return res.status(500).json({ error: err.message ?? 'Internal error' })
  }
}
