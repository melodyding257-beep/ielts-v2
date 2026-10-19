# 项目结构与数据流

以 2026-10-13 工作区代码为准。

## 页面与接口

| 入口 | 实现 | 职责 |
| --- | --- | --- |
| `/` | `app/page.tsx` | 游客上传，临时练习和评分，不保存文件或记录 |
| `/auth/login`、`/auth/register` | `app/auth/` | Supabase 邮箱密码认证与内存中的注册信息传递 |
| `/auth/signout` | `app/auth/signout/route.ts` | 清除登录会话，303 跳转回当前站点 |
| `/dashboard` | `app/dashboard/page.tsx` | 验证用户，显示上传入口、文件和练习摘要 |
| `/practice/[id]` | `app/practice/[id]/` | 查询材料与最近记录，答题、计时、复习、笔记 |
| `/admin/parse-tests` | `app/admin/parse-tests/` | 登录用户查看自己的解析运行；没有管理员角色限制 |
| `/parse-test` | `app/parse-test/` | 无需登录，浏览器直接调用 FastAPI 的调试页 |
| `/api/pdf/upload` | `app/api/pdf/upload/route.ts` | 转发解析，登录用户再保存 Storage、材料和解析运行 |
| `/api/pdf/list`、`/api/pdf/delete` | `app/api/pdf/` | 文件列表与删除 |
| `/api/practice/submit`、`/api/practice/records` | `app/api/practice/` | 计算评分，按用户/材料更新最近答题记录，查询记录 |
| `/api/parse-runs` | `app/api/parse-runs/route.ts` | 用户自己的解析运行查询、原始输出查询和耗时补记 |
| `/api/auth/callback` | `app/api/auth/callback/route.ts` | Supabase code 换取会话 |

## 主要模块

- `components/dashboard/`：实际使用的上传组件和文件列表。
- `components/practice/`：文章渲染、题目渲染、计时、笔记面板。
- `components/parse/`：直接解析调试与历史运行对比。
- `types/practice.ts`：解析材料、文章块、题目、答案状态、练习和解析运行的数据类型；`practiceHelpers.ts` 兼容导出这些类型。
- `types/database.ts`：Supabase 表契约与关系，来自仓库 schema；尚未从线上数据库生成核对。
- `lib/utils/practiceHelpers.ts`：题号整理、摘要题合并、答案规范化与判分。
- `lib/utils/validators.ts`、`errors.ts`、`highlights.ts`：API 入参验证、错误消息、高亮文本切片。
- `lib/server/parser-config.ts`：服务端解析地址和请求时限校验。
- `lib/supabase/client.ts`、`server.ts`、`proxy.ts`、`config.ts`：带类型的浏览器、服务器和会话刷新客户端，以及公共配置校验。
- 根目录 `proxy.ts`：Next.js 16 Proxy，刷新 dashboard、practice 和解析对比页的会话。具体页面和 API 仍各自验证身份。
- `backend/main.py`：FastAPI 接口、解析编排、复核和响应。
- `backend/config.py`、`providers.py`、`prompts.py`：配置、模型 profile 与调用、视觉解析提示词。
- `backend/preprocessing.py`、`normalization.py`、`validation.py`、`timing.py`：PDF/图片预处理、结构归一化、验收与复核规则、耗时日志。
- `backend/test_parser_logic.py`：21 项既有解析逻辑测试。
- `backend/test_api.py`：健康接口、非法文件拦截、重复上传重新解析的接口测试，模型使用固定响应。
- `backend/requirements.txt`、`constraints.txt`：运行依赖与本轮 Windows 验证的版本约束。
- `scripts/environment.mjs`：Next.js 环境加载与代理变量处理。
- `scripts/dev.mjs`、`net-check.mjs`：开发启动与网络检测。
- `scripts/backend.mjs`：选择项目虚拟环境中的 Python，启动、测试或检查后端。
- `supabase/schema.sql`、`migrations/`：表、索引与 RLS 定义。

## 数据流

常规上传：浏览器 `UploadSection` → Next.js `/api/pdf/upload` → FastAPI `/parse` → PyMuPDF 将 PDF 渲染为页面图片 → 当前选择的视觉模型 → 归一化与校验 → 最多一次复核 → Next.js 保存 Storage、`pdfs` 和 `parse_runs` → Dashboard 进入练习。

游客上传使用同一解析链路，通过 `guestMode` 跳过远程认证和持久化。每次上传均重新解析；文件哈希只用于历史对比。

直接调试：`/parse-test` → 浏览器请求 FastAPI，不经过 Next.js 上传 API，也不写 Supabase，因此需要浏览器可访问的后端地址与 CORS。

练习：服务端读取 `pdfs.parsed_content` → `PracticeClient` → 前后端共用判分函数 → `/api/practice/submit` 更新 `practice_records`。只有答案状态完整时判分；没有答案的材料保存作答和用时，但不制造分数。

`practice_records` 当前每个用户/材料保留一条最近记录并累计次数，不是逐次练习历史。`parse_runs` 则每次解析保留单独记录。

## 文件检查记录

删除项、改动依据和验证结果见 `CLEANUP_RESULT.md`；逐文件清单见 `docs/audit/file-review.json`。缓存和第三方依赖按生成方式、安装状态及安全审计检查，项目自身的源码与配置按引用、入口和用途检查。
