# 项目结构说明

## 目录组织

### `/app` - Next.js App Router 应用目录

#### `/app/api` - API 路由
- **`/api/auth/callback/route.ts`** - Supabase 认证回调处理
- **`/api/pdf/upload/route.ts`** - PDF 文件上传和解析
- **`/api/pdf/list/route.ts`** - 获取用户上传的 PDF 列表
- **`/api/practice/submit/route.ts`** - 提交练习答案并计算分数
- **`/api/practice/records/route.ts`** - 获取用户做题记录

#### `/app/auth` - 认证页面
- **`/auth/login/page.tsx`** - 登录页面
- **`/auth/register/page.tsx`** - 注册页面

#### `/app/dashboard` - 用户仪表盘
- **`/dashboard/page.tsx`** - 显示已上传文件列表和做题记录

#### `/app/practice` - 练习页面
- **`/practice/[id]/page.tsx`** - 机考练习界面（动态路由，id 为 PDF ID）

#### 根页面
- **`/app/page.tsx`** - 首页（营销页面）
- **`/app/layout.tsx`** - 根布局（Next.js 自动生成）

---

### `/components` - React 组件

#### `/components/layout`
- **`Header.tsx`** - 顶部导航栏

#### `/components/practice`
- **`Timer.tsx`** - 练习计时器组件
- **`QuestionList.tsx`** - 题目列表和答题区

#### `/components/ui`
- **`Button.tsx`** - 通用按钮组件
- **`FileUpload.tsx`** - 文件上传组件

---

### `/lib` - 工具库和配置

#### `/lib/supabase`
- **`client.ts`** - 客户端 Supabase 实例（用于 Client Components）
- **`server.ts`** - 服务端 Supabase 实例（用于 Server Components 和 API Routes）
- **`middleware.ts`** - 中间件中的 Supabase 实例（用于刷新 session）

#### `/lib/utils`
- **`pdf-parser.ts`** - PDF 解析工具函数（使用 pdf-parse）
- **`validators.ts`** - 表单验证 schema（使用 Zod）

---

### `/types` - TypeScript 类型定义

- **`database.ts`** - Supabase 数据库类型定义
- **`index.ts`** - 应用通用类型定义（PdfDocument, PracticeRecord, Question 等）

---

### `/supabase` - Supabase 配置

- **`schema.sql`** - 数据库 schema（创建表、索引、RLS 策略）

---

### 根配置文件

- **`middleware.ts`** - Next.js 中间件（处理 Supabase session 刷新）
- **`package.json`** - 项目依赖和脚本
- **`tsconfig.json`** - TypeScript 配置
- **`.env.example`** - 环境变量示例文件

---

## 数据流

### 1. 用户认证流程
```
登录/注册页面 → Supabase Auth → 回调 (/api/auth/callback) → 重定向到 Dashboard
```

### 2. PDF 上传流程
```
FileUpload 组件 → /api/pdf/upload
  ↓
解析 PDF (pdf-parse) → 上传到 Supabase Storage → 保存记录到数据库
```

### 3. 练习流程
```
Dashboard 选择 PDF → /practice/[id] 练习页面
  ↓
Timer 计时 + QuestionList 答题
  ↓
提交答案 → /api/practice/submit → 判分 → 保存记录 → 返回结果
```

### 4. 记录查看流程
```
Dashboard → /api/practice/records → 展示历史做题记录
```

---

## 待实现功能清单

### 阶段 1: 用户认证
- [ ] 实现登录页面 UI 和逻辑
- [ ] 实现注册页面 UI 和逻辑
- [ ] 实现认证回调处理
- [ ] 添加受保护路由（未登录重定向）

### 阶段 2: PDF 上传和解析
- [ ] 实现文件上传 UI
- [ ] 实现 PDF 解析逻辑（提取文本）
- [ ] 实现 Supabase Storage 上传
- [ ] 保存 PDF 记录到数据库

### 阶段 3: 机考练习界面
- [ ] 实现左文右题布局
- [ ] 实现计时器功能
- [ ] 实现题目渲染（支持多种题型）
- [ ] 实现答题交互

### 阶段 4: 判分和记录
- [ ] 实现答案提交逻辑
- [ ] 实现判分算法
- [ ] 保存做题记录到数据库
- [ ] 展示做题结果

### 阶段 5: Dashboard
- [ ] 实现已上传文件列表
- [ ] 实现做题记录展示
- [ ] 实现重做功能
- [ ] 添加统计图表（可选）

---

## 注意事项

1. **所有 API 路由都需要验证用户身份**（通过 Supabase Auth）
2. **RLS（Row Level Security）已在数据库中启用**，确保用户只能访问自己的数据
3. **PDF 解析可能耗时**，考虑使用加载状态和错误处理
4. **文件上传需要设置大小限制**（建议 10MB 以内）
5. **题目类型需要灵活设计**，支持多选、判断、填空、匹配等
