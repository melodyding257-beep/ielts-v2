# IELTS 雅思阅读练习平台

基于 Next.js 15 的全栈雅思阅读练习网站，支持 PDF 上传解析、机考模拟、做题记录追踪。

## 技术栈

- **前端 + 后端**: Next.js 15 (App Router)
- **数据库 + 存储**: Supabase
- **PDF 解析**: pdf-parse
- **样式**: Tailwind CSS
- **验证**: Zod
- **语言**: TypeScript

## 核心功能

1. 用户注册/登录（Supabase Auth）
2. 上传 PDF → 解析提取文字 → 保存到 Supabase Storage 和数据库
3. 机考练习界面（左文章右题目，计时）
4. 做题记录保存和查看
5. 已上传文件列表，可重新练习

## 项目结构

```
ielts-v2/
├── app/
│   ├── api/              # API 路由
│   │   ├── auth/         # 认证相关
│   │   ├── pdf/          # PDF 上传和列表
│   │   └── practice/     # 练习提交和记录
│   ├── auth/             # 登录注册页面
│   ├── dashboard/        # 用户仪表盘
│   ├── practice/[id]/    # 练习页面
│   └── page.tsx          # 首页
├── components/
│   ├── layout/           # 布局组件
│   ├── practice/         # 练习相关组件
│   └── ui/               # UI 组件
├── lib/
│   ├── supabase/         # Supabase 客户端
│   └── utils/            # 工具函数
├── types/                # TypeScript 类型定义
└── supabase/
    └── schema.sql        # 数据库 schema
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填入你的 Supabase 配置：

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. 设置 Supabase 数据库

在 Supabase SQL Editor 中执行 `supabase/schema.sql` 文件。

### 4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 待实现功能（TODO）

- [ ] 用户认证逻辑
- [ ] PDF 上传和解析
- [ ] 机考练习界面
- [ ] 答案判分系统
- [ ] 做题记录保存和展示
- [ ] 文件列表和重做功能

## 部署

推荐使用 Vercel 或 Zeabur 部署。

## License

MIT
