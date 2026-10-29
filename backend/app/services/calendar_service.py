"""
Calendar (.ics) Service for WorkSphere HRMS
Module 25: Third-Party Integrations
"""

from datetime import date, datetime, timezone
import re
from typing import Any, Dict, List


def _format_datetime_utc(dt: Any) -> str:
    """Formats a datetime or date object for iCalendar standard."""
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            # Assume UTC
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y%m%dT%H%M%SZ")
    elif isinstance(dt, date):
        return dt.strftime("%Y%m%d")
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _clean_ics_text(text: str) -> str:
    """Escapes characters according to RFC 5545."""
    if not text:
        return ""
    text = str(text)
    text = text.replace("\\", "\\\\")
    text = text.replace(";", "\\;")
    text = text.replace(",", "\\,")
    text = text.replace("\r\n", "\\n").replace("\n", "\\n")
    return text


def generate_ics(
    calendar_name: str,
    events: List[Dict[str, Any]],
    company_name: str = "WorkSphere HRMS",
) -> str:
    """
    Generates a standard RFC 5545 iCalendar (.ics) string.
    """
    now_str = _format_datetime_utc(datetime.now(timezone.utc))

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:-//{company_name}//Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_clean_ics_text(calendar_name)}",
        "X-WR-TIMEZONE:UTC",
    ]

    for ev in events:
        uid = f"{ev.get('id', 'item')}-{ev.get('type', 'evt')}@worksphere.local"
        summary = _clean_ics_text(ev.get("title", "Event"))
        description = _clean_ics_text(ev.get("description", ""))
        location = _clean_ics_text(ev.get("location", company_name))

        start_val = ev.get("start")
        end_val = ev.get("end") or start_val
        all_day = ev.get("all_day", False)

        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{uid}")
        lines.append(f"DTSTAMP:{now_str}")

        if all_day or (isinstance(start_val, date) and not isinstance(start_val, datetime)):
            # All-day date format VALUE=DATE:YYYYMMDD
            s_date = _format_datetime_utc(start_val)[:8]
            e_date = _format_datetime_utc(end_val)[:8]
            lines.append(f"DTSTART;VALUE=DATE:{s_date}")
            lines.append(f"DTEND;VALUE=DATE:{e_date}")
        else:
            lines.append(f"DTSTART:{_format_datetime_utc(start_val)}")
            lines.append(f"DTEND:{_format_datetime_utc(end_val)}")

        lines.append(f"SUMMARY:{summary}")
        if description:
            lines.append(f"DESCRIPTION:{description}")
        if location:
            lines.append(f"LOCATION:{location}")
        lines.append("STATUS:CONFIRMED")
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"

