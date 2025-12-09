import { createClient } from '@supabase/supabase-js'
import { ENV } from '../constants/env'

// Thay thế bằng URL và Key thực tế của bạn từ Supabase Dashboard
const SUPABASE_URL = ENV.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = ENV.VITE_SUPABASE_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
