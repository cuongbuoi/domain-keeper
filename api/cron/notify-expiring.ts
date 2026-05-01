import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as nodemailer from 'nodemailer'
import { getDb, COLLECTIONS } from '../_lib/mongodb.js'
import { type ServiceDoc } from '../_lib/serializer.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const auth = req.headers.authorization
      if (auth !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
    }

    const thresholdDays = Number(process.env.THRESHOLD_DAYS ?? '7')
    const db = await getDb()

    const settings = await db.collection<{ adminEmail: string }>(COLLECTIONS.settings).findOne({})
    const adminEmail = settings?.adminEmail
    if (!adminEmail) return res.status(400).json({ error: 'Missing adminEmail' })

    const services = await db.collection<ServiceDoc>(COLLECTIONS.services).find().toArray()

    const today = new Date()
    const currentYear = today.getFullYear()
    const expiring: typeof services = []

    for (const s of services) {
      const regDate = new Date(s.registrationDate)
      let nextRenewal = new Date(today.getFullYear(), regDate.getMonth(), regDate.getDate())
      if (nextRenewal < today) {
        nextRenewal = new Date(today.getFullYear() + 1, regDate.getMonth(), regDate.getDate())
      }
      const diffDays = Math.ceil((nextRenewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays <= thresholdDays && diffDays >= 0 && s.lastNotifiedYear !== currentYear) {
        expiring.push(s)
      }
    }

    if (expiring.length === 0) {
      return res.status(200).json({ message: 'No expiring services' })
    }

    const smtpPort = Number(process.env.SMTP_PORT ?? '587')
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    const lines = expiring.map((s) => `- ${s.domain} (${s.type}) — đăng ký: ${s.registrationDate}`)
    const text = [`Các dịch vụ sắp hết hạn trong ${thresholdDays} ngày:`, ...lines, '', 'Vui lòng xử lý gia hạn.'].join(
      '\n'
    )

    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: adminEmail,
      subject: '[DomainKeeper] Cảnh báo dịch vụ sắp hết hạn',
      text
    })

    const ids = expiring.map((s: any) => s._id)
    await db
      .collection<ServiceDoc>(COLLECTIONS.services)
      .updateMany({ _id: { $in: ids } }, { $set: { lastNotifiedYear: currentYear } })

    return res.status(200).json({ sent: expiring.length, ids: ids.map((i) => i.toString()) })
  } catch (err: any) {
    console.error('[api/cron/notify-expiring]', err)
    return res.status(500).json({ error: err.message ?? 'Internal error' })
  }
}
