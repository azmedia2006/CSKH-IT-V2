from enum import Enum


class PriorityLevel(str, Enum):
    P1 = "P1"  # Critical
    P2 = "P2"  # High
    P3 = "P3"  # Medium
    P4 = "P4"  # Low


class TicketStatus(str, Enum):
    NEW = "NEW"
    PROCESSING = "PROCESSING"
    WAITING_CUSTOMER = "WAITING_CUSTOMER"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


# Valid status transitions: {current_status: [allowed_next_statuses]}
VALID_STATUS_TRANSITIONS = {
    "NEW": ["PROCESSING", "WAITING_CUSTOMER", "CLOSED"],
    "PROCESSING": ["WAITING_CUSTOMER", "RESOLVED", "CLOSED"],
    "WAITING_CUSTOMER": ["PROCESSING", "RESOLVED", "CLOSED"],
    "RESOLVED": ["CLOSED", "PROCESSING"],
    "CLOSED": ["PROCESSING"],
}


class DefaultCategories(str, Enum):
    ACCOUNT_AUTH = "ACCOUNT_AUTH"
    SOFTWARE_BUG = "SOFTWARE_BUG"
    NETWORK_INFRA = "NETWORK_INFRA"
    ACCESS_RESOURCE = "ACCESS_RESOURCE"
    TECH_GUIDE = "TECH_GUIDE"
    DEVICE = "DEVICE"
    UNCATEGORIZED = "UNCATEGORIZED"


class RoleEnum(str, Enum):
    ADMIN = "ADMIN"
    TEAM_LEAD = "TEAM_LEAD"
    SUPPORT_AGENT = "SUPPORT_AGENT"
    REQUESTER = "REQUESTER"


# Allowed MIME types for attachment uploads
ALLOWED_ATTACHMENT_MIMES = {"image/png", "image/jpeg", "image/webp"}
ALLOWED_ATTACHMENT_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_ATTACHMENTS_PER_TICKET = 5

# Magic bytes signatures for file content validation
FILE_MAGIC_BYTES = {
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
    b"RIFF": "image/webp",  # RIFF....WEBP
}
