import React, { useState, useEffect } from 'react'
import { ServiceRecord, ServiceType } from '../types'

interface ServiceFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Omit<ServiceRecord, 'id'>) => void
  initialData?: ServiceRecord
}

export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
  const [formData, setFormData] = useState({
    domain: '',
    customerName: '',
    customerEmail: '',
    registrationDate: new Date().toISOString().split('T')[0],
    amount: 0,
    type: ServiceType.DOMAIN,
    notes: ''
  })

  useEffect(() => {
    if (initialData) {
      setFormData({
        domain: initialData.domain,
        customerName: initialData.customerName,
        customerEmail: initialData.customerEmail,
        registrationDate: initialData.registrationDate,
        amount: initialData.amount,
        type: initialData.type,
        notes: initialData.notes || ''
      })
    } else {
      // Reset logic if needed when opening fresh
      setFormData({
        domain: '',
        customerName: '',
        customerEmail: '',
        registrationDate: new Date().toISOString().split('T')[0],
        amount: 0,
        type: ServiceType.DOMAIN,
        notes: ''
      })
    }
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    onClose()
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4'>
      <div className='bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up'>
        <div className='bg-brand-600 px-6 py-4 flex justify-between items-center'>
          <h2 className='text-white text-lg font-semibold'>{initialData ? 'Cập nhật Dịch vụ' : 'Thêm Dịch vụ Mới'}</h2>
          <button onClick={onClose} className='text-white hover:text-gray-200'>
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Loại dịch vụ</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ServiceType })}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white'
              >
                <option value={ServiceType.DOMAIN}>Tên miền (Domain)</option>
                <option value={ServiceType.HOSTING}>Hosting</option>
                <option value={ServiceType.VPS}>VPS</option>
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Tên Domain/Service</label>
              <input
                required
                type='text'
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder='example.com'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white'
              />
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Tên khách hàng</label>
              <input
                required
                type='text'
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder='Nguyễn Văn A'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Email khách hàng</label>
              <input
                type='email'
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                placeholder='email@example.com'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white'
              />
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Ngày đăng ký</label>
              <input
                required
                type='date'
                value={formData.registrationDate}
                onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Số tiền thu (VND)</label>
              <input
                required
                type='number'
                min='0'
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white'
              />
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Ghi chú</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white'
            />
          </div>

          <div className='flex justify-end gap-3 pt-4 border-t border-gray-100'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50'
            >
              Hủy
            </button>
            <button
              type='submit'
              className='px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:ring-4 focus:ring-brand-200'
            >
              {initialData ? 'Lưu thay đổi' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
