import os
import base64
import httpx
from dotenv import load_dotenv

load_dotenv()

async def test_kimi():
    kimi_api_key = os.getenv("KIMI_API_KEY")
    print(f"API Key loaded: {kimi_api_key[:20]}..." if kimi_api_key else "No API Key!")

    # 创建一个简单的测试图片（1x1 像素）
    test_image = base64.b64encode(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89').decode('utf-8')

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.moonshot.cn/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {kimi_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "moonshot-v1-8k",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Hello"
                                }
                            ]
                        }
                    ],
                    "temperature": 0.3
                }
            )

            print(f"Status: {response.status_code}")
            print(f"Response: {response.text[:200]}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_kimi())
