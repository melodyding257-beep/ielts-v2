import { z } from 'zod'

// 表单验证 schema
export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少 6 位'),
})

export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少 6 位'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
})

export const uploadPdfSchema = z.object({
  file: z.instanceof(File).refine((file) => file.type === 'application/pdf', {
    message: '只能上传 PDF 文件',
  }),
})
