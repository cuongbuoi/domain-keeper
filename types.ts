export enum ServiceType {
  DOMAIN = 'DOMAIN',
  HOSTING = 'HOSTING',
  VPS = 'VPS'
}

export interface ServiceRecord {
  id: string // Supabase trả về number (bigint) nhưng ta convert sang string cho frontend dễ xử lý
  domain: string
  customerName: string
  customerEmail: string
  registrationDate: string // ISO Date string YYYY-MM-DD
  amount: number
  type: ServiceType
  notes?: string
  lastNotifiedYear?: number // Năm gần nhất đã gửi thông báo gia hạn
  lastPaymentYear?: number // Năm gần nhất đã thanh toán
}

export interface RenewalStatus {
  daysRemaining: number
  nextRenewalDate: Date
  status: 'expired' | 'urgent' | 'soon' | 'safe'
}

export interface AppSettings {
  id?: string
  adminEmail: string
}
