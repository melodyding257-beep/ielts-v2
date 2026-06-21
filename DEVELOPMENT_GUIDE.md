# 开发指南

## 当前状态

项目骨架已搭建完成，包含：
- ✅ Next.js 15 项目初始化
- ✅ 目录结构组织
- ✅ Supabase 配置文件
- ✅ 类型定义
- ✅ API 路由骨架
- ✅ 页面骨架
- ✅ 基础 UI 组件
- ✅ 数据库 schema
- ✅ 中间件配置

**所有文件都只包含骨架代码，业务逻辑待实现。**

---

## 下一步开发建议

### 步骤 1: 配置 Supabase（必须先完成）

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 在 SQL Editor 中执行 `supabase/schema.sql`
3. 在 Storage 中创建 bucket（名为 `pdfs`）
4. 复制 `.env.example` 为 `.env.local`，填入：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 步骤 2: 安装依赖并测试

```bash
npm install
npm run dev
```

访问 http://localhost:3000 应该能看到首页。

### 步骤 3: 实现功能（按优先级）

#### 3.1 用户认证（优先级：最高）

**文件：**
- `app/auth/login/page.tsx`
- `app/auth/register/page.tsx`
- `app/api/auth/callback/route.ts`

**需要实现：**
- 登录表单（邮箱 + 密码）
- 注册表单（邮箱 + 密码 + 确认密码）
- 使用 `lib/supabase/client.ts` 调用 `supabase.auth.signInWithPassword()` 和 `signUp()`
- 认证回调处理（从 URL 获取 token，刷新 session）
- 错误处理和提示

**参考代码结构：**
```typescript
// app/auth/login/page.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (!error) router.push('/dashboard')
  }

  return (
    // ... 表单 UI
  )
}
```

#### 3.2 PDF 上传和解析（优先级：高）

**文件：**
- `app/api/pdf/upload/route.ts`
- `components/ui/FileUpload.tsx`
- `lib/utils/pdf-parser.ts`

**需要实现：**
1. 前端文件选择和上传
2. 后端接收文件（`FormData`）
3. 使用 `pdf-parse` 解析 PDF
4. 上传到 Supabase Storage
5. 保存记录到数据库（`pdfs` 表）

**关键代码片段：**
```typescript
// app/api/pdf/upload/route.ts
import { createClient } from '@/lib/supabase/server'
import { parsePdf } from '@/lib/utils/pdf-parser'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const buffer = Buffer.from(await file.arrayBuffer())
  
  // 解析 PDF
  const parsedText = await parsePdf(buffer)
  
  // 上传到 Supabase Storage
  const { data: uploadData } = await supabase.storage
    .from('pdfs')
    .upload(`${user.id}/${file.name}`, buffer)
  
  // 保存记录到数据库
  const { data } = await supabase.from('pdfs').insert({
    user_id: user.id,
    file_name: file.name,
    file_path: uploadData.path,
    parsed_content: parsedText,
  }).select().single()
  
  return NextResponse.json({ pdf: data })
}
```

#### 3.3 Dashboard 页面（优先级：中）

**文件：**
- `app/dashboard/page.tsx`
- `app/api/pdf/list/route.ts`

**需要实现：**
- 获取用户上传的 PDF 列表
- 展示列表（文件名、上传时间）
- 点击进入练习页面（链接到 `/practice/[id]`）

#### 3.4 机考练习界面（优先级：高）

**文件：**
- `app/practice/[id]/page.tsx`
- `components/practice/Timer.tsx`
- `components/practice/QuestionList.tsx`

**需要实现：**
1. 从数据库获取 PDF 和解析内容
2. 左侧显示文章内容
3. 右侧显示题目（暂时可以 mock 数据）
4. 计时器（倒计时或正计时）
5. 答题交互（保存答案到 state）
6. 提交按钮

**注意：** 题目解析是一个复杂的 NLP 任务，初期可以：
- 手动标注题目（在 parsed_content 中以 JSON 格式存储）
- 或者简单地按行分割，让用户手动输入答案

#### 3.5 答案提交和判分（优先级：高）

**文件：**
- `app/api/practice/submit/route.ts`

**需要实现：**
- 接收答案（`{ questionId: answer }`）
- 对比正确答案（需要在 PDF 中提前标注）
- 计算分数
- 保存到 `practice_records` 表

#### 3.6 做题记录展示（优先级：中）

**文件：**
- `app/api/practice/records/route.ts`
- `app/dashboard/page.tsx`（或单独页面）

**需要实现：**
- 从数据库获取用户做题记录
- 展示分数、用时、日期
- 支持查看详细答案（可选）

---

## 技术要点

### Supabase Auth

```typescript
// 获取当前用户（Server Component）
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

// 客户端登录
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
await supabase.auth.signInWithPassword({ email, password })
```

### PDF 解析

```typescript
import pdf from 'pdf-parse'
const data = await pdf(buffer)
console.log(data.text) // 提取的文本
```

### Supabase Storage

```typescript
// 上传
await supabase.storage.from('pdfs').upload(path, file)

// 获取公开 URL
const { data } = supabase.storage.from('pdfs').getPublicUrl(path)
```

### 数据库操作

```typescript
// 插入
await supabase.from('pdfs').insert({ user_id, file_name, ... })

// 查询
const { data } = await supabase.from('pdfs').select('*').eq('user_id', userId)

// 更新
await supabase.from('pdfs').update({ ... }).eq('id', pdfId)
```

---

## 常见问题

### Q1: PDF 解析后的文本格式混乱怎么办？

A: `pdf-parse` 只能提取纯文本，无法保留格式。可以考虑：
- 后期处理文本（正则匹配、分段）
- 使用更强大的库（如 `pdf.js`）
- 或者直接显示 PDF 原文（使用 `<embed>` 或 `react-pdf`）

### Q2: 如何从 PDF 中自动提取题目？

A: 自动提取题目非常复杂，建议：
- 初期手动标注（在上传时让用户输入题目）
- 或者使用 AI（如 Claude API）解析 PDF 内容生成题目
- 或者只解析答案部分，文章部分直接显示原文

### Q3: 如何保护 API 路由？

A: 所有 API 路由都应该验证用户身份：

```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Q4: RLS 已启用，还需要在代码中验证权限吗？

A: 是的。RLS 是数据库层面的保护，但 API 层面也应该验证，提供更好的错误提示。

---

## 调试技巧

1. **查看 Supabase Logs**：在 Supabase Dashboard → Logs 中查看数据库查询日志
2. **使用 Network 面板**：检查 API 请求和响应
3. **添加 console.log**：在 API 路由中打印日志（会显示在终端）
4. **测试 SQL**：在 Supabase SQL Editor 中直接测试查询

---

## 部署检查清单

- [ ] 确保 `.env.local` 不提交到 Git
- [ ] 在 Vercel/Zeabur 中设置环境变量
- [ ] 配置 Supabase 允许的 Redirect URLs（生产域名）
- [ ] 测试生产环境的认证流程
- [ ] 设置 Storage bucket 的权限策略

---

## 联系和支持

如有问题，可以：
- 查看 [Next.js 文档](https://nextjs.org/docs)
- 查看 [Supabase 文档](https://supabase.com/docs)
- 查看 `PROJECT_STRUCTURE.md` 了解文件组织
