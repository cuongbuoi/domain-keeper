import { GoogleGenAI } from '@google/genai'
import { ENV } from '../constants/env'
import { ServiceRecord } from '../types'
import { calculateRenewalStatus, formatCurrency, formatDate } from '../utils/dateUtils'

const apiKey = ENV.VITE_GEMINI_API_KEY || ''
const ai = new GoogleGenAI({ apiKey })

export const generateRenewalEmail = async (service: ServiceRecord): Promise<string> => {
  if (!apiKey) {
    return 'Lỗi: Chưa cấu hình API Key. Vui lòng kiểm tra biến môi trường.'
  }

  const renewalInfo = calculateRenewalStatus(service.registrationDate)
  const formattedDate = formatDate(renewalInfo.nextRenewalDate)
  const formattedAmount = formatCurrency(service.amount)

  const prompt = `
    Bạn là một trợ lý ảo chuyên nghiệp cho hệ thống quản lý Domain và Hosting.
    Hãy viết một email **gửi cho Admin (Quản trị viên)** để thông báo về việc dịch vụ của khách hàng sắp đến hạn thanh toán.
    
    Thông tin chi tiết dịch vụ cần gia hạn:
    - Tên khách hàng: ${service.customerName}
    - Email khách hàng: ${service.customerEmail}
    - Loại dịch vụ: ${service.type}
    - Tên dịch vụ (Domain/Gói): ${service.domain}
    - Ngày hết hạn: ${formattedDate}
    - Số tiền cần thu: ${formattedAmount}
    - Trạng thái: Còn ${renewalInfo.daysRemaining} ngày nữa.

    Yêu cầu nội dung email:
    - Tiêu đề: [Thông báo Admin] Gia hạn dịch vụ - ${service.domain}
    - Nội dung: Báo cáo ngắn gọn cho Admin biết thông tin khách hàng và số tiền cần thu.
    - Nhắc nhở Admin liên hệ khách hàng để thu phí gia hạn hoặc thực hiện thao tác gia hạn trên hệ thống.
    - Giọng điệu chuyên nghiệp, báo cáo công việc.
    
    Chỉ trả về nội dung email (bao gồm cả tiêu đề Subject ở dòng đầu tiên). Không cần lời dẫn của AI.
  `

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    })
    return response.text || 'Không thể tạo nội dung email.'
  } catch (error) {
    console.error('Gemini API Error:', error)
    return 'Đã xảy ra lỗi khi kết nối với AI để tạo email.'
  }
}
