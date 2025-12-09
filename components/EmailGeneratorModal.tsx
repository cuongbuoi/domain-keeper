import React, { useEffect, useState } from 'react'
import { ServiceRecord } from '../types'
import { generateRenewalEmail } from '../services/geminiService'

interface EmailGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  service: ServiceRecord | null
}

export const EmailGeneratorModal: React.FC<EmailGeneratorModalProps> = ({ isOpen, onClose, service }) => {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const ADMIN_EMAIL = 'admin@company.com' // Placeholder for admin email

  useEffect(() => {
    if (isOpen && service) {
      setLoading(true)
      setContent('')
      setIsCopied(false)
      generateRenewalEmail(service)
        .then((generatedText) => {
          setContent(generatedText)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [isOpen, service])

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  if (!isOpen || !service) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4'>
      <div className='bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col animate-fade-in-up'>
        <div className='bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex justify-between items-center shrink-0 rounded-t-xl'>
          <div className='flex items-center gap-2'>
            <svg className='w-5 h-5 text-yellow-300' fill='currentColor' viewBox='0 0 20 20'>
              <path d='M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z' />
            </svg>
            <h2 className='text-white text-lg font-semibold'>Tạo Thông Báo Admin (AI)</h2>
          </div>
          <button onClick={onClose} className='text-white/80 hover:text-white'>
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        <div className='flex-1 overflow-auto p-6 bg-slate-50'>
          {loading ? (
            <div className='flex flex-col items-center justify-center h-full space-y-4'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600'></div>
              <p className='text-slate-500 animate-pulse'>Gemini đang tạo báo cáo về {service.domain}...</p>
            </div>
          ) : (
            <div className='bg-white p-6 rounded-lg shadow-sm border border-slate-200 whitespace-pre-wrap font-sans text-slate-800 leading-relaxed'>
              {content}
            </div>
          )}
        </div>

        <div className='p-4 border-t border-gray-200 bg-white rounded-b-xl flex justify-between items-center shrink-0'>
          <span className='text-sm text-gray-500'>
            Gửi tới Admin: <span className='font-medium text-gray-700'>{ADMIN_EMAIL}</span>
          </span>
          <div className='flex gap-3'>
            <button
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg'
            >
              Đóng
            </button>
            <button
              onClick={handleCopy}
              disabled={loading || !content}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                isCopied ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
              } disabled:opacity-50`}
            >
              {isCopied ? (
                <>
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                  </svg>
                  Đã sao chép
                </>
              ) : (
                <>
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3'
                    />
                  </svg>
                  Sao chép nội dung
                </>
              )}
            </button>
            <a
              href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`Thông báo gia hạn: ${service.domain}`)}&body=${encodeURIComponent(content)}`}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                />
              </svg>
              Mở Mail App
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
