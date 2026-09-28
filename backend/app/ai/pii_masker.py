import re

class PIIMasker:
    # Regex patterns for sensitive data
    PHONE_REGEX = re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
    EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b')
    CCCD_REGEX = re.compile(r'\b0\d{11}\b') # 12-digit Vietnam ID
    BANK_CARD_REGEX = re.compile(r'\b(?:\d{4}[ -]?){3}\d{4}\b')
    TOKEN_REGEX = re.compile(r'(?i)(token|bearer|jwt|api_key|secret)\s*[:=]\s*([a-zA-Z0-9\-\._]+)')
    PASSWORD_REGEX = re.compile(r'(?i)(password|pass|pw|mật khẩu)\s*[:=]\s*([^\s]+)')

    @classmethod
    def mask_text(cls, text: str) -> str:
        if not text:
            return text
            
        masked = cls.PASSWORD_REGEX.sub(r'\1: [REDACTED_PASSWORD]', text)
        masked = cls.TOKEN_REGEX.sub(r'\1: [REDACTED_TOKEN]', masked)
        masked = cls.CCCD_REGEX.sub(r'[REDACTED_CCCD]', masked)
        masked = cls.BANK_CARD_REGEX.sub(r'[REDACTED_BANK_CARD]', masked)
        masked = cls.EMAIL_REGEX.sub(r'[REDACTED_EMAIL]', masked)
        masked = cls.PHONE_REGEX.sub(r'[REDACTED_PHONE]', masked)
        
        # Mask potential OTPs
        otp_context = re.compile(r'(?i)(otp|code|mã)\s*[:=]?\s*(\d{4,6})\b')
        masked = otp_context.sub(r'\1: [REDACTED_OTP]', masked)
        
        return masked
