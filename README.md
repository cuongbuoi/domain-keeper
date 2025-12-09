<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1dBMduHnFnmFGXpXZbBfFunopXPedz8Sz

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Supabase Cron: notify-expiring-services

Edge Function `notify-expiring-services` quét dịch vụ sắp hết hạn (<=7 ngày mặc định) và gửi email tóm tắt tới admin.

### Biến môi trường cho Edge Function
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `FROM_EMAIL`
- `THRESHOLD_DAYS` (tuỳ chọn, mặc định 7)

### Triển khai & kiểm thử (Supabase CLI)
```bash
# Deploy Edge Function
supabase functions deploy notify-expiring-services --project-ref <project-ref>

# Invoke thủ công (bỏ qua JWT)
supabase functions invoke notify-expiring-services --project-ref <project-ref> --no-verify-jwt
```

### Lên lịch Cron hằng ngày (02:00 UTC)
Chạy trong SQL Editor:
```sql
select
  cron.schedule(
    'notify-expiring-daily',
    '0 2 * * *',
    $$
    select net.http_post(
      url := 'https://<project>.functions.supabase.co/notify-expiring-services',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := '{}'
    );
    $$
  );
```
