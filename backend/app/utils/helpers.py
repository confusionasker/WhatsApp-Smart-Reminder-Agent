import re
import logging
from datetime import datetime, timezone
import pytz

logger = logging.getLogger(__name__)


def validate_phone_number(phone: str) -> tuple[bool, str]:
    """Validate and normalize phone number with smart country code detection."""
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)

    # Auto-add country code for 10-digit Indian numbers starting with 6-9
    if len(cleaned) == 10 and re.match(r'^[6-9]\d{9}$', cleaned):
        cleaned = '+91' + cleaned
    # Auto-add country code for 11-digit Bangladesh numbers starting with 01
    elif len(cleaned) == 11 and cleaned.startswith('01'):
        cleaned = '+880' + cleaned[1:]
    elif not cleaned.startswith('+'):
        cleaned = '+' + cleaned

    pattern = r'^\+[1-9]\d{7,14}$'
    if re.match(pattern, cleaned):
        return True, cleaned
    return False, f"Invalid phone number: {phone}. Please include country code (e.g. +919876543210)"


def parse_scheduled_datetime(date_str: str, time_str: str, tz_name: str) -> tuple[datetime | None, str | None]:
    """
    Parse date and time strings in a given timezone into a UTC-aware datetime.
    Returns (utc_datetime, error_message)
    """
    try:
        tz = pytz.timezone(tz_name)
    except pytz.exceptions.UnknownTimeZoneError:
        return None, f"Unknown timezone: {tz_name}"

    for date_fmt in ('%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y'):
        try:
            date_obj = datetime.strptime(date_str, date_fmt).date()
            break
        except ValueError:
            continue
    else:
        return None, f"Invalid date format: {date_str}. Use YYYY-MM-DD."

    for time_fmt in ('%H:%M', '%H:%M:%S', '%I:%M %p', '%I:%M%p'):
        try:
            time_obj = datetime.strptime(time_str, time_fmt).time()
            break
        except ValueError:
            continue
    else:
        return None, f"Invalid time format: {time_str}. Use HH:MM or HH:MM AM/PM."

    local_dt = tz.localize(datetime.combine(date_obj, time_obj))
    utc_dt = local_dt.astimezone(timezone.utc)
    return utc_dt, None


def get_available_timezones() -> list[str]:
    """Return list of common timezones."""
    common = [
        'UTC', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles',
        'America/Chicago', 'America/Toronto', 'Europe/London', 'Europe/Paris',
        'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Dubai',
        'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland',
        'America/Sao_Paulo', 'Africa/Johannesburg',
    ]
    return common


def success_response(data=None, message='Success', status_code=200):
    response = {'success': True, 'message': message}
    if data is not None:
        response['data'] = data
    return response, status_code


def error_response(message='An error occurred', status_code=400, errors=None):
    response = {'success': False, 'message': message}
    if errors:
        response['errors'] = errors
    return response, status_code


def paginate_query(query, page: int, per_page: int) -> dict:
    """Paginate a SQLAlchemy query and return pagination metadata."""
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        'items': [item.to_dict() for item in paginated.items],
        'pagination': {
            'page': paginated.page,
            'per_page': paginated.per_page,
            'total': paginated.total,
            'pages': paginated.pages,
            'has_next': paginated.has_next,
            'has_prev': paginated.has_prev,
        }
    }

