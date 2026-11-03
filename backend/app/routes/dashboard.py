from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
from app import db
from app.models.models import Reminder, ReminderStatus, MessageLog, format_iso_utc
from app.utils.helpers import success_response

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    user_id = int(get_jwt_identity())

    total = Reminder.query.filter_by(user_id=user_id).count()
    pending = Reminder.query.filter_by(user_id=user_id, status=ReminderStatus.PENDING).count()
    scheduled = Reminder.query.filter_by(user_id=user_id, status=ReminderStatus.SCHEDULED).count()
    sent = Reminder.query.filter_by(user_id=user_id, status=ReminderStatus.SENT).count()
    failed = Reminder.query.filter_by(user_id=user_id, status=ReminderStatus.FAILED).count()
    cancelled = Reminder.query.filter_by(user_id=user_id, status=ReminderStatus.CANCELLED).count()

    now = datetime.now(timezone.utc)
    next_24h = now + timedelta(hours=24)
    upcoming = Reminder.query.filter(
        Reminder.user_id == user_id,
        Reminder.status.in_([ReminderStatus.PENDING, ReminderStatus.SCHEDULED]),
        Reminder.scheduled_at >= now,
        Reminder.scheduled_at <= next_24h
    ).count()

    stats = {
        'total': total,
        'pending': pending + scheduled,
        'sent': sent,
        'failed': failed,
        'cancelled': cancelled,
        'upcoming_24h': upcoming,
    }
    return jsonify(success_response(stats)[0]), 200


@dashboard_bp.route('/recent-activity', methods=['GET'])
@jwt_required()
def get_recent_activity():
    user_id = int(get_jwt_identity())

    reminders = (
        Reminder.query
        .filter_by(user_id=user_id)
        .order_by(Reminder.updated_at.desc())
        .limit(10)
        .all()
    )

    activities = []
    for r in reminders:
        activities.append({
            'id': r.id,
            'recipient_name': r.recipient_name,
            'phone_number': r.phone_number,
            'message': r.message[:100] + ('...' if len(r.message) > 100 else ''),
            'scheduled_at': format_iso_utc(r.scheduled_at),
            'status': r.status.value if r.status else None,
            'updated_at': format_iso_utc(r.updated_at),
        })

    return jsonify(success_response(activities)[0]), 200


@dashboard_bp.route('/upcoming', methods=['GET'])
@jwt_required()
def get_upcoming():
    user_id = int(get_jwt_identity())
    now = datetime.now(timezone.utc)

    upcoming = (
        Reminder.query
        .filter(
            Reminder.user_id == user_id,
            Reminder.status.in_([ReminderStatus.PENDING, ReminderStatus.SCHEDULED]),
            Reminder.scheduled_at >= now
        )
        .order_by(Reminder.scheduled_at.asc())
        .limit(5)
        .all()
    )

    return jsonify(success_response([r.to_dict() for r in upcoming])[0]), 200

