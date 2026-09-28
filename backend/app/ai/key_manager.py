import os
import json
import uuid
import time
import asyncio
import logging
from typing import List, Dict, Optional, Any
from pathlib import Path
try:
    from app.config import settings
except Exception:
    settings = None

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SETTINGS_FILE = DATA_DIR / "ai_settings.json"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "provider": "auto",                # "auto", "google", "groq", "cohere"
    "model_name": "gemini-flash-latest",
    "groq_model_name": "openai/gpt-oss-120b",
    "cohere_model_name": "command-r-plus",
    "rotation_strategy": "FAILOVER",   # "FAILOVER" or "ROUND_ROBIN"
    "cooldown_seconds": 60,            # Seconds to wait before re-enabling a rate-limited key
    "timeout_seconds": 20,
    "confidence_threshold": 0.80,
    "ai_sentiment_escalation_enabled": True,
    "ai_sentiment_escalation_threshold": 0.82,
    "ai_sentiment_threshold_status": "SAMPLE_NEEDS_APPROVAL",
    "auto_triage": True,
    "mask_pii": True,
    "sla_p1_response": 15,
    "sla_p1_resolve": 240,
    "email_alerts": True,
    "keys": [],
    "groq_keys": [],
    "cohere_keys": []
}

class GeminiKeyManager:
    _instance = None
    _lock = asyncio.Lock()

    def __init__(self):
        self._keys: List[Dict[str, Any]] = []
        self._groq_keys: List[Dict[str, Any]] = []
        self._cohere_keys: List[Dict[str, Any]] = []
        self._config: Dict[str, Any] = dict(DEFAULT_SETTINGS)
        self._current_index: int = 0
        self._groq_current_index: int = 0
        self._cohere_current_index: int = 0
        self._rotation_logs: List[Dict[str, Any]] = []
        self._load_from_storage()

    @classmethod
    def get_instance(cls) -> "GeminiKeyManager":
        if cls._instance is None:
            cls._instance = GeminiKeyManager()
        return cls._instance

    def _ensure_data_dir(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    def _load_from_storage(self):
        """Loads AI settings and keys from local JSON file, initializing with .env if empty"""
        self._ensure_data_dir()
        if SETTINGS_FILE.exists():
            try:
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._config.update({k: v for k, v in data.items() if k not in ["keys", "groq_keys", "cohere_keys"]})
                    self._keys = data.get("keys", [])
                    self._groq_keys = data.get("groq_keys", [])
                    self._cohere_keys = data.get("cohere_keys", [])
                    logger.info(f"Loaded {len(self._keys)} Gemini keys, {len(self._groq_keys)} Groq keys, {len(self._cohere_keys)} Cohere keys from storage.")
                    return
            except Exception as e:
                logger.error(f"Error loading AI settings from {SETTINGS_FILE}: {e}")

        # Initial fallback: check environment variable GOOGLE_API_KEY
        env_key = getattr(settings, "GOOGLE_API_KEY", None) or os.getenv("GOOGLE_API_KEY")
        if env_key and env_key != "your-google-api-key" and not self._keys:
            self._keys.append({
                "id": str(uuid.uuid4())[:8],
                "name": "Default Primary Key (.env)",
                "key": env_key,
                "is_active": True,
                "status": "ACTIVE",
                "total_requests": 0,
                "failed_requests": 0,
                "last_used_at": None,
                "last_error": None,
                "rate_limited_until": 0,
                "created_at": int(time.time())
            })
        self._save_to_storage()

    def _save_to_storage(self):
        """Persists AI settings and keys to local JSON file"""
        self._ensure_data_dir()
        try:
            payload = dict(self._config)
            payload["keys"] = self._keys
            payload["groq_keys"] = self._groq_keys
            payload["cohere_keys"] = self._cohere_keys
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving AI settings to {SETTINGS_FILE}: {e}")

    def _mask_key(self, key_str: str) -> str:
        if not key_str or len(key_str) < 8:
            return "******"
        return f"{key_str[:6]}...{key_str[-4:]}"

    def get_config(self) -> Dict[str, Any]:
        """Returns public configuration and key metadata (masked secret keys)"""
        now = time.time()
        
        # Refresh Gemini keys cooldown
        for k in self._keys:
            if k.get("status") == "RATE_LIMITED" and k.get("rate_limited_until", 0) <= now:
                k["status"] = "ACTIVE"
                k["last_error"] = "Hồi phục sau thời gian chờ (Cooldown expired)"

        # Refresh Groq keys cooldown
        for k in self._groq_keys:
            if k.get("status") == "RATE_LIMITED" and k.get("rate_limited_until", 0) <= now:
                k["status"] = "ACTIVE"
                k["last_error"] = "Hồi phục sau thời gian chờ (Cooldown expired)"

        # Refresh Cohere keys cooldown
        for k in self._cohere_keys:
            if k.get("status") == "RATE_LIMITED" and k.get("rate_limited_until", 0) <= now:
                k["status"] = "ACTIVE"
                k["last_error"] = "Hồi phục sau thời gian chờ (Cooldown expired)"

        masked_gemini_keys = []
        for k in self._keys:
            masked_gemini_keys.append({
                "id": k["id"],
                "name": k.get("name", "Gemini Key"),
                "masked_key": self._mask_key(k["key"]),
                "is_active": k.get("is_active", True),
                "status": k.get("status", "ACTIVE"),
                "total_requests": k.get("total_requests", 0),
                "failed_requests": k.get("failed_requests", 0),
                "last_used_at": k.get("last_used_at"),
                "last_error": k.get("last_error"),
                "rate_limited_until": k.get("rate_limited_until", 0),
                "remaining_cooldown": max(0, int(k.get("rate_limited_until", 0) - now)) if k.get("status") == "RATE_LIMITED" else 0,
                "created_at": k.get("created_at", int(now))
            })

        masked_groq_keys = []
        for k in self._groq_keys:
            masked_groq_keys.append({
                "id": k["id"],
                "name": k.get("name", "Groq Key"),
                "masked_key": self._mask_key(k["key"]),
                "is_active": k.get("is_active", True),
                "status": k.get("status", "ACTIVE"),
                "total_requests": k.get("total_requests", 0),
                "failed_requests": k.get("failed_requests", 0),
                "last_used_at": k.get("last_used_at"),
                "last_error": k.get("last_error"),
                "rate_limited_until": k.get("rate_limited_until", 0),
                "remaining_cooldown": max(0, int(k.get("rate_limited_until", 0) - now)) if k.get("status") == "RATE_LIMITED" else 0,
                "created_at": k.get("created_at", int(now))
            })

        masked_cohere_keys = []
        for k in self._cohere_keys:
            masked_cohere_keys.append({
                "id": k["id"],
                "name": k.get("name", "Cohere Key"),
                "masked_key": self._mask_key(k["key"]),
                "is_active": k.get("is_active", True),
                "status": k.get("status", "ACTIVE"),
                "total_requests": k.get("total_requests", 0),
                "failed_requests": k.get("failed_requests", 0),
                "last_used_at": k.get("last_used_at"),
                "last_error": k.get("last_error"),
                "rate_limited_until": k.get("rate_limited_until", 0),
                "remaining_cooldown": max(0, int(k.get("rate_limited_until", 0) - now)) if k.get("status") == "RATE_LIMITED" else 0,
                "created_at": k.get("created_at", int(now))
            })

        active_gemini = sum(1 for k in self._keys if k.get("is_active", True) and k.get("status") == "ACTIVE")
        rate_gemini = sum(1 for k in self._keys if k.get("status") == "RATE_LIMITED")
        error_gemini = sum(1 for k in self._keys if k.get("status") == "INVALID")

        active_groq = sum(1 for k in self._groq_keys if k.get("is_active", True) and k.get("status") == "ACTIVE")
        rate_groq = sum(1 for k in self._groq_keys if k.get("status") == "RATE_LIMITED")
        error_groq = sum(1 for k in self._groq_keys if k.get("status") == "INVALID")

        active_cohere = sum(1 for k in self._cohere_keys if k.get("is_active", True) and k.get("status") == "ACTIVE")
        rate_cohere = sum(1 for k in self._cohere_keys if k.get("status") == "RATE_LIMITED")
        error_cohere = sum(1 for k in self._cohere_keys if k.get("status") == "INVALID")

        return {
            **self._config,
            "keys": masked_gemini_keys,
            "groq_keys": masked_groq_keys,
            "cohere_keys": masked_cohere_keys,
            "stats": {
                "total_keys": len(self._keys),
                "active_keys": active_gemini,
                "rate_limited_keys": rate_gemini,
                "error_keys": error_gemini,
                "current_index": self._current_index % max(1, len(self._keys))
            },
            "groq_stats": {
                "total_keys": len(self._groq_keys),
                "active_keys": active_groq,
                "rate_limited_keys": rate_groq,
                "error_keys": error_groq,
                "current_index": self._groq_current_index % max(1, len(self._groq_keys))
            },
            "cohere_stats": {
                "total_keys": len(self._cohere_keys),
                "active_keys": active_cohere,
                "rate_limited_keys": rate_cohere,
                "error_keys": error_cohere,
                "current_index": self._cohere_current_index % max(1, len(self._cohere_keys))
            }
        }

    def update_config(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Updates general AI configuration"""
        for k, v in updates.items():
            if k in self._config and k not in ["keys", "groq_keys", "cohere_keys"]:
                self._config[k] = v
        self._save_to_storage()
        return self.get_config()

    # --- GEMINI KEY MANAGEMENT ---

    def add_key(self, key_str: str, name: Optional[str] = None) -> Dict[str, Any]:
        key_clean = key_str.strip()
        if not key_clean:
            raise ValueError("API Key cannot be empty")
        for existing in self._keys:
            if existing["key"] == key_clean:
                raise ValueError("API Key already exists in pool")

        auto_name = name.strip() if name and name.strip() else f"key {len(self._keys) + 1}"
        new_entry = {
            "id": str(uuid.uuid4())[:8],
            "name": auto_name,
            "key": key_clean,
            "is_active": True,
            "status": "ACTIVE",
            "total_requests": 0,
            "failed_requests": 0,
            "last_used_at": None,
            "last_error": None,
            "rate_limited_until": 0,
            "created_at": int(time.time())
        }
        self._keys.append(new_entry)
        self._save_to_storage()
        return self.get_config()

    def add_batch_keys(self, key_lines: List[str]) -> Dict[str, Any]:
        existing_keys = {k["key"] for k in self._keys}
        for line in key_lines:
            cleaned = line.strip()
            if cleaned and cleaned not in existing_keys:
                existing_keys.add(cleaned)
                self._keys.append({
                    "id": str(uuid.uuid4())[:8],
                    "name": f"key {len(self._keys) + 1}",
                    "key": cleaned,
                    "is_active": True,
                    "status": "ACTIVE",
                    "total_requests": 0,
                    "failed_requests": 0,
                    "last_used_at": None,
                    "last_error": None,
                    "rate_limited_until": 0,
                    "created_at": int(time.time())
                })
        self._save_to_storage()
        return self.get_config()

    def update_key(self, key_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        for k in self._keys:
            if k["id"] == key_id:
                if "name" in updates and updates["name"]:
                    k["name"] = updates["name"]
                if "is_active" in updates:
                    k["is_active"] = bool(updates["is_active"])
                    if not k["is_active"]:
                        k["status"] = "DISABLED"
                    elif k["status"] == "DISABLED":
                        k["status"] = "ACTIVE"
                if "status" in updates:
                    k["status"] = updates["status"]
                break
        self._save_to_storage()
        return self.get_config()

    def delete_key(self, key_id: str) -> Dict[str, Any]:
        self._keys = [k for k in self._keys if k["id"] != key_id]
        self._save_to_storage()
        return self.get_config()

    def reset_statuses(self) -> Dict[str, Any]:
        for k in self._keys:
            if k.get("is_active", True):
                k["status"] = "ACTIVE"
                k["rate_limited_until"] = 0
                k["last_error"] = None
        self._save_to_storage()
        return self.get_config()

    def get_raw_key_by_id(self, key_id: str) -> Optional[str]:
        for k in self._keys:
            if k["id"] == key_id:
                return k["key"]
        return None

    def get_candidate_keys(self) -> List[Dict[str, Any]]:
        now = time.time()
        for k in self._keys:
            if k.get("status") == "RATE_LIMITED" and k.get("rate_limited_until", 0) <= now:
                k["status"] = "ACTIVE"
                k["last_error"] = None

        available = [
            k for k in self._keys
            if k.get("is_active", True) and k.get("status") == "ACTIVE"
        ]

        if not available:
            rate_limited = [k for k in self._keys if k.get("is_active", True) and k.get("status") == "RATE_LIMITED"]
            if rate_limited:
                rate_limited.sort(key=lambda x: x.get("rate_limited_until", 0))
                return rate_limited
            return []

        strategy = self._config.get("rotation_strategy", "FAILOVER")
        if strategy == "ROUND_ROBIN" and len(available) > 1:
            idx = self._current_index % len(available)
            ordered = available[idx:] + available[:idx]
            self._current_index = (self._current_index + 1) % len(available)
            return ordered
        else:
            return available

    def mark_key_success(self, key_id: str):
        for k in self._keys:
            if k["id"] == key_id:
                k["total_requests"] = k.get("total_requests", 0) + 1
                k["last_used_at"] = int(time.time())
                k["status"] = "ACTIVE"
                k["last_error"] = None
                break
        self._save_to_storage()

    def mark_key_rate_limited(self, key_id: str, error_msg: str = "Rate Limit Exceeded (HTTP 429)"):
        cooldown = self._config.get("cooldown_seconds", 60)
        now = time.time()
        key_name = "Unknown"
        for k in self._keys:
            if k["id"] == key_id:
                key_name = k.get("name", "Gemini Key")
                k["status"] = "RATE_LIMITED"
                k["failed_requests"] = k.get("failed_requests", 0) + 1
                k["last_error"] = error_msg
                k["rate_limited_until"] = int(now + cooldown)
                k["last_used_at"] = int(now)
                break

        log_entry = {
            "timestamp": int(now),
            "key_id": key_id,
            "key_name": key_name,
            "event": "GEMINI_RATE_LIMITED_ROTATED",
            "message": f"Gemini Key '{key_name}' hết quota / rate limit. Tự động xoay sang key kế tiếp (chờ {cooldown}s).",
            "error": error_msg
        }
        self._rotation_logs.insert(0, log_entry)
        if len(self._rotation_logs) > 50:
            self._rotation_logs = self._rotation_logs[:50]
        self._save_to_storage()

    def mark_key_invalid(self, key_id: str, error_msg: str = "Invalid API Key"):
        for k in self._keys:
            if k["id"] == key_id:
                k["status"] = "INVALID"
                k["is_active"] = False
                k["last_error"] = error_msg
                break
        self._save_to_storage()

    # --- GROQ KEY MANAGEMENT ---

    def add_groq_key(self, key_str: str, name: Optional[str] = None) -> Dict[str, Any]:
        key_clean = key_str.strip()
        if not key_clean:
            raise ValueError("Groq API Key cannot be empty")
        for existing in self._groq_keys:
            if existing["key"] == key_clean:
                raise ValueError("Groq API Key already exists in pool")

        auto_name = name.strip() if name and name.strip() else f"groq key {len(self._groq_keys) + 1}"
        new_entry = {
            "id": str(uuid.uuid4())[:8],
            "name": auto_name,
            "key": key_clean,
            "is_active": True,
            "status": "ACTIVE",
            "total_requests": 0,
            "failed_requests": 0,
            "last_used_at": None,
            "last_error": None,
            "rate_limited_until": 0,
            "created_at": int(time.time())
        }
        self._groq_keys.append(new_entry)
        self._save_to_storage()
        return self.get_config()

    def add_batch_groq_keys(self, key_lines: List[str]) -> Dict[str, Any]:
        existing_keys = {k["key"] for k in self._groq_keys}
        for line in key_lines:
            cleaned = line.strip()
            if cleaned and cleaned not in existing_keys:
                existing_keys.add(cleaned)
                self._groq_keys.append({
                    "id": str(uuid.uuid4())[:8],
                    "name": f"groq key {len(self._groq_keys) + 1}",
                    "key": cleaned,
                    "is_active": True,
                    "status": "ACTIVE",
                    "total_requests": 0,
                    "failed_requests": 0,
                    "last_used_at": None,
                    "last_error": None,
                    "rate_limited_until": 0,
                    "created_at": int(time.time())
                })
        self._save_to_storage()
        return self.get_config()

    def update_groq_key(self, key_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        for k in self._groq_keys:
            if k["id"] == key_id:
                if "name" in updates and updates["name"]:
                    k["name"] = updates["name"]
                if "is_active" in updates:
                    k["is_active"] = bool(updates["is_active"])
                    if not k["is_active"]:
                        k["status"] = "DISABLED"
                    elif k["status"] == "DISABLED":
                        k["status"] = "ACTIVE"
                if "status" in updates:
                    k["status"] = updates["status"]
                break
        self._save_to_storage()
        return self.get_config()

    def delete_groq_key(self, key_id: str) -> Dict[str, Any]:
        self._groq_keys = [k for k in self._groq_keys if k["id"] != key_id]
        self._save_to_storage()
        return self.get_config()

    def reset_groq_statuses(self) -> Dict[str, Any]:
        for k in self._groq_keys:
            if k.get("is_active", True):
                k["status"] = "ACTIVE"
                k["rate_limited_until"] = 0
                k["last_error"] = None
        self._save_to_storage()
        return self.get_config()

    def get_raw_groq_key_by_id(self, key_id: str) -> Optional[str]:
        for k in self._groq_keys:
            if k["id"] == key_id:
                return k["key"]
        return None

    def get_groq_candidate_keys(self) -> List[Dict[str, Any]]:
        now = time.time()
        for k in self._groq_keys:
            if k.get("status") == "RATE_LIMITED" and k.get("rate_limited_until", 0) <= now:
                k["status"] = "ACTIVE"
                k["last_error"] = None

        available = [
            k for k in self._groq_keys
            if k.get("is_active", True) and k.get("status") == "ACTIVE"
        ]

        if not available:
            rate_limited = [k for k in self._groq_keys if k.get("is_active", True) and k.get("status") == "RATE_LIMITED"]
            if rate_limited:
                rate_limited.sort(key=lambda x: x.get("rate_limited_until", 0))
                return rate_limited
            return []

        strategy = self._config.get("rotation_strategy", "FAILOVER")
        if strategy == "ROUND_ROBIN" and len(available) > 1:
            idx = self._groq_current_index % len(available)
            ordered = available[idx:] + available[:idx]
            self._groq_current_index = (self._groq_current_index + 1) % len(available)
            return ordered
        else:
            return available

    def mark_groq_key_success(self, key_id: str):
        for k in self._groq_keys:
            if k["id"] == key_id:
                k["total_requests"] = k.get("total_requests", 0) + 1
                k["last_used_at"] = int(time.time())
                k["status"] = "ACTIVE"
                k["last_error"] = None
                break
        self._save_to_storage()

    def mark_groq_key_rate_limited(self, key_id: str, error_msg: str = "Groq Rate Limit Exceeded (HTTP 429)"):
        cooldown = self._config.get("cooldown_seconds", 60)
        now = time.time()
        key_name = "Unknown"
        for k in self._groq_keys:
            if k["id"] == key_id:
                key_name = k.get("name", "Groq Key")
                k["status"] = "RATE_LIMITED"
                k["failed_requests"] = k.get("failed_requests", 0) + 1
                k["last_error"] = error_msg
                k["rate_limited_until"] = int(now + cooldown)
                k["last_used_at"] = int(now)
                break

        log_entry = {
            "timestamp": int(now),
            "key_id": key_id,
            "key_name": key_name,
            "event": "GROQ_RATE_LIMITED_ROTATED",
            "message": f"Groq Key '{key_name}' hết quota / rate limit. Tự động xoay sang key kế tiếp (chờ {cooldown}s).",
            "error": error_msg
        }
        self._rotation_logs.insert(0, log_entry)
        if len(self._rotation_logs) > 50:
            self._rotation_logs = self._rotation_logs[:50]
        self._save_to_storage()

    def mark_groq_key_invalid(self, key_id: str, error_msg: str = "Invalid Groq Key"):
        for k in self._groq_keys:
            if k["id"] == key_id:
                k["status"] = "INVALID"
                k["is_active"] = False
                k["last_error"] = error_msg
                break
        self._save_to_storage()

    # --- COHERE KEY MANAGEMENT ---

    def add_cohere_key(self, key_str: str, name: Optional[str] = None) -> Dict[str, Any]:
        key_clean = key_str.strip()
        if not key_clean:
            raise ValueError("Cohere API Key cannot be empty")
        for existing in self._cohere_keys:
            if existing["key"] == key_clean:
                raise ValueError("Cohere API Key already exists in pool")

        auto_name = name.strip() if name and name.strip() else f"cohere key {len(self._cohere_keys) + 1}"
        new_entry = {
            "id": str(uuid.uuid4())[:8],
            "name": auto_name,
            "key": key_clean,
            "is_active": True,
            "status": "ACTIVE",
            "total_requests": 0,
            "failed_requests": 0,
            "last_used_at": None,
            "last_error": None,
            "rate_limited_until": 0,
            "created_at": int(time.time())
        }
        self._cohere_keys.append(new_entry)
        self._save_to_storage()
        return self.get_config()

    def add_batch_cohere_keys(self, key_lines: List[str]) -> Dict[str, Any]:
        existing_keys = {k["key"] for k in self._cohere_keys}
        for line in key_lines:
            cleaned = line.strip()
            if cleaned and cleaned not in existing_keys:
                existing_keys.add(cleaned)
                self._cohere_keys.append({
                    "id": str(uuid.uuid4())[:8],
                    "name": f"cohere key {len(self._cohere_keys) + 1}",
                    "key": cleaned,
                    "is_active": True,
                    "status": "ACTIVE",
                    "total_requests": 0,
                    "failed_requests": 0,
                    "last_used_at": None,
                    "last_error": None,
                    "rate_limited_until": 0,
                    "created_at": int(time.time())
                })
        self._save_to_storage()
        return self.get_config()

    def update_cohere_key(self, key_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        for k in self._cohere_keys:
            if k["id"] == key_id:
                if "name" in updates and updates["name"]:
                    k["name"] = updates["name"]
                if "is_active" in updates:
                    k["is_active"] = bool(updates["is_active"])
                    if not k["is_active"]:
                        k["status"] = "DISABLED"
                    elif k["status"] == "DISABLED":
                        k["status"] = "ACTIVE"
                if "status" in updates:
                    k["status"] = updates["status"]
                break
        self._save_to_storage()
        return self.get_config()

    def delete_cohere_key(self, key_id: str) -> Dict[str, Any]:
        self._cohere_keys = [k for k in self._cohere_keys if k["id"] != key_id]
        self._save_to_storage()
        return self.get_config()

    def reset_cohere_statuses(self) -> Dict[str, Any]:
        for k in self._cohere_keys:
            if k.get("is_active", True):
                k["status"] = "ACTIVE"
                k["rate_limited_until"] = 0
                k["last_error"] = None
        self._save_to_storage()
        return self.get_config()

    def get_raw_cohere_key_by_id(self, key_id: str) -> Optional[str]:
        for k in self._cohere_keys:
            if k["id"] == key_id:
                return k["key"]
        return None

    def get_cohere_candidate_keys(self) -> List[Dict[str, Any]]:
        now = time.time()
        for k in self._cohere_keys:
            if k.get("status") == "RATE_LIMITED" and k.get("rate_limited_until", 0) <= now:
                k["status"] = "ACTIVE"
                k["last_error"] = None

        available = [
            k for k in self._cohere_keys
            if k.get("is_active", True) and k.get("status") == "ACTIVE"
        ]

        if not available:
            rate_limited = [k for k in self._cohere_keys if k.get("is_active", True) and k.get("status") == "RATE_LIMITED"]
            if rate_limited:
                rate_limited.sort(key=lambda x: x.get("rate_limited_until", 0))
                return rate_limited
            return []

        strategy = self._config.get("rotation_strategy", "FAILOVER")
        if strategy == "ROUND_ROBIN" and len(available) > 1:
            idx = self._cohere_current_index % len(available)
            ordered = available[idx:] + available[:idx]
            self._cohere_current_index = (self._cohere_current_index + 1) % len(available)
            return ordered
        else:
            return available

    def mark_cohere_key_success(self, key_id: str):
        for k in self._cohere_keys:
            if k["id"] == key_id:
                k["total_requests"] = k.get("total_requests", 0) + 1
                k["last_used_at"] = int(time.time())
                k["status"] = "ACTIVE"
                k["last_error"] = None
                break
        self._save_to_storage()

    def mark_cohere_key_rate_limited(self, key_id: str, error_msg: str = "Cohere Rate Limit Exceeded (HTTP 429)"):
        cooldown = self._config.get("cooldown_seconds", 60)
        now = time.time()
        key_name = "Unknown"
        for k in self._cohere_keys:
            if k["id"] == key_id:
                key_name = k.get("name", "Cohere Key")
                k["status"] = "RATE_LIMITED"
                k["failed_requests"] = k.get("failed_requests", 0) + 1
                k["last_error"] = error_msg
                k["rate_limited_until"] = int(now + cooldown)
                k["last_used_at"] = int(now)
                break

        log_entry = {
            "timestamp": int(now),
            "key_id": key_id,
            "key_name": key_name,
            "event": "COHERE_RATE_LIMITED_ROTATED",
            "message": f"Cohere Key '{key_name}' hết quota / rate limit. Tự động xoay sang key kế tiếp (chờ {cooldown}s).",
            "error": error_msg
        }
        self._rotation_logs.insert(0, log_entry)
        if len(self._rotation_logs) > 50:
            self._rotation_logs = self._rotation_logs[:50]
        self._save_to_storage()

    def mark_cohere_key_invalid(self, key_id: str, error_msg: str = "Invalid Cohere Key"):
        for k in self._cohere_keys:
            if k["id"] == key_id:
                k["status"] = "INVALID"
                k["is_active"] = False
                k["last_error"] = error_msg
                break
        self._save_to_storage()

    def get_rotation_logs(self) -> List[Dict[str, Any]]:
        return self._rotation_logs

# Export singleton
gemini_key_manager = GeminiKeyManager.get_instance()
