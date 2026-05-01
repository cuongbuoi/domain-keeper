<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DomainKeeper

Quản lý gia hạn dịch vụ (domain / hosting / VPS) với cảnh báo email tự động.

**Stack**: Vite + React 19 · MongoDB Atlas · Vercel Functions (API) · Vercel Cron (notification).

## Run Locally

**Prerequisites**: Node.js >= 20, Yarn

1. Cài deps: `yarn install`
2. Tạo file `.env` (xem mẫu bên dưới)
3. Frontend-only dev: `yarn dev` (chạy ở port 3000, gọi `/api/*` sẽ 404)
4. Full-stack dev (frontend + API): `yarn dev:vercel` (cần cài Vercel CLI: `npm i -g vercel`)

### `.env` mẫu
```
# Frontend
VITE_GEMINI_API_KEY=

# Backend (Vercel Functions)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?appName=Cluster0
MONGODB_DB=domainkeeper

# Cron protection
CRON_SECRET=<random-string>

# SMTP cho email cảnh báo
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=
THRESHOLD_DAYS=7
```

## API endpoints

| Method | Path | Mục đích |
|---|---|---|
| GET | `/api/services` | List services |
| POST | `/api/services` | Tạo service mới |
| PUT | `/api/services/:id` | Update toàn bộ |
| PATCH | `/api/services/:id` | Update `lastPaymentYear` / `lastNotifiedYear` |
| DELETE | `/api/services/:id` | Xoá |
| GET | `/api/settings` | Lấy admin email |
| PUT | `/api/settings` | Update admin email |
| GET | `/api/cron/notify-expiring` | Quét + gửi email (yêu cầu Bearer `CRON_SECRET`) |

## Deploy lên Vercel

1. Push code lên GitHub.
2. Import repo vào Vercel; framework auto-detect là Vite.
3. Vào **Project Settings → Environment Variables**, thêm tất cả biến trong `.env` (ngoại trừ `VITE_GEMINI_API_KEY` đã ở client).
4. Deploy.
5. **Cron**: `vercel.json` đã khai báo `crons` (mặc định 09:00 UTC mỗi ngày). Vercel tự động gắn header `Authorization: Bearer <CRON_SECRET>` nếu biến môi trường này tồn tại.
   - Hobby plan: tối đa 1 cron/ngày — schedule `0 9 * * *` đã hợp lệ.
   - Đổi giờ chạy bằng cách sửa `vercel.json`.

## Migrate từ Supabase (1 lần)

Nếu có dump SQL `pg_dump` của project Supabase cũ:
```bash
node --env-file=.env scripts/migrate-from-sql.mjs path/to/dump.sql
```
Script sẽ parse 2 bảng `public.services` + `public.settings` và đẩy vào collection MongoDB tương ứng (xoá data cũ trước khi insert).
