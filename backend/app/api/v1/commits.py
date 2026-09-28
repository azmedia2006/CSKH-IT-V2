import json
import logging
import re
import subprocess
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from fastapi import APIRouter, Query

from app.config import settings
from app.core.redis import redis_client

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_REPOS = [
    "azmedia2006/CSKH-IT",
    "azmedia2006/DevSquad"
]

def parse_commit_type(message: str) -> dict:
    """Analyze commit title for Conventional Commits format."""
    first_line = message.strip().split("\n")[0]
    match = re.match(r"^(\w+)(?:\(([^)]+)\))?:\s*(.+)$", first_line)
    if match:
        tag, scope, clean_title = match.groups()
        tag_lower = tag.lower()
        valid_types = {"feat", "fix", "docs", "style", "refactor", "perf", "test", "chore", "build", "ci"}
        c_type = tag_lower if tag_lower in valid_types else "other"
        return {
            "type": c_type,
            "scope": scope,
            "title": clean_title.strip()
        }
    
    # Heuristics for non-conventional messages
    lower = first_line.lower()
    if any(k in lower for k in ["fix", "bug", "sửa", "khắc phục"]):
        return {"type": "fix", "scope": None, "title": first_line}
    if any(k in lower for k in ["feat", "add", "thêm", "tạo", "mới"]):
        return {"type": "feat", "scope": None, "title": first_line}
    if any(k in lower for k in ["doc", "readme", "hướng dẫn", "tài liệu"]):
        return {"type": "docs", "scope": None, "title": first_line}
    if any(k in lower for k in ["clean", "refactor", "tối ưu", "cải tiến", "giao diện", "ui", "menu"]):
        return {"type": "refactor", "scope": None, "title": first_line}
    
    return {"type": "chore", "scope": None, "title": first_line}


def get_local_git_commits(limit: int = 50) -> List[dict]:
    """Fallback method using local git command if network fails."""
    try:
        cmd = [
            "git", "log", f"-n{limit}",
            "--pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%B%x1e"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        raw_entries = res.stdout.strip().split("\x1e")
        commits = []
        for raw in raw_entries:
            if not raw.strip():
                continue
            parts = raw.split("\x1f")
            if len(parts) >= 5:
                sha, author, email, date_str, msg = parts[0], parts[1], parts[2], parts[3], parts[4].strip()
                parsed = parse_commit_type(msg)
                commits.append({
                    "sha": sha,
                    "short_sha": sha[:7],
                    "title": parsed["title"],
                    "full_message": msg,
                    "type": parsed["type"],
                    "scope": parsed["scope"],
                    "author_name": author,
                    "author_email": email,
                    "author_avatar": None,
                    "date": date_str,
                    "html_url": f"https://github.com/azmedia2006/CSKH-IT/commit/{sha}"
                })
        return commits
    except Exception as e:
        logger.error(f"Failed to get local git commits: {e}")
        return []


@router.get("")
async def get_commits(
    repo: str = Query(default="azmedia2006/CSKH-IT", description="GitHub Repository owner/repo"),
    branch: str = Query(default="main", description="Branch name"),
    per_page: int = Query(default=50, ge=1, le=100),
    refresh: bool = Query(default=False, description="Force refresh bypass cache")
):
    """
    Lấy danh sách commits trực tiếp từ GitHub để đồng bộ hiển thị lộ trình phát triển.
    Có cache Redis 45 giây để đảm bảo hiệu năng tối đa.
    """
    cache_key = f"github_commits:{repo}:{branch}:{per_page}"

    if not refresh and redis_client:
        try:
            cached_data = await redis_client.get(cache_key)
            if cached_data:
                parsed = json.loads(cached_data)
                parsed["cached"] = True
                return parsed
        except Exception as e:
            logger.warning(f"Redis get failed: {e}")

    headers = {
        "User-Agent": "CSKH-IT-Roadmap-Service",
        "Accept": "application/vnd.github.v3+json"
    }
    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"token {settings.GITHUB_TOKEN}"

    url = f"https://api.github.com/repos/{repo}/commits"
    params = {"sha": branch, "per_page": per_page}

    commits_list = []
    synced_at = datetime.now(timezone.utc).isoformat()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code == 200:
                raw_commits = resp.json()
                for c in raw_commits:
                    sha = c.get("sha", "")
                    commit_data = c.get("commit", {})
                    author_data = c.get("author") or {}
                    raw_msg = commit_data.get("message", "")
                    parsed = parse_commit_type(raw_msg)

                    commits_list.append({
                        "sha": sha,
                        "short_sha": sha[:7] if sha else "",
                        "title": parsed["title"],
                        "full_message": raw_msg,
                        "type": parsed["type"],
                        "scope": parsed["scope"],
                        "author_name": commit_data.get("author", {}).get("name", "Unknown"),
                        "author_email": commit_data.get("author", {}).get("email", ""),
                        "author_avatar": author_data.get("avatar_url"),
                        "date": commit_data.get("author", {}).get("date"),
                        "html_url": c.get("html_url") or f"https://github.com/{repo}/commit/{sha}"
                    })
            else:
                logger.error(f"GitHub API returned {resp.status_code}: {resp.text}")
                if repo == "azmedia2006/CSKH-IT":
                    commits_list = get_local_git_commits(per_page)
    except Exception as e:
        logger.error(f"Failed to fetch from GitHub API: {e}")
        if repo == "azmedia2006/CSKH-IT":
            commits_list = get_local_git_commits(per_page)

    result = {
        "repo": repo,
        "branch": branch,
        "total": len(commits_list),
        "synced_at": synced_at,
        "cached": False,
        "commits": commits_list
    }

    if redis_client and commits_list:
        try:
            await redis_client.setex(cache_key, 45, json.dumps(result))
        except Exception as e:
            logger.warning(f"Redis setex failed: {e}")

    return result


@router.get("/repos")
async def get_available_repos():
    """Danh sách các repo có thể xem commits & lộ trình."""
    return {
        "default": "azmedia2006/CSKH-IT",
        "repos": [
            {
                "id": "azmedia2006/CSKH-IT",
                "name": "Hệ Thống Hỗ Trợ Khách Hàng CSKH-IT",
                "default_branch": "main",
                "description": "Kho mã nguồn chính của hệ thống Service Desk & AI Chatbot CSKH",
                "url": "https://github.com/azmedia2006/CSKH-IT"
            }
        ]
    }
