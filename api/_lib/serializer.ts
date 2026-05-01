import { ObjectId, type WithId, type Document } from 'mongodb'

export type ServiceDoc = {
  domain: string
  customerName: string
  customerEmail: string
  registrationDate: string
  amount: number
  type: string
  notes?: string
  lastNotifiedYear: number
  lastPaymentYear: number
  createdAt: Date
}

export function serializeService(doc: WithId<Document>) {
  const { _id, createdAt, ...rest } = doc as WithId<ServiceDoc>
  return {
    id: _id.toString(),
    ...rest,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt
  }
}

export function toObjectId(id: unknown): ObjectId | null {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) return null
  return new ObjectId(id)
}

export function pickServicePayload(body: any): Omit<ServiceDoc, 'createdAt'> {
  return {
    domain: String(body.domain ?? '').trim(),
    customerName: String(body.customerName ?? '').trim(),
    customerEmail: String(body.customerEmail ?? '').trim(),
    registrationDate: String(body.registrationDate ?? ''),
    amount: Number(body.amount ?? 0),
    type: String(body.type ?? ''),
    notes: body.notes ? String(body.notes) : '',
    lastNotifiedYear: Number(body.lastNotifiedYear ?? 0),
    lastPaymentYear: Number(body.lastPaymentYear ?? 0)
  }
}
