import logging
import time
from typing import Optional, Type, TypeVar, Any
from pydantic import BaseModel

from app.ai.key_manager import gemini_key_manager
from app.ai.gemini_client import gemini_client
from app.ai.groq_client import groq_client
from app.ai.cohere_client import cohere_client
from app.ai.system_persona import BASE_SYSTEM_INSTRUCTION

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

async def execute_ai_content(
    prompt: str,
    system_instruction: Optional[str] = None,
    response_model: Optional[Type[T]] = None,
    temperature: float = 0.2
) -> Any:
    """
    Executes AI prompt with support for:
    - Fixed Google Gemini
    - Fixed Groq Cloud LPU
    - Fixed Cohere AI (Trial)
    - 'auto' Hybrid Auto-Failover: Automatically switches between Google Gemini, Groq Cloud,
      and Cohere when all keys of the primary provider are exhausted or rate limited.
    """
    if not system_instruction:
        system_instruction = BASE_SYSTEM_INSTRUCTION
    elif "azmedia247" not in system_instruction.lower():
        system_instruction = BASE_SYSTEM_INSTRUCTION + "\n\nYêu cầu bổ sung:\n" + system_instruction

    config = gemini_key_manager.get_config()
    provider = config.get("provider", "auto")

    if provider == "groq":
        return await groq_client.generate_content(
            prompt=prompt,
            system_instruction=system_instruction,
            response_model=response_model,
            temperature=temperature
        )
    elif provider == "cohere":
        return await cohere_client.generate_content(
            prompt=prompt,
            system_instruction=system_instruction,
            response_model=response_model,
            temperature=temperature
        )
    elif provider == "google":
        return await gemini_client.generate_content(
            prompt=prompt,
            system_instruction=system_instruction,
            response_model=response_model,
            temperature=temperature
        )
    else:
        # provider == "auto" (Hybrid Auto-Failover)
        gemini_candidates = gemini_key_manager.get_candidate_keys()
        groq_candidates = gemini_key_manager.get_groq_candidate_keys()
        cohere_candidates = gemini_key_manager.get_cohere_candidate_keys()

        # Step 1: Try Gemini first
        if gemini_candidates:
            try:
                return await gemini_client.generate_content(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    response_model=response_model,
                    temperature=temperature
                )
            except Exception as e_gemini:
                logger.warning(f"Gemini error in auto mode: {e_gemini}. Auto-failing over to Groq Cloud...")
                
                # Record failover log
                failover_log = {
                    "timestamp": int(time.time()),
                    "key_id": "auto-failover",
                    "key_name": "Multi-Provider Failover",
                    "event": "HYBRID_AUTO_FAILOVER",
                    "message": f"Gemini bận/lỗi. Hệ thống tự động chuyển sang Groq ({config.get('groq_model_name', 'openai/gpt-oss-120b')}).",
                    "error": str(e_gemini)[:150]
                }
                gemini_key_manager._rotation_logs.insert(0, failover_log)
                if len(gemini_key_manager._rotation_logs) > 50:
                    gemini_key_manager._rotation_logs = gemini_key_manager._rotation_logs[:50]

                # Fallback to Groq
                if groq_candidates:
                    try:
                        return await groq_client.generate_content(
                            prompt=prompt,
                            system_instruction=system_instruction,
                            response_model=response_model,
                            temperature=temperature
                        )
                    except Exception as e_groq:
                        if cohere_candidates:
                            logger.warning(f"Groq error: {e_groq}. Auto-failing over to Cohere...")
                            return await cohere_client.generate_content(
                                prompt=prompt,
                                system_instruction=system_instruction,
                                response_model=response_model,
                                temperature=temperature
                            )
                        raise e_groq
                elif cohere_candidates:
                    logger.info("Direct failover to Cohere...")
                    return await cohere_client.generate_content(
                        prompt=prompt,
                        system_instruction=system_instruction,
                        response_model=response_model,
                        temperature=temperature
                    )
                else:
                    raise e_gemini

        elif groq_candidates:
            # Gemini is on cooldown or empty, try Groq
            logger.info("Gemini keys not available. Routing to Groq Cloud...")
            try:
                return await groq_client.generate_content(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    response_model=response_model,
                    temperature=temperature
                )
            except Exception as e_groq:
                if cohere_candidates:
                    logger.warning(f"Groq failed: {e_groq}. Failing over to Cohere...")
                    return await cohere_client.generate_content(
                        prompt=prompt,
                        system_instruction=system_instruction,
                        response_model=response_model,
                        temperature=temperature
                    )
                raise e_groq

        elif cohere_candidates:
            # Route to Cohere
            logger.info("Routing to Cohere AI...")
            return await cohere_client.generate_content(
                prompt=prompt,
                system_instruction=system_instruction,
                response_model=response_model,
                temperature=temperature
            )
        else:
            raise RuntimeError("Không có bất kỳ API Key nào khả dụng ở cả Google Gemini, Groq Cloud và Cohere!")
