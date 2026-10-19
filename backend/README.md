# FastAPI IELTS 视觉解析服务

后端把一个 PDF 或一组连续图片转换为网站使用的文章、题目和答案状态。

## 解析原则

- 每次上传都会重新解析，包括重复上传相同文件；文件哈希仅用于比较不同运行的结果。
- PDF 的每一页都由 PyMuPDF 渲染为图片并交给视觉模型。
- PyMuPDF 的原生文字层、字体和坐标只用于校对，不直接生成前端内容。
- 模型只提取上传文件中真实存在的答案，禁止自行解题。
- 文件没有答案时返回 `answerStatus: "none"`，这属于有效结果。
- 关键结构缺失时最多进行一次复核；能定位到页面时只发送相关页及需修复字段，无法可靠定位时发送全部页面；仍不完整则返回 HTTP 422。
- 官方答案状态为 `incomplete` 或 `uncertain` 时保留警告和已找到的页面证据，不因状态本身触发复核。
- 响应中的 `parseMeta` 包含运行 ID、文件哈希、验收报告和分阶段耗时。

## 终端耗时日志

每次 `POST /parse` 都会在 FastAPI 终端按同一个 `runId` 输出：请求接收、文件读取、PDF 各页文字层和图片渲染、预处理汇总、首次模型调用、结果整理、首次校验、必要时的复核计划与复核模型调用、最终校验、响应构造和请求完成。模型调用开始时也会立即打印一条日志。

首次校验失败时，`initial_validation_error` 会逐条列出触发复核的原因；最终仍失败时，`final_validation_error` 会逐条列出剩余原因。日志只记录耗时、页数、字节数和校验消息，不打印文件正文或完整模型输出。

`handler_complete` 的 `backendTotalMs` 计到后端构造返回数据为止；`http_complete` 的 `pre_handler_ms` 包含 FastAPI 在进入接口前接收和解析上传请求的时间，`after_handler_ms` 包含接口返回后序列化并提交响应的时间。HTTP 日志计到 ASGI 发送完成，不代表客户端已收完数据；Storage 与数据库耗时由 Next.js 上传接口另行统计。

## 安装与启动

从项目根目录使用独立虚拟环境，避免调用全局 Python 依赖：

```powershell
if (!(Test-Path backend/.venv/Scripts/python.exe)) { python -m venv backend/.venv }
& .\backend\.venv\Scripts\python.exe -m pip install --upgrade pip==26.2.1
& .\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
# 首次配置时复制；已有 backend/.env 时保留原配置
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
npm run dev:backend
```

后端启动器固定使用 `backend/.venv`，不需要额外激活。Linux/macOS 安装时使用
`backend/.venv/bin/python -m pip install -r backend/requirements.txt`。

requirements 同时读取 `constraints.txt`，固定本轮已验证的间接依赖；验证环境为 Windows / Python 3.13.12，Linux 独有的 uvloop 和真实托管环境需要另行验证。FastAPI 为 0.143.0、Starlette 为 1.8.0，安全审计结果见根目录的清理报告。

`main.py` 保留 API 编排，其他职责分别位于 `config.py`、`providers.py`、`prompts.py`、`preprocessing.py`、`normalization.py`、`validation.py`、`timing.py`。旧的 `uvicorn main:app` 后端目录启动方式和根目录 `uvicorn backend.main:app` 都可用。

检查与测试也从项目根目录运行：

```powershell
npm run check:backend
npm run test:backend
```

`backend/.env` 是模型配置文件，不是 Python 虚拟环境；它会覆盖同名 shell 变量。
线上部署通过平台设置模型变量，避免携带本地 `.env`。常规上传的前端服务端地址
使用 `BACKEND_URL`；`/parse-test` 的浏览器地址使用 `NEXT_PUBLIC_BACKEND_URL`，
同时需要后端 `ALLOWED_ORIGINS` 包含前端 HTTPS origin。

## 切换单模型测试 profile

生产默认仍是豆包。未设置 `PARSER_PROFILE` 或设置为 `doubao` 时，继续读取原有的
`DOUBAO_API_KEY` 和 `DOUBAO_ENDPOINT`，方舟 URL 仍由后端提供，无需额外填写。

需要测试千问时，把 `model-profiles.env.example` 中相应变量复制到 `backend/.env`，
并只切换一行：

```env
PARSER_PROFILE=qwen_ocr
```

或：

```env
PARSER_PROFILE=qwen_flash
```

千问走官方 DashScope SDK；`QWEN_*_API_HOST` 应填写百炼提供的 `dashScope`/`apiHost`
地址（通常以 `/api/v1` 结尾），不要填写 `openAiCompatible` 地址。修改 `.env` 后需
重启 FastAPI。未知 profile 会直接报错，不会静默回退到豆包。

## 接口

### `POST /parse`

以下两种请求二选一：

- 一个 PDF；
- 一组按顺序组成同一篇阅读的图片。

```bash
curl -X POST http://localhost:8000/parse -F "files=@reading.pdf"
```

成功响应中的主要诊断字段：

```json
{
  "answerStatus": "none",
  "parseMeta": {
    "runId": "uuid",
    "fileHash": "sha256",
    "retryCount": 0,
    "initialValidationErrors": [],
    "verificationPages": [],
    "timing": {
      "uploadReadMs": 2,
      "inputValidationMs": 1,
      "preprocessMs": 800,
      "primaryModelMs": 12000,
      "validationMs": 2,
      "verificationModelMs": 0,
      "postprocessMs": 3,
      "responseBuildMs": 1,
      "backendTotalMs": 12807
    },
    "validation": {
      "status": "passed",
      "errors": [],
      "initialErrors": [],
      "warnings": []
    }
  }
}
```

### `GET /`

返回服务状态和当前解析器版本。

## 数据库迁移

解析运行对比页面依赖 `parse_runs` 表。请在 Supabase SQL Editor 执行：

```text
supabase/migrations/202609150001_parse_runs.sql
```

迁移完成后，从网站的 `/admin/parse-tests` 查看同一文件的多次解析差异和耗时。
