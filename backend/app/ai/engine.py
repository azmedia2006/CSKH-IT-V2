import logging
from app.config import settings
from app.ai.key_manager import gemini_key_manager

logger = logging.getLogger(__name__)

def get_llm():
    """Factory to get the configured LLM client (with dynamic settings fallback)"""
    config = gemini_key_manager.get_config()
    provider = config.get("provider", settings.AI_PROVIDER).lower()
    model_name = config.get("model_name", settings.AI_MODEL_NAME)
    timeout_sec = config.get("timeout_seconds", settings.AI_TIMEOUT_SECONDS)

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model_name,
            temperature=0,
            api_key=settings.OPENAI_API_KEY,
            request_timeout=timeout_sec
        )
    elif provider in ("google", "gemini"):
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            candidates = gemini_key_manager.get_candidate_keys()
            api_key = candidates[0]["key"] if candidates else (settings.GOOGLE_API_KEY or "fake-key")
            return ChatGoogleGenerativeAI(
                model=model_name,
                temperature=0,
                google_api_key=api_key,
                timeout=timeout_sec
            )
        except Exception as e:
            logger.warning(f"langchain_google_genai not initialized, using direct gemini_client: {e}")
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(model="gpt-4o-mini", api_key="dummy")
    else:
        raise ValueError(f"Unsupported AI Provider: {provider}")
