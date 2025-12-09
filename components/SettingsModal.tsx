import React, { useState, useEffect } from 'react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentEmail: string
  onSave: (email: string) => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentEmail, onSave }) => {
  const [email, setEmail] = useState('')

  useEffect(() => {
    setEmail(currentEmail)
  }, [currentEmail, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(email)
    onClose()
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4'>
      <div className='bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up'>
        <div className='bg-gray-800 px-6 py-4 flex justify-between items-center'>
          <h2 className='text-white text-lg font-semibold'>Cài đặt Hệ thống</h2>
          <button onClick={onClose} className='text-gray-400 hover:text-white'>
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Email Admin (Nhận thông báo)</label>
            <input
              required
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='admin@company.com'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white'
            />
            <p className='mt-2 text-xs text-gray-500'>
              Hệ thống sẽ tự động gửi email thông báo về địa chỉ này trước ngày hết hạn 2 ngày.
            </p>
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
              className='px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700'
            >
              Lưu Cài đặt
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
