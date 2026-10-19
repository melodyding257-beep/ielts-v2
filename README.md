# IELTS 雅思阅读练习平台

当前项目由 Next.js 16.4.0 / React 19 前端、FastAPI Python 解析服务和 Supabase Auth、数据库、Storage 组成。PDF 与图片通过视觉模型解析，已经支持游客练习、登录后的文件保存、答题与复习、解析运行对比。

## 本地启动（Windows PowerShell）

建议使用 Node 24（`.nvmrc` 为本次验证的 24.15.0）。项目脚本支持 Node 22.21+ 或 24+，Python 本次验证版本为 3.13.12。

从项目根目录执行：

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
if (!(Test-Path backend/.venv/Scripts/python.exe)) { python -m venv backend/.venv }
& .\backend\.venv\Scripts\python.exe -m pip install --upgrade pip==26.2.1
& .\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

已有 `.env.local` 和 `backend/.env` 时，保留原文件，补齐示例中需要的变量即可，不要覆盖已有密钥。前端填入 Supabase URL 与 anon key；模型密钥放在 `backend/.env`。千问模型配置见 `backend/model-profiles.env.example`。

启动两个终端，均从项目根目录运行：

```powershell
# 终端一：明确使用 backend/.venv 的 Python
npm run dev:backend

# 终端二：先检测 Supabase 网络，再启动 Next.js
npm run dev
```

前端地址为 http://localhost:3000，后端为 http://localhost:8000。Linux/macOS 使用 `backend/.venv/bin/python -m pip` 安装后端依赖；npm 后端启动脚本会自动选择对应平台的解释器。后端 requirements 使用 `constraints.txt` 固定已验证的依赖版本。本轮清洁安装在 Windows / Python 3.13.12 验证；Linux 独有的 uvloop 及实际部署环境仍需单独验证。

## 环境变量

| 变量 | 配置位置 | 用途 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` / 前端部署平台 | Supabase 项目地址 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上 | 当前代码使用的公开客户端 key |
| `BACKEND_URL` | 同上 | Next.js 上传 API 调用 Python 后端，线上必须填写可访问的后端地址 |
| `PARSER_TIMEOUT_MS` | 同上 | 等待解析后端的时限，默认 420000 毫秒；平台自身的请求时限另行生效 |
| `NEXT_PUBLIC_BACKEND_URL` | 同上 | `/parse-test` 浏览器直接调用后端的默认地址 |
| `PARSER_PROFILE` | `backend/.env` / 后端部署平台 | `doubao`、`qwen_ocr` 或 `qwen_flash` |
| `DOUBAO_API_KEY`、`DOUBAO_ENDPOINT` | 同上 | 豆包配置；其他模型变量见后端示例 |
| `ALLOWED_ORIGINS` | 同上 | 浏览器直接调用后端时允许的前端 origin，以逗号分隔 |
| `MAX_PARSE_PAGES` | 同上 | 后端页数限制，默认 10 |
| `ODC_PROXY_HOST`、`ODC_PROXY_PORT` | 本机 shell 或 `.env.local` | 开发代理地址，可选，默认 `127.0.0.1:17891` |

当前代码不读取 `SUPABASE_SERVICE_ROLE_KEY`，不需要为本项目补填该高权限密钥。模型变量放在后端自己的 `.env`，并覆盖同名 shell 变量。线上建议只使用部署平台环境变量，不携带本地 `.env`。Supabase 配置缺失或仍为示例值时，客户端会给出配置错误；生产环境未设置 `BACKEND_URL` 时，上传接口返回 503。

`NEXT_PUBLIC_*` 值在 Next.js 构建时写入浏览器资源，线上修改后需要重新构建。`BACKEND_URL` 用于服务端，不应与浏览器调试页地址混淆。

## 数据库准备

新项目可参考 `supabase/schema.sql` 初始化表与 RLS；这个文件中的策略创建语句不能直接反复执行。已有项目先检查真实表结构，再按需执行 `supabase/migrations/202609150001_parse_runs.sql`，不要重建已有数据。

需要 `pdfs` Storage bucket，以及按用户目录授权的上传、读取和删除策略。仓库当前 SQL 没有创建 Storage bucket 或对应策略，不能仅凭 schema 文件认为 Storage 已配置。

当前注册页面按关闭邮箱确认的流程设计。在 Supabase Authentication 设置中关闭 **Confirm email** 并保存；注册成功后返回登录页，由用户手动点击登录。密码仅经 React 内存状态传递，刷新后需要重新输入。若后台仍开启邮箱确认，页面会提示该状态。

## 检查命令

```powershell
npm run lint
npm run typecheck
npm test
npm run check:backend
npm run test:backend
npm run build
npm run net:check
```

`npm run dev:direct` 直接启动 Next.js，跳过网络探测，并继承 shell 的网络设置。`npm run dev -- --direct` 使用启动器强制清除代理变量后启动。网络健康探测没有携带 API key，HTTP 401 只代表已收到响应，不验证登录或数据库访问。

## 部署

前端执行 `npm ci`、`npm run build`，生产启动使用 `npm start` 或平台的 Next.js 集成。Python 后端安装 `backend/requirements.txt`，从仓库根目录启动 `python -m uvicorn backend.main:app --host 0.0.0.0 --port <平台端口>`；后端目录中的 `python -m uvicorn main:app` 入口也保留兼容。

线上配置 Supabase 的 Site URL 与认证 Redirect URLs；填写 `BACKEND_URL`，如果使用 `/parse-test`，同时填写构建时的 `NEXT_PUBLIC_BACKEND_URL` 和后端的 `ALLOWED_ORIGINS`。`backend/render.yaml` 是 Render 参考配置，指定后端目录、Python 版本、豆包 profile 和变量入口；使用千问时按后端文档另配模型变量。这份文件不代表已核实的线上实际部署配置。

退出登录返回请求所在站点首页，不再依赖额外的 `NEXT_PUBLIC_APP_URL`。

## 文档

- [实际结构与数据流](PROJECT_STRUCTURE.md)
- [开发与排错指南](DEVELOPMENT_GUIDE.md)
- [本次代码与环境检查](PROJECT_AUDIT.md)
- [清理与修改结果](CLEANUP_RESULT.md)
- [Python 解析器说明](backend/README.md)
