# FastAPI PDF 解析服务

极简 PDF 解析后端，使用 PyMuPDF 逐页提取文字并识别扫描页。

## 功能

- **POST /parse**: 解析 PDF 文件
  - 接收：PDF 文件（multipart/form-data）
  - 返回：逐页文字 + 扫描页标记

## 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

推荐使用虚拟环境：
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

## 启动服务

```bash
uvicorn main:app --reload --port 8000
```

访问 http://localhost:8000 查看服务状态。

## API 使用示例

### 测试接口

```bash
curl http://localhost:8000
```

### 解析 PDF

```bash
curl -X POST http://localhost:8000/parse \
  -F "file=@test.pdf"
```

### 响应格式

```json
{
  "pages": [
    {
      "page_num": 1,
      "text": "这里是提取的文字内容...",
      "is_scan": false
    },
    {
      "page_num": 2,
      "text": "",
      "is_scan": true
    }
  ],
  "total_pages": 2
}
```

## 扫描页判断逻辑

- 字符数 > 100：普通文字页，返回提取的文字
- 字符数 <= 100：扫描页，`is_scan` 为 `true`，`text` 为空

## CORS 配置

默认允许 `http://localhost:3000`（Next.js 开发服务器）。

生产环境需要修改 `main.py` 中的 `allow_origins`。

## 部署

推荐使用：
- **Railway**
- **Render**
- **Fly.io**
- **Zeabur**（支持 Python）

部署时需要：
1. `requirements.txt`
2. `main.py`
3. 启动命令：`uvicorn main:app --host 0.0.0.0 --port $PORT`
