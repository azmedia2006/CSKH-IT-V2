import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from email.utils import formataddr, make_msgid, formatdate
import asyncio
import logging
from html import escape
from app.config import settings

logger = logging.getLogger(__name__)


async def send_ticket_notification_email(
    to_email: str,
    subject: str,
    heading: str,
    ticket_code: str,
    ticket_title: str,
    ticket_url: str,
) -> bool:
    """Send a discreet ticket alert; ticket messages are intentionally never emailed."""
    safe_heading = escape(heading)
    safe_code = escape(ticket_code)
    safe_title = escape(ticket_title)
    safe_url = escape(ticket_url, quote=True)
    html_content = f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thông báo yêu cầu hỗ trợ</title></head>
<body style="margin:0;background:#f3f5fb;padding:32px 14px;font-family:Arial,Helvetica,sans-serif;color:#172033">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Yêu cầu hỗ trợ của bạn vừa có cập nhật mới.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e9f2;border-radius:16px;overflow:hidden">
    <tr><td style="padding:22px 30px;background:#202b63;color:#fff">
      <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#c7d2fe">IT Service Desk</div>
      <div style="font-size:20px;font-weight:700;margin-top:7px">Thông báo yêu cầu hỗ trợ</div>
    </td></tr>
    <tr><td style="padding:30px">
      <div style="display:inline-block;padding:6px 10px;border-radius:20px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:700">CÓ CẬP NHẬT</div>
      <h1 style="font-size:22px;line-height:1.35;margin:16px 0 8px;color:#172033">{safe_heading}</h1>
      <p style="font-size:14px;line-height:1.7;color:#596579;margin:0 0 22px">Yêu cầu hỗ trợ của bạn đã có hoạt động mới. Để bảo vệ thông tin, nội dung trao đổi chỉ xem được sau khi đăng nhập vào hệ thống.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f9fc;border:1px solid #e8ebf3;border-radius:10px">
        <tr><td style="padding:14px 16px 5px;color:#778197;font-size:12px">MÃ YÊU CẦU</td></tr>
        <tr><td style="padding:0 16px 13px;color:#202b63;font-size:15px;font-weight:700">{safe_code}</td></tr>
        <tr><td style="padding:0 16px 5px;color:#778197;font-size:12px">TIÊU ĐỀ</td></tr>
        <tr><td style="padding:0 16px 15px;color:#273247;font-size:14px;line-height:1.5">{safe_title}</td></tr>
      </table>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 18px"><tr><td style="border-radius:9px;background:#4f46e5">
        <a href="{safe_url}" style="display:inline-block;padding:13px 22px;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Đăng nhập để xem yêu cầu</a>
      </td></tr></table>
      <p style="font-size:12px;line-height:1.6;color:#7b8496;margin:0">Nếu nút không hoạt động, hãy mở hệ thống IT Service Desk và tìm yêu cầu theo mã ở trên.</p>
    </td></tr>
    <tr><td style="padding:17px 30px;background:#f8f9fc;border-top:1px solid #e8ebf3;color:#8992a3;font-size:11px;line-height:1.6">Email tự động từ IT Service Desk. Vui lòng không trả lời thư này.</td></tr>
  </table>
