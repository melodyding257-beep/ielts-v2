from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
from typing import Dict
import os
import base64
import httpx
import json
import re
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOUBAO_API_KEY = os.getenv("DOUBAO_API_KEY")
DOUBAO_ENDPOINT = os.getenv("DOUBAO_ENDPOINT")
DOUBAO_API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"

PARSE_PROMPT = """你是一个雅思阅读题目解析助手。下面提供的内容是一份雅思阅读练习材料，可能包含电子版文字和扫描页图片，请整合所有信息后，严格按照以下JSON格式输出，禁止输出任何其他内容：

{
  "article": "文章正文全文",
  "questions": [
    {
      "id": "27",
      "sectionTitle": "Questions 27-32",
      "direction": "题组说明文字",
      "type": "题目类型",
      "text": "题目文字",
      "options": ["选项A", "选项B"],
      "selectCount": 1,
      "sharedOptions": null
    }
  ],
  "answers": {
    "27": "A",
    "28": "B"
  },
  "explanations": {
    "27": "解析文字",
    "28": "解析文字"
  }
}

type字段规则：
- choice_single：单选题（Choose the correct letter A/B/C/D）
- choice_multi：多选题（Choose TWO/THREE letters）
- choice_judge：判断题（TRUE/FALSE/NOT GIVEN 或 YES/NO/NOT GIVEN）
- matching_paragraph：段落匹配题（Which paragraph contains...），options字段填段落字母列表如["A","B","C","D","E","F"]
- matching_list：列表匹配题（Match each statement...），sharedOptions字段填公用选项列表，options为null
- fill_blank：独立问句填空题（Answer the questions below / NO MORE THAN X WORDS）
- fill_blank_summary：摘要填空题（Complete the summary），text字段保留完整段落含37 _______ 格式，id用题号范围如"37-40"

注意：
- 如果材料中没有答案解析，answers和explanations返回空对象{}
- article只包含文章正文，不包含题目
- 段落匹配题的options根据direction中的字母范围生成，如A-H则为["A","B","C","D","E","F","G","H"]
- 判断题options固定为["TRUE","FALSE","NOT GIVEN"]或["YES","NO","NOT GIVEN"]
- 选择题options格式为["A. 选项内容", "B. 选项内容"]
- 多选题id用题号范围如"7-8"，selectCount填2或3
"""


async def call_doubao(text_parts: list[str], image_parts: list[bytes]) -> dict:
    """调用豆包模型，传入文字和图片，返回解析后的JSON"""
    
    if not DOUBAO_API_KEY or not DOUBAO_ENDPOINT:
        raise ValueError("DOUBAO_API_KEY or DOUBAO_ENDPOINT not set")

    # 组装content
    content = []
    
    # 先放文字部分
    if text_parts:
        combined_text = PARSE_PROMPT + "\n\n【电子版文字内容】\n" + "\n\n---页面分隔---\n\n".join(text_parts)
        content.append({"type": "text", "text": combined_text})
    else:
        content.append({"type": "text", "text": PARSE_PROMPT})

    # 再放图片部分（每批最多10张）
    for img_bytes in image_parts[:10]:
        img_b64 = base64.b64encode(img_bytes).decode('utf-8')
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{img_b64}"}
        })

    # 如果图片超过10张，分批处理（简单处理：只取前10张，实际可扩展）
    if len(image_parts) > 10:
        print(f"Warning: {len(image_parts)} images, only first 10 will be processed")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                DOUBAO_API_URL,
                headers={
                    "Authorization": f"Bearer {DOUBAO_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": DOUBAO_ENDPOINT,
                    "messages": [{"role": "user", "content": content}],
                    "temperature": 0.2,
                    "max_tokens": 8000,
                    "extra_body": {"reasoning_effort": "minimal"}
                }
            )
            
            if response.status_code != 200:
                print(f"Doubao API error: {response.status_code}, {response.text[:500]}")
                return {}
                
            result = response.json()
            raw_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # 清理markdown代码块
            raw_text = re.sub(r'^```json\s*', '', raw_text.strip())
            raw_text = re.sub(r'\s*```$', '', raw_text.strip())
            
            return json.loads(raw_text)
            
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"Raw response: {raw_text[:1000]}")
        # 尝试提取JSON块
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except:
                pass
        return {}
    except Exception as e:
        print(f"Doubao call error: {type(e).__name__}: {str(e)}")
        return {}


async def process_pdf(pdf_bytes: bytes) -> tuple[list, dict]:
    """处理PDF文件，返回pages列表和解析结果"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    pages = []
    text_parts = []
    image_parts = []
    image_page_nums = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        is_scan = len(text.strip()) <= 100

        if is_scan:
            # 扫描页转图片
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img_bytes = pix.tobytes("png")
            image_parts.append(img_bytes)
            image_page_nums.append(page_num + 1)
            pages.append({
                "page_num": page_num + 1,
                "text": "",
                "is_scan": True,
                "ocr_used": True
            })
        else:
            text_parts.append(f"[第{page_num + 1}页]\n{text.strip()}")
            pages.append({
                "page_num": page_num + 1,
                "text": text.strip(),
                "is_scan": False
            })

    doc.close()
    
    # 调用豆包解析
    parsed = await call_doubao(text_parts, image_parts)
    
    # 更新扫描页的text字段
    if parsed:
        for i, page_num in enumerate(image_page_nums):
            pages[page_num - 1]["text"] = f"[扫描页，已由AI解析]"
    
    return pages, parsed


async def process_image(image_bytes: bytes, filename: str) -> tuple[list, dict]:
    """处理图片文件"""
    pages = [{
        "page_num": 1,
        "text": "",
        "is_scan": True,
        "ocr_used": True
    }]
    
    parsed = await call_doubao([], [image_bytes])
    return pages, parsed


@app.post("/parse")
async def parse_file(file: UploadFile = File(...)) -> Dict:
    filename = file.filename or ""
    file_bytes = await file.read()

    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    ext = os.path.splitext(filename)[1].lower()

    if ext in image_extensions:
        pages, parsed = await process_image(file_bytes, filename)
    else:
        pages, parsed = await process_pdf(file_bytes)

    print(f"Parsed result: {parsed}")
    if not parsed:
        return {
            "pages": pages,
            "total_pages": len(pages),
            "article": "",
            "questions": [],
            "questions_raw": "",
            "answers": {},
            "explanations": {},
            "error": "解析失败，请重试"
        }

    return {
        "pages": pages,
        "total_pages": len(pages),
        "article": parsed.get("article", ""),
        "questions": parsed.get("questions", []),
        "questions_raw": "",
        "answers": parsed.get("answers", {}),
        "explanations": parsed.get("explanations", {})
    }


@app.get("/")
async def root():
    return {"message": "PDF Parser API is running"}