import json
import time
import re
import logging
from typing import Dict, Any, Optional, Type, TypeVar
import httpx
from pydantic import BaseModel
from app.ai.key_manager import gemini_key_manager

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

class GeminiClient:
    def __init__(self):
        pass

    async def test_key(self, api_key: str, model_name: str = "gemini-flash-latest") -> Dict[str, Any]:
        """Tests a single Gemini API key with a ping request and returns latency & status"""
        # Auto-detect suitable model (gemini-3.6-flash, gemini-2.5-flash, or model_name)
        candidate_models = [model_name]
        for m in ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"]:
            if m not in candidate_models:
                candidate_models.append(m)

        start_time = time.time()
        payload = {
            "contents": [
                {
                    "parts": [{"text": "Trả lời ngắn gọn 1 từ: 'OK'"}]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 10,
                "temperature": 0.1
            }
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = None
                for cur_m in candidate_models:
                    cur_url = f"{GEMINI_API_BASE}/{cur_m}:generateContent?key={api_key}"
                    response = await client.post(cur_url, json=payload)
                    if response.status_code == 200:
                        model_name = cur_m
                        break
                    elif response.status_code == 429 or response.status_code in [400, 403]:
                        break # Key has rate limit or auth issue, no need to cycle models
                latency_ms = round((time.time() - start_time) * 1000, 1)

                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    reply_text = "OK"
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            reply_text = parts[0].get("text", "OK").strip()

                    return {
                        "success": True,
                        "status_code": 200,
                        "latency_ms": latency_ms,
                        "message": f"Kết nối thành công! (Độ trễ: {latency_ms}ms, Phản hồi: {reply_text})",
                        "model": model_name
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
                    return {
                        "success": False,
                        "status_code": 404,
                        "latency_ms": latency_ms,
                        "message": "Lỗi 404: Model không khả dụng",
                        "error_type": "NOT_FOUND"
                    }
                elif response.status_code == 400:
                    return {
                        "success": False,
                        "status_code": 400,
                        "latency_ms": latency_ms,
                        "message": "Lỗi 400: API Key không hợp lệ",
                        "error_type": "INVALID_KEY"
                    }
                elif response.status_code == 403:
                    return {
                        "success": False,
                        "status_code": 403,
                        "latency_ms": latency_ms,
                        "message": "Lỗi 403: Bị từ chối truy cập",
                        "error_type": "FORBIDDEN"
                    }
                else:
                    return {
                        "success": False,
                        "status_code": response.status_code,
                        "latency_ms": latency_ms,
                        "message": f"Lỗi API ({response.status_code})",
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
                "message": "Lỗi: Không kết nối được mạng",
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
        Executes a prompt against Gemini with smart auto-rotation across the key pool.
        If a key hits 429 (Resource Exhausted / Rate Limit), it marks the key and rotates to the next.
        """
        config = gemini_key_manager.get_config()
        model_name = config.get("model_name", "gemini-flash-latest")
        timeout_sec = min(float(config.get("timeout_seconds", 15)), 8.0)

        candidate_keys = gemini_key_manager.get_candidate_keys()
        if not candidate_keys:
            raise RuntimeError("Không có Gemini API Key nào khả dụng trong hệ thống! Vui lòng thêm key tại Cài đặt.")

        # Prepare request payload
        contents = [{"parts": [{"text": prompt}]}]
        req_payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
            }
        }

        if system_instruction:
            req_payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        # If structured output is requested, instruct Gemini to return pure JSON
        if response_model is not None:
            json_schema_prompt = f"\n\nIMPORTANT: You must respond ONLY with a valid JSON object strictly matching this schema: {json.dumps(response_model.model_json_schema())}. Do NOT include markdown code fences or other text."
            req_payload["contents"][0]["parts"][0]["text"] += json_schema_prompt
            req_payload["generationConfig"]["responseMimeType"] = "application/json"

        last_error = None
        attempt_count = 0
        max_gemini_attempts = min(len(candidate_keys), 3)

        for key_item in candidate_keys:
            if attempt_count >= max_gemini_attempts:
                logger.warning(f"Gemini pool hit {attempt_count} consecutive failed keys. Breaking to allow rapid multi-provider failover.")
                break
            attempt_count += 1
            key_id = key_item["id"]
            raw_key = key_item["key"]
            key_name = key_item.get("name", key_id)

            url = f"{GEMINI_API_BASE}/{model_name}:generateContent?key={raw_key}"

            try:
                async with httpx.AsyncClient(timeout=float(timeout_sec)) as client:
                    resp = await client.post(url, json=req_payload)

                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if not candidates:
                            raise ValueError("Gemini API returned empty candidates.")

                        content_parts = candidates[0].get("content", {}).get("parts", [])
                        raw_text = content_parts[0].get("text", "") if content_parts else ""

                        gemini_key_manager.mark_key_success(key_id)
                        logger.info(f"Gemini request succeeded using key '{key_name}' (Model: {model_name})")

                        if response_model is not None:
                            return self._parse_json_response(raw_text, response_model)
                        return raw_text

                    elif resp.status_code == 429:
                        # Rate limited or quota exhausted -> Rotate to next key!
                        err_json = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                        err_msg = err_json.get("error", {}).get("message", "HTTP 429 Too Many Requests / Quota Exceeded")
                        gemini_key_manager.mark_key_rate_limited(key_id, err_msg)
                        last_error = f"Key '{key_name}' rate limited: {err_msg}"
                        logger.warning(f"Key '{key_name}' hit 429. Rotating to next key...")
                        continue

                    elif resp.status_code in (400, 403):
                        err_json = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                        err_msg = err_json.get("error", {}).get("message", resp.text)
                        if "API_KEY_INVALID" in err_msg or "PERMISSION_DENIED" in err_msg or resp.status_code == 403:
                            gemini_key_manager.mark_key_invalid(key_id, err_msg)
                        last_error = f"Key '{key_name}' error ({resp.status_code}): {err_msg}"
                        logger.warning(f"Key '{key_name}' error {resp.status_code}. Rotating to next key...")
                        continue

                    else:
                        last_error = f"Gemini API returned status {resp.status_code}: {resp.text}"
                        continue

            except httpx.TimeoutException:
                last_error = f"Key '{key_name}' timed out after {timeout_sec}s"
                logger.warning(last_error)
                continue
            except Exception as e:
                last_error = f"Key '{key_name}' exception: {str(e)}"
                logger.error(last_error)
                continue

        # If all keys failed
        raise RuntimeError(f"Tất cả các Gemini API Key trong Pool đều thất bại hoặc hết hạn mức. Lỗi cuối: {last_error}")

    def _parse_json_response(self, text: str, model_cls: Type[T]) -> T:
        """Helper to cleanly parse JSON from LLM text into a Pydantic model"""
        clean_text = text.strip()
        # Remove markdown ```json ... ``` wrapper if present
        if clean_text.startswith("```"):
            clean_text = re.sub(r"^```[a-zA-Z]*\n?", "", clean_text)
            clean_text = re.sub(r"\n?```$", "", clean_text)
            clean_text = clean_text.strip()

        try:
            data = json.loads(clean_text)
            return model_cls.model_validate(data)
        except Exception as e:
            logger.error(f"Failed to parse structured JSON from Gemini output: '{clean_text[:200]}...'. Error: {e}")
            # Try regex extraction of JSON object
            match = re.search(r"\{.*\}", clean_text, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                return model_cls.model_validate(data)
            raise

gemini_client = GeminiClient()