</body></html>"""
    text_content = (
        f"{heading}\n\nMã yêu cầu: {ticket_code}\nTiêu đề: {ticket_title}\n\n"
        "Yêu cầu có hoạt động mới. Để bảo vệ thông tin, nội dung trao đổi chỉ xem được sau khi đăng nhập vào hệ thống.\n\n"
        f"Đăng nhập để xem yêu cầu: {ticket_url}\n\nIT Service Desk"
    )
    return await asyncio.to_thread(
        _send_email_sync, to_email, subject, html_content, text_content
    )

def _send_email_sync(to_email: str, subject: str, html_content: str, text_content: str | None = None) -> bool:
    """Synchronous SMTP email sender with full RFC 2822 standard headers"""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP is not configured. Skipping email dispatch.")
        return False

    sender_email = settings.SMTP_FROM_EMAIL.strip() if (settings.SMTP_FROM_EMAIL and "@" in settings.SMTP_FROM_EMAIL) else settings.SMTP_USER.strip()
    sender_name = settings.SMTP_FROM_NAME or "IT Service Desk"
    sender_domain = sender_email.split("@")[-1] if "@" in sender_email else None

    msg = MIMEMultipart("alternative")
    
    # 1. Standard RFC 2822 & MIME Headers
    msg["MIME-Version"] = "1.0"
    msg["From"] = f'"{sender_name}" <{sender_email}>'
    msg["To"] = to_email
    msg["Subject"] = Header(subject, "utf-8").encode()
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=sender_domain)
    msg["Reply-To"] = sender_email
    msg["X-Priority"] = "3"
    msg["X-MSMail-Priority"] = "Normal"
    msg["Importance"] = "Normal"
    msg["Auto-Submitted"] = "auto-generated"
    msg["X-Mailer"] = "ITServiceDesk Mailer v1.0"

    # 2. Attach Plain Text first, then HTML (RFC Standard for Alternative)
    if text_content:
        part_text = MIMEText(text_content, "plain", "utf-8")
        msg.attach(part_text)
        
    part_html = MIMEText(html_content, "html", "utf-8")
    msg.attach(part_html)

    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(sender_email, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(sender_email, [to_email], msg.as_string())
        
        logger.info(f"Email successfully sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False

async def send_otp_email(to_email: str, otp_code: str, user_name: str | None = None) -> bool:
    """Send OTP code with classic, modern and icon-free email template"""
    recipient_name = user_name or to_email.split('@')[0]
    subject = "IT Service Desk - Mã xác nhận bảo mật tài khoản"

    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Mã xác nhận tài khoản</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
        .container {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        .header {{ background-color: #4f46e5; padding: 24px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }}
        .header p {{ margin: 4px 0 0 0; font-size: 12px; color: #e0e7ff; }}
        .content {{ padding: 32px 24px; }}
        .greeting {{ font-size: 15px; margin-bottom: 16px; color: #1e293b; }}
        .otp-box {{ background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 8px; text-align: center; padding: 18px; margin: 24px 0; }}
        .otp-label {{ font-size: 11px; text-transform: uppercase; color: #4f46e5; font-weight: 700; letter-spacing: 1px; margin-bottom: 6px; }}
        .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4338ca; font-family: Consolas, Monaco, monospace; }}
        .otp-exp {{ font-size: 12px; color: #64748b; margin-top: 6px; font-weight: 500; }}
        .note {{ font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 16px; }}
        .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>IT Service Desk</h1>
            <p>Hệ thống Quản lý & Hỗ trợ Kỹ thuật</p>
        </div>
        <div class="content">
            <div class="greeting">Xin chào <strong>{recipient_name}</strong>,</div>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
                Chúng tôi đã nhận được yêu cầu xác thực tài khoản của bạn trên hệ thống IT Service Desk. Dưới đây là mã xác nhận (OTP) để tiếp tục:
            </p>
            <div class="otp-box">
                <div class="otp-label">MÃ XÁC THỰC BẢO MẬT</div>
                <div class="otp-code">{otp_code}</div>
                <div class="otp-exp">Mã có hiệu lực trong vòng 15 phút</div>
            </div>
            <div class="note">
                Lưu ý: Không chia sẻ mã này cho bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, bạn có thể an tâm bỏ qua email.
            </div>
        </div>
        <div class="footer">
            IT Service Desk System • Thông báo tự động từ hệ thống
        </div>
    </div>
</body>
</html>"""

    text_content = f"""Xin chào {recipient_name},

Mã xác thực OTP hệ thống IT Service Desk của bạn là: {otp_code}

Mã có hiệu lực trong vòng 15 phút.
Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua thư.

Trân trọng,
IT Service Desk
"""

    return await asyncio.to_thread(_send_email_sync, to_email, subject, html_content, text_content)

