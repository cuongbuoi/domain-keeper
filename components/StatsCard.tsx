import React from 'react'

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  colorClass: string
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, colorClass }) => {
  return (
    <div className='bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4'>
      <div className={`p-3 rounded-full ${colorClass} text-white`}>{icon}</div>
      <div>
        <p className='text-sm font-medium text-slate-500'>{title}</p>
        <p className='text-2xl font-bold text-slate-800'>{value}</p>
      </div>
    </div>
  )
}
