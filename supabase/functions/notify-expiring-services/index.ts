// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// Edge Function: notify-expiring-services
// Mục tiêu: quét dịch vụ sắp hết hạn (<= thresholdDays) và gửi email tóm tắt tới admin.
// Yêu cầu env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const smtpHost = Deno.env.get('SMTP_HOST')!
const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '587')
const smtpUser = Deno.env.get('SMTP_USER')!
const smtpPass = Deno.env.get('SMTP_PASS')!
const fromEmail = Deno.env.get('FROM_EMAIL')!

// Ngưỡng cảnh báo: còn <= X ngày
const thresholdDays = Number(Deno.env.get('THRESHOLD_DAYS') ?? '7')

const supabase = createClient(supabaseUrl, serviceRoleKey)

type ServiceRow = {
  id: number
  domain: string
  customer_name: string
  customer_email: string | null
  registration_date: string
  amount: number
  type: string
  notes: string | null
  last_notified_year: number
}

serve(async () => {
  const today = new Date()
  const currentYear = today.getFullYear()

  // Lấy email admin
  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('admin_email')
    .limit(1)
    .single()

  if (settingsError || !settings?.admin_email) {
    return new Response(JSON.stringify({ error: 'Missing admin_email', details: settingsError?.message }), {
      status: 400
    })
  }

  const adminEmail = settings.admin_email as string

  // Lấy danh sách dịch vụ
  const { data: services, error: svcError } = await supabase.from('services').select('*')
  if (svcError) {
    return new Response(JSON.stringify({ error: svcError.message }), { status: 500 })
  }

  const expiring: ServiceRow[] = []

  for (const s of (services || []) as ServiceRow[]) {
    const regDate = new Date(s.registration_date)
    let nextRenewal = new Date(today.getFullYear(), regDate.getMonth(), regDate.getDate())
    if (nextRenewal < today) nextRenewal = new Date(today.getFullYear() + 1, regDate.getMonth(), regDate.getDate())

    const diffDays = Math.ceil((nextRenewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const shouldNotify = diffDays <= thresholdDays && diffDays >= 0 && s.last_notified_year !== currentYear

    if (shouldNotify) {
      expiring.push(s)
    }
  }

  if (expiring.length === 0) {
    return new Response(JSON.stringify({ message: 'No expiring services' }), { status: 200 })
  }

  // Gửi email
  const client = new SmtpClient()
  const smtpOptions = {
    hostname: smtpHost,
    port: smtpPort,
    username: smtpUser,
    password: smtpPass
  }

  try {
    // Dùng TLS implicit cho 465, còn lại dùng STARTTLS
    if (smtpPort === 465) {
      await client.connectTLS(smtpOptions)
    } else {
      await client.connect({ ...smtpOptions, starttls: true })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'SMTP connect failed', details: `${e}` }), { status: 500 })
  }

  const lines = expiring.map((s) => `- ${s.domain} (${s.type}) — đăng ký: ${s.registration_date}`)
  const textBody = ['Các dịch vụ sắp hết hạn trong 7 ngày:', ...lines, '', 'Vui lòng xử lý gia hạn.'].join('\n')

  try {
    await client.send({
      from: fromEmail,
      to: adminEmail,
      subject: '[DomainKeeper] Cảnh báo dịch vụ sắp hết hạn',
      content: textBody
    })
  } catch (e) {
    await client.close()
    return new Response(JSON.stringify({ error: 'SMTP send failed', details: `${e}` }), { status: 500 })
  }
  await client.close()

  // Cập nhật last_notified_year
  const ids = expiring.map((s) => s.id)
  const { error: updateError } = await supabase
    .from('services')
    .update({ last_notified_year: currentYear })
    .in('id', ids)

  if (updateError) {
    return new Response(JSON.stringify({ sent: expiring.length, updateError: updateError.message }), { status: 207 })
  }

  return new Response(JSON.stringify({ sent: expiring.length, ids }), { status: 200 })
})
