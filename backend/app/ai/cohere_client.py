import time
import json
import logging
import httpx
from typing import Optional, Dict, Any, Type, TypeVar, List
from pydantic import BaseModel

from app.ai.key_manager import gemini_key_manager

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

COHERE_API_V2_URL = "https://api.cohere.com/v2/chat"
COHERE_API_V1_URL = "https://api.cohere.com/v1/chat"
DEFAULT_COHERE_MODEL = "command-r-plus-08-2024"

# Supported Cohere Models
COHERE_MODELS = [
    {"id": "command-r-plus-08-2024", "name": "Cohere Command R+ 08-2024 (Khuyên dùng • Thông minh & Lập luận sâu)", "speed": "~100 t/s"},
    {"id": "command-r-08-2024", "name": "Cohere Command R 08-2024 (Nhanh • Tối ưu hội thoại CSKH)", "speed": "~200 t/s"},
    {"id": "command-r7b-12-2024", "name": "Cohere Command R 7B (Siêu nhẹ & Nhanh)", "speed": "~350 t/s"},
    {"id": "c4ai-aya-expanse-32b", "name": "Cohere Aya Expanse 32B (Đa ngôn ngữ & Tiếng Việt xuất sắc)", "speed": "~150 t/s"}
]

def normalize_cohere_model(name: Optional[str]) -> str:
    name_str = (name or "").strip().lower()
    if name_str in ["command-r-plus", "command-r-plus-08-2024", "command-r+"]:
        return "command-r-plus-08-2024"
    if name_str in ["command-r", "command-r-08-2024"]:
        return "command-r-08-2024"
    if name_str in ["command-light", "command-r7b", "command-r7b-12-2024"]:
        return "command-r7b-12-2024"
    if name_str in ["aya", "c4ai-aya-expanse-32b"]:
        return "c4ai-aya-expanse-32b"
    return name_str or DEFAULT_COHERE_MODEL

