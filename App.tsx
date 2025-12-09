import React, { useState, useEffect, useMemo } from 'react'
import { ServiceRecord, ServiceType } from './types'
import { calculateRenewalStatus, formatCurrency, formatDate, getStatusColor } from './utils/dateUtils'
import { StatsCard } from './components/StatsCard'
import { ServiceFormModal } from './components/ServiceFormModal'
import { SettingsModal } from './components/SettingsModal'
import { supabase } from './utils/supabaseClient'
import { generateRenewalEmail } from './services/geminiService'

function App() {
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [adminEmail, setAdminEmail] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [notificationLog, setNotificationLog] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showSqlHelp, setShowSqlHelp] = useState(false)

  // State cho việc sửa dịch vụ
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null)

  // --- Helper: Handle Database Errors ---
  const handleDbError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error)

    // 42P01: Undefined table
    // 42703: Undefined column
    if (error.code === '42P01' || error.code === '42703') {
      setErrorMsg(`Lỗi cấu trúc dữ liệu: ${context}. Vui lòng cập nhật database.`)
      setShowSqlHelp(true)
    } else {
      alert(`Lỗi ${context}: ${error.message}`)
    }
  }

  // --- Fetch Data ---
  const fetchData = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      // 1. Fetch Services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .order('registration_date', { ascending: true })

      if (servicesError) {
        if (servicesError.code === '42P01') {
          setShowSqlHelp(true)
          throw new Error('Chưa tìm thấy bảng dữ liệu trong Supabase. Vui lòng chạy lệnh SQL (xem bên dưới).')
        }
        throw servicesError
      }

      // Map snake_case from DB to camelCase for frontend
      const mappedServices: ServiceRecord[] = (servicesData || []).map((item: any) => ({
        id: item.id.toString(),
        domain: item.domain,
        customerName: item.customer_name,
        customerEmail: item.customer_email,
        registrationDate: item.registration_date,
        amount: item.amount,
        type: item.type as ServiceType,
        notes: item.notes,
        lastNotifiedYear: item.last_notified_year || 0,
        lastPaymentYear: item.last_payment_year || 0
      }))

      setServices(mappedServices)

      // 2. Fetch Settings
      const { data: settingsData, error: settingsError } = await supabase.from('settings').select('*').limit(1).single()

      // Ignore error code PGRST116 (JSON object requested, multiple (or no) rows returned) which happens if table empty
      if (settingsError && settingsError.code !== 'PGRST116') {
        console.warn('Settings fetch warning:', settingsError.message)
      }

      if (settingsData) {
        setAdminEmail(settingsData.admin_email)
      } else {
        // Try to create default if table exists but is empty
        try {
          const { error: insertError } = await supabase.from('settings').insert([{ admin_email: 'admin@example.com' }])
          if (!insertError) setAdminEmail('admin@example.com')
        } catch (e) {
          console.log('Could not insert default settings, likely table missing.')
        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', JSON.stringify(error, null, 2))
      const message = error.message || 'Lỗi kết nối Supabase. Vui lòng kiểm tra cấu hình Key và URL.'
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  // --- Auto Check & Notify Logic ---
  const checkAutoNotifications = async (currentServices: ServiceRecord[], email: string) => {
    if (!email) return

    const today = new Date()
    const currentYear = today.getFullYear()
    const logs: string[] = []

    for (const service of currentServices) {
      const status = calculateRenewalStatus(service.registrationDate)

      // Điều kiện: Còn <= 2 ngày VÀ chưa gửi thông báo trong năm nay (cho lần gia hạn này)
      if (status.daysRemaining <= 2 && status.daysRemaining >= 0 && service.lastNotifiedYear !== currentYear) {
        logs.push(`Đang xử lý tự động cho: ${service.domain}...`)

        // 1. Tạo nội dung email bằng AI
        try {
          const emailContent = await generateRenewalEmail(service)

          // 2. Ở đây chúng ta MÔ PHỎNG việc gửi email
          console.log(`--- MÔ PHỎNG GỬI EMAIL ĐẾN ADMIN (${email}) ---`)
          console.log(emailContent)

          // 3. Cập nhật DB để không gửi lại
          const { error } = await supabase
            .from('services')
            .update({ last_notified_year: currentYear })
            .eq('id', service.id)

          if (!error) {
            logs.push(`✅ Đã gửi báo cáo gia hạn ${service.domain} tới ${email}`)
            // Cập nhật state local
            setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, lastNotifiedYear: currentYear } : s)))
          } else {
            logs.push(`❌ Lỗi cập nhật trạng thái cho ${service.domain}`)
          }
        } catch (err) {
          logs.push(`❌ Lỗi tạo AI nội dung cho ${service.domain}`)
        }
      }
    }

    if (logs.length > 0) {
      setNotificationLog(logs)
      // Tự động tắt log sau 10s
      setTimeout(() => setNotificationLog([]), 10000)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!loading && services.length > 0 && adminEmail) {
      checkAutoNotifications(services, adminEmail)
    }
  }, [loading, adminEmail])

  // --- Handlers ---

  const handleSaveService = async (data: Omit<ServiceRecord, 'id'>) => {
    try {
      const payload = {
        domain: data.domain,
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        registration_date: data.registrationDate,
        amount: data.amount,
        type: data.type,
        notes: data.notes,
        // Nếu đang sửa, giữ nguyên các trường tracking, nếu thêm mới thì là 0 hoặc lấy từ form (được truyền qua data)
        last_notified_year: editingService ? editingService.lastNotifiedYear : 0,
        last_payment_year: data.lastPaymentYear || (editingService ? editingService.lastPaymentYear : 0)
      }

      if (editingService) {
        // Update logic
        const { error } = await supabase.from('services').update(payload).eq('id', editingService.id)

        if (error) throw error
      } else {
        // Insert logic
        const { error } = await supabase.from('services').insert([payload])

        if (error) throw error
      }

      // Refresh data và đóng form
      fetchData()
      setIsFormOpen(false)
      setEditingService(null)
    } catch (error: any) {
      handleDbError(error, 'lưu dịch vụ')
    }
  }

  const handleTogglePayment = async (service: ServiceRecord) => {
    const currentYear = new Date().getFullYear()
    const isPaidThisYear = service.lastPaymentYear === currentYear

    // Nếu đã trả rồi thì reset về 0 (hoặc năm ngoái), nếu chưa thì set thành năm nay
    const newPaymentYear = isPaidThisYear ? 0 : currentYear

    try {
      const { error } = await supabase
        .from('services')
        .update({ last_payment_year: newPaymentYear })
        .eq('id', service.id)

      if (error) throw error

      // Update local state
      setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, lastPaymentYear: newPaymentYear } : s)))
    } catch (error: any) {
      handleDbError(error, 'cập nhật trạng thái thanh toán')
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa dịch vụ này?')) {
      try {
        const { error } = await supabase.from('services').delete().eq('id', id)
        if (error) throw error
        setServices(services.filter((s) => s.id !== id))
      } catch (error: any) {
        alert(`Lỗi khi xóa: ${error.message}`)
      }
    }
  }

  const handleOpenEdit = (service: ServiceRecord) => {
    setEditingService(service)
    setIsFormOpen(true)
  }

  const handleOpenAdd = () => {
    setEditingService(null)
    setIsFormOpen(true)
  }

  const handleSaveSettings = async (newEmail: string) => {
    try {
      const { data } = await supabase.from('settings').select('id').limit(1).single()

      if (data) {
        await supabase.from('settings').update({ admin_email: newEmail }).eq('id', data.id)
      } else {
        await supabase.from('settings').insert({ admin_email: newEmail })
      }
      setAdminEmail(newEmail)
      alert('Đã lưu cài đặt email Admin.')
    } catch (error: any) {
      handleDbError(error, 'lưu cài đặt')
    }
  }

  // --- Derived State ---
  const processedServices = useMemo(() => {
    return services
      .map((service) => ({
        ...service,
        renewalInfo: calculateRenewalStatus(service.registrationDate)
      }))
      .sort((a, b) => a.renewalInfo.daysRemaining - b.renewalInfo.daysRemaining)
  }, [services])

  const filteredServices = processedServices.filter(
    (s) =>
      s.domain.toLowerCase().includes(filter.toLowerCase()) ||
      s.customerName.toLowerCase().includes(filter.toLowerCase())
  )

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const totalRevenue = services.reduce((acc, curr) => acc + curr.amount, 0)
    // Tính doanh thu thực tế đã thu được trong năm nay
    const collectedRevenue = services
      .filter((s) => s.lastPaymentYear === currentYear)
      .reduce((acc, curr) => acc + curr.amount, 0)

    const expiringSoon = processedServices.filter(
      (s) => s.renewalInfo.status === 'urgent' || s.renewalInfo.status === 'soon'
    ).length

    return { totalRevenue, collectedRevenue, expiringSoon }
  }, [services, processedServices])

  // --- Setup Help UI ---
  if (showSqlHelp || errorMsg) {
    return (
      <div className='min-h-screen bg-slate-50 flex items-center justify-center p-4'>
        <div className='bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full'>
          <div className='flex items-center gap-3 text-red-600 mb-4'>
            <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              />
            </svg>
            <h1 className='text-2xl font-bold'>Lỗi Kết Nối Cơ Sở Dữ Liệu</h1>
          </div>

          <p className='text-gray-700 mb-4 font-medium'>{errorMsg}</p>

          <div className='bg-slate-100 p-4 rounded-lg border border-slate-300 overflow-x-auto'>
            <p className='text-sm text-slate-500 mb-2'>
              Nếu bạn chưa tạo bảng hoặc thiếu cột, hãy chạy lệnh SQL sau trong Supabase SQL Editor:
            </p>
            <pre className='text-xs text-slate-800 font-mono'>
              {`-- 1. Tạo bảng services (Nếu chưa có)
create table if not exists services (
  id bigint generated by default as identity primary key,
  domain text not null,
  customer_name text not null,
  customer_email text,
  registration_date date not null,
  amount numeric not null,
  type text not null,
  notes text,
  last_notified_year int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Thêm cột trạng thái thanh toán (Nếu bảng đã có từ trước)
alter table services add column if not exists last_payment_year int default 0;

-- 3. Tạo bảng settings
create table if not exists settings (
  id bigint generated by default as identity primary key,
  admin_email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Dữ liệu mẫu
insert into settings (admin_email) values ('admin@example.com');
`}
            </pre>
          </div>

          <div className='mt-6 flex justify-end gap-3'>
            <button
              onClick={fetchData}
              className='px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium'
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-slate-50 pb-10'>
      {/* Auto-Notification Toast */}
      {notificationLog.length > 0 && (
        <div className='fixed bottom-4 right-4 z-50 bg-gray-900 text-white p-4 rounded-lg shadow-lg max-w-sm animate-fade-in-up'>
          <div className='flex justify-between items-center mb-2'>
            <h3 className='font-bold text-sm text-green-400'>Hệ thống Tự động</h3>
            <button onClick={() => setNotificationLog([])} className='text-gray-400 hover:text-white'>
              &times;
            </button>
          </div>
          <ul className='space-y-1'>
            {notificationLog.map((log, idx) => (
              <li key={idx} className='text-xs'>
                {log}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Header */}
      <nav className='bg-white border-b border-gray-200 sticky top-0 z-30'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between h-16'>
            <div className='flex items-center gap-3'>
              <div className='bg-brand-600 p-2 rounded-lg'>
                <svg className='w-6 h-6 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                  />
                </svg>
              </div>
              <div>
                <h1 className='text-xl font-bold text-gray-900 tracking-tight'>DomainKeeper</h1>
                <p className='text-xs text-gray-500 hidden sm:block'>Quản lý gia hạn tự động</p>
              </div>
            </div>
            <div className='flex items-center gap-3'>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className='p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100'
                title='Cài đặt Admin'
              >
                <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                  />
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                  />
                </svg>
              </button>
              <button
                onClick={handleOpenAdd}
                className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors'
              >
                <svg className='-ml-1 mr-2 w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
                </svg>
                Thêm Dịch vụ
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8'>
        {/* Stats Section */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          <StatsCard
            title='Đã thu năm nay'
            value={formatCurrency(stats.collectedRevenue)}
            icon={
              <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
            }
            colorClass='bg-green-500'
          />
          <StatsCard
            title='Dự kiến doanh thu'
            value={formatCurrency(stats.totalRevenue)}
            icon={
              <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
            }
            colorClass='bg-blue-500'
          />
          <StatsCard
            title='Sắp hết hạn (30 ngày)'
            value={stats.expiringSoon}
            icon={
              <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
            }
            colorClass='bg-yellow-500'
          />
        </div>

        {/* List Section */}
        <div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
          <div className='px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50'>
            <h2 className='text-lg font-semibold text-gray-800'>Danh sách Dịch vụ</h2>
            <div className='relative w-full sm:w-64'>
              <input
                type='text'
                placeholder='Tìm tên khách hoặc domain...'
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500 bg-white'
              />
              <svg
                className='absolute left-3 top-2.5 w-4 h-4 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                />
              </svg>
            </div>
          </div>

          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50'>
                <tr>
                  <th
                    scope='col'
                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                  >
                    Dịch vụ / Domain
                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                  >
                    Khách hàng
                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                  >
                    Gia hạn kế tiếp
                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                  >
                    Số tiền
                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                  >
                    Trạng thái
                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider'
                  >
                    Thanh toán {new Date().getFullYear()}
                  </th>
                  <th
                    scope='col'
                    className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'
                  >
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {loading ? (
                  <tr>
                    <td colSpan={7} className='px-6 py-12 text-center text-gray-500 text-sm'>
                      Đang tải dữ liệu từ Supabase...
                    </td>
                  </tr>
                ) : filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className='px-6 py-12 text-center text-gray-500 text-sm'>
                      Chưa có dữ liệu nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((service) => {
                    const currentYear = new Date().getFullYear()
                    const isPaid = service.lastPaymentYear === currentYear

                    return (
                      <tr key={service.id} className='hover:bg-gray-50 transition-colors'>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='flex items-center'>
                            <div
                              className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${service.type === ServiceType.DOMAIN ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}
                            >
                              {service.type === ServiceType.DOMAIN
                                ? 'D'
                                : service.type === ServiceType.HOSTING
                                  ? 'H'
                                  : 'V'}
                            </div>
                            <div className='ml-4'>
                              <div className='text-sm font-medium text-gray-900'>{service.domain}</div>
                              <div className='text-xs text-gray-500'>{service.type}</div>
                            </div>
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='text-sm text-gray-900'>{service.customerName}</div>
                          <div className='text-xs text-gray-500'>{service.customerEmail}</div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='text-sm text-gray-900'>{formatDate(service.renewalInfo.nextRenewalDate)}</div>
                          <div className='text-xs text-gray-500'>Đăng ký: {formatDate(service.registrationDate)}</div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium'>
                          <div className='flex items-center gap-2'>
                            {formatCurrency(service.amount)}
                            {isPaid && (
                              <span className='inline-flex items-center justify-center w-4 h-4 bg-green-100 rounded-full'>
                                <svg
                                  className='w-3 h-3 text-green-600'
                                  fill='none'
                                  stroke='currentColor'
                                  viewBox='0 0 24 24'
                                >
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={3}
                                    d='M5 13l4 4L19 7'
                                  />
                                </svg>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='flex flex-col gap-1'>
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border w-fit ${getStatusColor(service.renewalInfo.status)}`}
                            >
                              {service.renewalInfo.daysRemaining < 0
                                ? `Quá hạn ${Math.abs(service.renewalInfo.daysRemaining)} ngày`
                                : `Còn ${service.renewalInfo.daysRemaining} ngày`}
                            </span>
                            {service.lastNotifiedYear === new Date().getFullYear() && (
                              <span className='text-[10px] text-green-600 flex items-center'>
                                <svg className='w-3 h-3 mr-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M5 13l4 4L19 7'
                                  />
                                </svg>
                                Đã báo Admin
                              </span>
                            )}
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-center'>
                          <button
                            onClick={() => handleTogglePayment(service)}
                            title={
                              isPaid ? 'Nhấn để hủy trạng thái đã thu' : 'Nhấn để đánh dấu đã thu tiền cho năm nay'
                            }
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center w-32 mx-auto ${
                              isPaid
                                ? 'bg-green-600 text-white hover:bg-green-700 ring-1 ring-green-600'
                                : 'bg-white text-gray-600 border border-gray-300 hover:border-brand-500 hover:text-brand-600 hover:shadow'
                            }`}
                          >
                            {isPaid ? (
                              <span className='flex items-center gap-1.5'>
                                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M5 13l4 4L19 7'
                                  />
                                </svg>
                                Đã thanh toán
                              </span>
                            ) : (
                              <span className='flex items-center gap-1.5'>
                                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                  />
                                </svg>
                                Xác nhận thu
                              </span>
                            )}
                          </button>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                          <button
                            onClick={() => handleOpenEdit(service)}
                            className='text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 px-3 py-1 rounded-md transition-colors'
                            title='Sửa dịch vụ'
                          >
                            <svg className='w-4 h-4 inline-block' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(service.id)}
                            className='text-red-600 hover:text-red-900 hover:bg-red-50 px-3 py-1 rounded-md transition-colors'
                            title='Xóa dịch vụ'
                          >
                            <svg className='w-4 h-4 inline-block' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <ServiceFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSaveService}
        initialData={editingService || undefined}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentEmail={adminEmail}
        onSave={handleSaveSettings}
      />
    </div>
  )
}

export default App
