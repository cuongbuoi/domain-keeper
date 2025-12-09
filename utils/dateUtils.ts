import { RenewalStatus } from '../types'

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('vi-VN')
}

export const calculateRenewalStatus = (registrationDateStr: string): RenewalStatus => {
  const regDate = new Date(registrationDateStr)
  const today = new Date()

  // Create a date object for the renewal in the current year
  let nextRenewal = new Date(today.getFullYear(), regDate.getMonth(), regDate.getDate())

  // If the renewal date for this year has already passed, the next renewal is next year
  if (nextRenewal < today) {
    nextRenewal = new Date(today.getFullYear() + 1, regDate.getMonth(), regDate.getDate())
  }

  const diffTime = nextRenewal.getTime() - today.getTime()
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  let status: RenewalStatus['status'] = 'safe'

  if (daysRemaining < 0) status = 'expired'
  else if (daysRemaining <= 7)
    status = 'urgent' // Less than a week
  else if (daysRemaining <= 30) status = 'soon' // Less than a month

  return {
    daysRemaining,
    nextRenewalDate: nextRenewal,
    status
  }
}

export const getStatusColor = (status: RenewalStatus['status']): string => {
  switch (status) {
    case 'expired':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'urgent':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'soon':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'safe':
      return 'bg-green-100 text-green-800 border-green-200'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
