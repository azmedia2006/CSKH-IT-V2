import time
import json
import logging
import httpx
from typing import Optional, Dict, Any, Type, TypeVar, List
from pydantic import BaseModel

from app.ai.key_manager import gemini_key_manager

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

GROQ_API_BASE = "https://api.groq.com/openai/v1"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"

# Supported Groq Models list
GROQ_MODELS = [
    {"id": "openai/gpt-oss-120b", "name": "OpenAI GPT OSS 120B (Mạnh mẽ & Thông minh nhất trên Groq LPU)", "speed": "~400 t/s"},
    {"id": "openai/gpt-oss-20b", "name": "OpenAI GPT OSS 20B (Siêu tốc độ phản hồi < 0.2s)", "speed": "~800 t/s"},
    {"id": "qwen/qwen3.6-27b", "name": "Qwen 3.6 27B (Đa ngôn ngữ & Lập luận tốt)", "speed": "~500 t/s"},
    {"id": "llama-3.3-70b-versatile", "name": "Meta Llama 3.3 70B (Versatile)", "speed": "~300 t/s"},
    {"id": "llama-3.1-8b-instant", "name": "Meta Llama 3.1 8B (Instant)", "speed": "~800 t/s"},
    {"id": "llama3-70b-8192", "name": "Meta Llama 3 70B (8192)", "speed": "~300 t/s"},
    {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B (Ngữ cảnh 32k)", "speed": "~500 t/s"}
]

class GroqClient:
    def __init__(self):
        pass

    async def get_available_models(self, api_key: str) -> List[str]:
        """Queries Groq /models endpoint to retrieve models available for this specific API key"""
        url = f"{GROQ_API_BASE}/models"
        headers = {"Authorization": f"Bearer {api_key.strip()}"}
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get(url, headers=headers)
                if r.status_code == 200:
                    data = r.json()
                    return [m["id"] for m in data.get("data", [])]
        except Exception as e:
            logger.warning(f"Failed to fetch Groq models list: {e}")
        return []

    async def test_key(self, api_key: str, model_name: str = DEFAULT_GROQ_MODEL) -> Dict[str, Any]:
        """Tests a single Groq API key by querying models and making a ping request"""
        start_time = time.time()
        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json"
        }

        # Step 1: Query models to verify key validity and get available models
        available_models = await self.get_available_models(api_key)
        
        # Determine candidate models to test
        chat_candidates = []
        if model_name in available_models:
            chat_candidates.append(model_name)
            
        priority_preferred = [
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.6-27b",
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "llama3-70b-8192",
            "groq/compound-mini",
            "allam-2-7b"
        ]
        for p in priority_preferred:
            if p in available_models and p not in chat_candidates:
                chat_candidates.append(p)
                
        # If no models discovered or fallback
        if not chat_candidates:
            chat_candidates = [model_name, "openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant", "llama-3.3-70b-versatile"]

        url = f"{GROQ_API_BASE}/chat/completions"

        for cur_model in chat_candidates:
            payload = {
                "model": cur_model,
                "messages": [
                    {"role": "user", "content": "Trả lời ngắn gọn 1 từ: 'OK'"}
                ],
                "max_tokens": 10,
                "temperature": 0.1
            }

            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    response = await client.post(url, json=payload, headers=headers)
                    latency_ms = round((time.time() - start_time) * 1000, 1)

                    if response.status_code == 200:
                        return {
                            "success": True,
                            "status_code": 200,
                            "latency_ms": latency_ms,
                            "message": f"Kết nối thành công! (Độ trễ: {latency_ms}ms, Model: {cur_model})",
                            "model": cur_model
                        }
                    elif response.status_code == 401:
                        return {
                            "success": False,
                            "status_code": 401,
                            "latency_ms": latency_ms,
                            "message": "Lỗi 401: Groq API Key không hợp lệ hoặc đã bị thu hồi",
                            "error_type": "INVALID_KEY"
                        }
                    elif response.status_code == 429:
                        return {
                            "success": False,
                            "status_code": 429,
                            "latency_ms": latency_ms,
                            "message": "Lỗi 429: Hết hạn mức / Quá tải lượt gọi",
                            "error_type": "RATE_LIMIT"
                        }
                    elif response.status_code == 404:
                        continue
                    else:
                        continue
            except httpx.TimeoutException:
                continue
            except Exception as e:
                logger.warning(f"Groq test exception on model {cur_model}: {e}")
                continue

        # If available_models succeeded earlier, key is valid!
        if available_models:
            latency_ms = round((time.time() - start_time) * 1000, 1)
            return {
                "success": True,
                "status_code": 200,
                "latency_ms": latency_ms,
                "message": f"Kết nối Groq thành công! ({len(available_models)} models khả dụng)",
                "model": available_models[0]
            }

        return {
            "success": False,
            "status_code": 400,
            "latency_ms": round((time.time() - start_time) * 1000, 1),
            "message": "Lỗi: Không thể kết nối hoặc xác thực Groq API Key",
            "error_type": "API_ERROR"
        }

    async def generate_content(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        response_model: Optional[Type[T]] = None,
        temperature: float = 0.2
    ) -> Any:
        """
        Executes a prompt against Groq API with auto-rotation across the Groq key pool.
        """
        config = gemini_key_manager.get_config()
        model_name = config.get("groq_model_name", DEFAULT_GROQ_MODEL)
        timeout_sec = min(float(config.get("timeout_seconds", 15)), 8.0)

        candidate_keys = gemini_key_manager.get_groq_candidate_keys()
        if not candidate_keys:
            raise RuntimeError("Không có Groq API Key nào khả dụng trong hệ thống! Vui lòng thêm key tại Cài đặt.")

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
            schema_json = json.dumps(response_model.model_json_schema(), ensure_ascii=False)
            messages[-1]["content"] += f"\n\nIMPORTANT: Return ONLY a valid JSON object strictly matching this schema without any markdown wrapping or thought:\n{schema_json}"

        last_error = None

        for key_info in candidate_keys:
            api_key = key_info.get("key", "").strip()
            key_id = key_info.get("id")
            key_name = key_info.get("name", "Groq Key")

            if not api_key:
                continue

            url = f"{GROQ_API_BASE}/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }

            try:
                async with httpx.AsyncClient(timeout=float(timeout_sec)) as client:
                    response = await client.post(url, json=req_payload, headers=headers)

                    if response.status_code == 200:
                        data = response.json()
                        gemini_key_manager.mark_groq_key_success(key_id)

                        choices = data.get("choices", [])
                        if not choices:
                            raise ValueError("Groq returned empty choices.")

                        raw_text = choices[0]["message"].get("content", "").strip()

                        if response_model is not None:
                            cleaned = raw_text
                            if "<think>" in cleaned and "</think>" in cleaned:
                                cleaned = cleaned.split("</think>")[-1].strip()
                            if "```json" in cleaned:
                                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
                            elif "```" in cleaned:
                                cleaned = cleaned.split("```")[1].split("```")[0].strip()

                            parsed_dict = json.loads(cleaned)
                            return response_model.model_validate(parsed_dict)
                        else:
                            return raw_text

                    elif response.status_code in [404, 400]:
                        # Try fallback models available on Groq (openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.6-27b)
                        for fallback_m in ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b", "llama-3.1-8b-instant"]:
                            if fallback_m == req_payload["model"]:
                                continue
                            req_payload["model"] = fallback_m
                            retry_resp = await client.post(url, json=req_payload, headers=headers)
                            if retry_resp.status_code == 200:
                                data = retry_resp.json()
                                gemini_key_manager.mark_groq_key_success(key_id)
                                raw_text = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                                if response_model is not None:
                                    cleaned = raw_text
                                    if "<think>" in cleaned and "</think>" in cleaned:
                                        cleaned = cleaned.split("</think>")[-1].strip()
                                    if "```json" in cleaned:
                                        cleaned = cleaned.split("```json")[1].split("```")[0].strip()
                                    elif "```" in cleaned:
                                        cleaned = cleaned.split("```")[1].split("```")[0].strip()
                                    parsed_dict = json.loads(cleaned)
                                    return response_model.model_validate(parsed_dict)
                                return raw_text

                    elif response.status_code == 429:
                        err_msg = response.text[:200]
                        logger.warning(f"Groq Key '{key_name}' hit 429. Rotating to next key...")
                        gemini_key_manager.mark_groq_key_rate_limited(key_id, f"Groq Rate Limit (429): {err_msg}")
                        last_error = f"Key '{key_name}' rate limited: {err_msg}"
                        continue
                    elif response.status_code == 401:
                        logger.error(f"Groq Key '{key_name}' is invalid (401).")
                        gemini_key_manager.update_groq_key(key_id, {"status": "INVALID", "is_active": False})
                        last_error = f"Key '{key_name}' 401 Unauthorized"
                        continue
                    else:
                        err_msg = response.text[:200]
                        logger.error(f"Groq API error ({response.status_code}) on key '{key_name}': {err_msg}")
                        last_error = f"HTTP {response.status_code}: {err_msg}"
                        continue

            except httpx.TimeoutException:
                logger.warning(f"Groq Key '{key_name}' timed out after {timeout_sec}s. Rotating...")
                last_error = f"Key '{key_name}' Timeout ({timeout_sec}s)"
                continue
            except Exception as e:
                logger.error(f"Exception using Groq Key '{key_name}': {e}")
                last_error = str(e)
                continue

        raise RuntimeError(f"Tất cả các Groq API Key trong Pool đều thất bại hoặc hết hạn mức. Lỗi cuối: {last_error}")

groq_client = GroqClient()