class CohereClient:
    def __init__(self):
        pass

    async def test_key(self, api_key: str, model_name: str = DEFAULT_COHERE_MODEL) -> Dict[str, Any]:
        """Tests a single Cohere API key with a ping request and returns latency & status"""
        target_model = normalize_cohere_model(model_name)
        url = COHERE_API_V2_URL
        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": target_model,
            "messages": [
                {"role": "user", "content": "Trả lời ngắn gọn 1 từ: 'OK'"}
            ],
            "max_tokens": 10,
            "temperature": 0.1
        }

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                latency_ms = round((time.time() - start_time) * 1000, 1)

                if response.status_code == 200:
                    data = response.json()
                    content_list = data.get("message", {}).get("content", [])
                    reply_text = "OK"
                    if content_list and isinstance(content_list, list):
                        reply_text = content_list[0].get("text", "OK").strip()

                    return {
                        "success": True,
                        "status_code": 200,
                        "latency_ms": latency_ms,
                        "message": f"Kết nối Cohere thành công! (Độ trễ: {latency_ms}ms, Phản hồi: {reply_text[:30]})",
                        "model": target_model
                    }
                elif response.status_code == 401:
                    return {
                        "success": False,
                        "status_code": 401,
                        "latency_ms": latency_ms,
                        "message": "Lỗi 401: Cohere API Key không hợp lệ hoặc đã hết hạn",
                        "error_type": "INVALID_KEY"
                    }
                elif response.status_code == 429:
                    return {
                        "success": False,
                        "status_code": 429,
                        "latency_ms": latency_ms,
                        "message": "Lỗi 429: Hết hạn mức lượt gọi Cohere (Trial rate limit)",
                        "error_type": "RATE_LIMIT"
                    }
                elif response.status_code == 404:
                    # Smart Fallback across available Cohere versioned models
                    fallback_models = ["command-r-plus-08-2024", "command-r-08-2024", "command-r7b-12-2024", "c4ai-aya-expanse-32b"]
                    for fb_model in fallback_models:
                        if fb_model == target_model:
                            continue
                        try:
                            fb_payload = {
                                "model": fb_model,
                                "messages": [{"role": "user", "content": "Trả lời 1 từ: OK"}],
                                "max_tokens": 10,
                                "temperature": 0.1
                            }
                            fb_res = await client.post(url, json=fb_payload, headers=headers)
                            if fb_res.status_code == 200:
                                latency_ms = round((time.time() - start_time) * 1000, 1)
                                return {
                                    "success": True,
                                    "status_code": 200,
                                    "latency_ms": latency_ms,
                                    "message": f"Kết nối Cohere thành công với model {fb_model}! (Độ trễ: {latency_ms}ms)",
                                    "model": fb_model
                                }
                        except Exception:
                            pass

                    return {
                        "success": False,
                        "status_code": 404,
                        "latency_ms": latency_ms,
                        "message": f"Lỗi 404: Model '{target_model}' không khả dụng trên tài khoản này",
                        "error_type": "NOT_FOUND"
                    }
                else:
                    return {
                        "success": False,
                        "status_code": response.status_code,
                        "latency_ms": latency_ms,
                        "message": f"Lỗi Cohere API ({response.status_code}): {response.text[:150]}",
                        "error_type": "API_ERROR"
                    }
        except httpx.TimeoutException:
            return {
                "success": False,
                "status_code": 408,
                "latency_ms": round((time.time() - start_time) * 1000, 1),
                "message": "Lỗi: Quá thời gian chờ (10s)",
                "error_type": "TIMEOUT"
            }
        except Exception as e:
            return {
                "success": False,
                "status_code": 500,
                "latency_ms": round((time.time() - start_time) * 1000, 1),
                "message": f"Lỗi kết nối mạng Cohere: {e}",
                "error_type": "NETWORK_ERROR"
            }

    async def generate_content(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        response_model: Optional[Type[T]] = None,
        temperature: float = 0.2
    ) -> Any:
        """
        Executes a prompt against Cohere API with auto-rotation across the Cohere key pool.
        """
        config = gemini_key_manager.get_config()
        model_name = normalize_cohere_model(config.get("cohere_model_name", DEFAULT_COHERE_MODEL))
        timeout_sec = min(float(config.get("timeout_seconds", 15)), 10.0)

        candidate_keys = gemini_key_manager.get_cohere_candidate_keys()
        if not candidate_keys:
            raise RuntimeError("Không có Cohere API Key nào khả dụng trong hệ thống! Vui lòng thêm key tại Cài đặt.")

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        req_payload: Dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
        }

        if response_model is not None:
            req_payload["response_format"] = {"type": "json_object"}
            schema_json = json.dumps(response_model.model_json_schema(), ensure_ascii=False)
            messages[-1]["content"] += f"\n\nIMPORTANT: Return ONLY a valid JSON object strictly matching this schema without any markdown formatting:\n{schema_json}"

        last_error = None

        for key_info in candidate_keys:
            api_key = key_info.get("key", "").strip()
            key_id = key_info.get("id")
            key_name = key_info.get("name", "Cohere Key")

            if not api_key:
                continue

            url = COHERE_API_V2_URL
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }

            try:
                async with httpx.AsyncClient(timeout=float(timeout_sec)) as client:
                    response = await client.post(url, json=req_payload, headers=headers)

                    if response.status_code == 200:
                        data = response.json()
                        gemini_key_manager.mark_cohere_key_success(key_id)

                        content_list = data.get("message", {}).get("content", [])
                        raw_text = ""
                        if content_list and isinstance(content_list, list):
                            raw_text = content_list[0].get("text", "").strip()

                        if response_model is not None:
                            cleaned = raw_text
                            if "```json" in cleaned:
                                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
                            elif "```" in cleaned:
                                cleaned = cleaned.split("```")[1].split("```")[0].strip()

                            parsed_dict = json.loads(cleaned)
                            return response_model.model_validate(parsed_dict)
                        else:
                            return raw_text

                    elif response.status_code == 429:
                        err_msg = response.text[:200]
                        logger.warning(f"Cohere Key '{key_name}' hit 429. Rotating to next key...")
                        gemini_key_manager.mark_cohere_key_rate_limited(key_id, f"Cohere Rate Limit (429): {err_msg}")
                        last_error = f"Key '{key_name}' rate limited: {err_msg}"
                        continue
                    elif response.status_code == 401:
                        logger.error(f"Cohere Key '{key_name}' is invalid (401).")
                        gemini_key_manager.update_cohere_key(key_id, {"status": "INVALID", "is_active": False})
                        last_error = f"Key '{key_name}' 401 Unauthorized"
                        continue
                    else:
                        err_msg = response.text[:200]
                        logger.error(f"Cohere API error ({response.status_code}) on key '{key_name}': {err_msg}")
                        last_error = f"HTTP {response.status_code}: {err_msg}"
                        continue

            except httpx.TimeoutException:
                logger.warning(f"Cohere Key '{key_name}' timed out after {timeout_sec}s. Rotating...")
                last_error = f"Key '{key_name}' Timeout ({timeout_sec}s)"
                continue
            except Exception as e:
                logger.error(f"Exception using Cohere Key '{key_name}': {e}")
                last_error = str(e)
                continue

        raise RuntimeError(f"Tất cả các Cohere API Key trong Pool đều thất bại hoặc hết hạn mức. Lỗi cuối: {last_error}")

cohere_client = CohereClient()