def _parse_device_info(user_agent: str) -> str:
    """Helper to convert raw user agent string to human-friendly device text"""
    if not user_agent:
        return "Trình duyệt web"
    
    os_name = "Thiết bị khác"
    if "Windows" in user_agent:
        os_name = "Windows"
    elif "Macintosh" in user_agent or "Mac OS" in user_agent:
        os_name = "macOS"
    elif "Android" in user_agent:
        os_name = "Android"
    elif "iPhone" in user_agent or "iPad" in user_agent:
        os_name = "iOS (Apple)"
    elif "Linux" in user_agent:
        os_name = "Linux"

    browser_name = "Trình duyệt"
    if "Edg/" in user_agent:
        browser_name = "Microsoft Edge"
    elif "Chrome/" in user_agent and "Edg/" not in user_agent:
        browser_name = "Google Chrome"
    elif "Firefox/" in user_agent:
        browser_name = "Mozilla Firefox"
    elif "Safari/" in user_agent and "Chrome/" not in user_agent:
        browser_name = "Apple Safari"
        
    return f"{browser_name} ({os_name})"

async def send_login_alert_email(
    to_email: str, 
    user_name: str | None = None,
    ip_address: str = "127.0.0.1",
    user_agent: str = "Trình duyệt web",
    login_time: str | None = None
) -> bool:
    """Send security login alert email with clean, colorful and icon-free design"""
    from datetime import datetime, timezone, timedelta
    
    recipient_name = user_name or to_email.split('@')[0]
    subject = "IT Service Desk - Thông báo đăng nhập mới"
    
    if not login_time:
        vn_time = datetime.now(timezone(timedelta(hours=7)))
        login_time = vn_time.strftime("%d/%m/%Y lúc %H:%M")
        
    device_info = _parse_device_info(user_agent)

    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Thông báo đăng nhập</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
        .container {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        .header {{ background-color: #4f46e5; padding: 24px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }}
        .header p {{ margin: 4px 0 0 0; font-size: 12px; color: #e0e7ff; }}
        .content {{ padding: 32px 24px; }}
        .greeting {{ font-size: 15px; margin-bottom: 16px; color: #1e293b; }}
        .details-table {{ width: 100%; border-collapse: collapse; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0; overflow: hidden; }}
        .details-table td {{ padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }}
        .details-table tr:last-child td {{ border-bottom: none; }}
        .label {{ color: #64748b; font-weight: 600; width: 35%; }}
        .value {{ color: #0f172a; font-weight: 600; }}
        .note {{ font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 16px; }}
        .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>IT Service Desk</h1>
            <p>Thông Báo Bảo Mật Tài Khoản</p>
        </div>
        <div class="content">
            <div class="greeting">Xin chào <strong>{recipient_name}</strong>,</div>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0;">
                Hệ thống vừa ghi nhận một lượt đăng nhập thành công vào tài khoản của bạn với thông tin chi tiết:
            </p>
            <table class="details-table">
                <tr>
                    <td class="label">Thiết bị</td>
                    <td class="value">{device_info}</td>
                </tr>
                <tr>
                    <td class="label">Thời gian</td>
                    <td class="value">{login_time}</td>
                </tr>
                <tr>
                    <td class="label">Địa chỉ IP</td>
                    <td class="value" style="font-family: Consolas, monospace;">{ip_address}</td>
                </tr>
            </table>
            <div class="note">
                • Nếu đây là bạn, bạn không cần thực hiện thêm thao tác nào.<br/>
                • Nếu không phải bạn, vui lòng sử dụng tính năng "Quên mật khẩu" trên trang đăng nhập để đổi mật khẩu ngay lập tức.
            </div>
        </div>
        <div class="footer">
            IT Service Desk System • Thông báo tự động từ hệ thống
        </div>
    </div>
</body>
</html>"""

    text_content = f"""Xin chào {recipient_name},

Tài khoản IT Service Desk của bạn vừa có lượt đăng nhập mới:
- Thiết bị: {device_info}
- Thời gian: {login_time}
- Địa chỉ IP: {ip_address}

Nếu đây là bạn, bạn không cần thực hiện thao tác nào.
Nếu không phải bạn, vui lòng đổi mật khẩu ngay để bảo vệ tài khoản.

Trân trọng,
IT Service Desk
"""

    return await asyncio.to_thread(_send_email_sync, to_email, subject, html_content, text_content)
