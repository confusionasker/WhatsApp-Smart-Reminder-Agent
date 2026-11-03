from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from datetime import datetime, timezone
from app import db
from app.models.models import Reminder, ReminderStatus, Contact
from app.utils.helpers import (
    success_response, error_response, validate_phone_number,
    parse_scheduled_datetime, paginate_query, get_available_timezones
)
from app.scheduler.scheduler import reminder_scheduler

reminders_bp = Blueprint('reminders', __name__)


class CreateReminderSchema(Schema):
    recipient_name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    phone_number = fields.Str(required=True)
    message = fields.Str(required=True, validate=validate.Length(min=1, max=4096))
    scheduled_date = fields.Str(required=True)
    scheduled_time = fields.Str(required=True)
    timezone = fields.Str(load_default='UTC')
    contact_id = fields.Int(load_default=None)


class UpdateReminderSchema(Schema):
    recipient_name = fields.Str(validate=validate.Length(min=1, max=100))
    phone_number = fields.Str()
    message = fields.Str(validate=validate.Length(min=1, max=4096))
    scheduled_date = fields.Str()
    scheduled_time = fields.Str()
    timezone = fields.Str()


@reminders_bp.route('', methods=['POST'])
@jwt_required()
def create_reminder():
    user_id = int(get_jwt_identity())
    schema = CreateReminderSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify(error_response('Validation failed', 422, e.messages)[0]), 422

    # Validate phone number
    is_valid, normalized_phone = validate_phone_number(data['phone_number'])
    if not is_valid:
        return jsonify(error_response(normalized_phone, 400)[0]), 400

    # Parse scheduled datetime
    utc_dt, err = parse_scheduled_datetime(
        data['scheduled_date'], data['scheduled_time'], data['timezone']
    )
    if err:
        return jsonify(error_response(err, 400)[0]), 400

    now = datetime.now(timezone.utc)
    if utc_dt <= now:
        return jsonify(error_response('Scheduled time must be in the future', 400)[0]), 400

    # Validate contact_id belongs to user if provided
    contact_id = data.get('contact_id')
    if contact_id:
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            contact_id = None

    reminder = Reminder(
        user_id=user_id,
        contact_id=contact_id,
        recipient_name=data['recipient_name'].strip(),
        phone_number=normalized_phone,
        message=data['message'].strip(),
        scheduled_at=utc_dt,
        timezone=data['timezone'],
        status=ReminderStatus.PENDING,
    )
    db.session.add(reminder)
    db.session.flush()  # Get the id before commit

    # Schedule the job
    job_id = reminder_scheduler.schedule_reminder(reminder.id, utc_dt)
    if job_id:
        reminder.job_id = job_id
        reminder.status = ReminderStatus.SCHEDULED

    db.session.commit()
    return jsonify(success_response(reminder.to_dict(), 'Reminder created', 201)[0]), 201


@reminders_bp.route('', methods=['GET'])
@jwt_required()
def get_reminders():
    user_id = int(get_jwt_identity())
    status_filter = request.args.get('status', '').upper()
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 20)), 100)
    search = request.args.get('search', '').strip()

    query = Reminder.query.filter_by(user_id=user_id)

    if status_filter and status_filter in [s.value for s in ReminderStatus]:
        query = query.filter(Reminder.status == ReminderStatus[status_filter])

    if search:
        query = query.filter(
            db.or_(
                Reminder.recipient_name.ilike(f'%{search}%'),
                Reminder.phone_number.ilike(f'%{search}%'),
                Reminder.message.ilike(f'%{search}%')
            )
        )

    query = query.order_by(Reminder.scheduled_at.desc())
    result = paginate_query(query, page, per_page)
    return jsonify(success_response(result)[0]), 200


@reminders_bp.route('/timezones', methods=['GET'])
@jwt_required()
def get_timezones():
    return jsonify(success_response(get_available_timezones())[0]), 200


@reminders_bp.route('/<int:reminder_id>', methods=['GET'])
@jwt_required()
def get_reminder(reminder_id):
    user_id = int(get_jwt_identity())
    reminder = Reminder.query.filter_by(id=reminder_id, user_id=user_id).first_or_404()
    data = reminder.to_dict()
    data['logs'] = [log.to_dict() for log in reminder.message_logs.order_by('-created_at').limit(10)]
    return jsonify(success_response(data)[0]), 200


@reminders_bp.route('/<int:reminder_id>', methods=['PUT'])
@jwt_required()
def update_reminder(reminder_id):
    user_id = int(get_jwt_identity())
    reminder = Reminder.query.filter_by(id=reminder_id, user_id=user_id).first_or_404()

    if reminder.status not in [ReminderStatus.PENDING, ReminderStatus.SCHEDULED]:
        return jsonify(error_response(f'Cannot edit reminder with status {reminder.status.value}', 400)[0]), 400

    schema = UpdateReminderSchema()
    try:
        data = schema.load(request.get_json() or {}, partial=True)
    except ValidationError as e:
        return jsonify(error_response('Validation failed', 422, e.messages)[0]), 422

    if 'phone_number' in data:
        is_valid, normalized = validate_phone_number(data['phone_number'])
        if not is_valid:
            return jsonify(error_response(normalized, 400)[0]), 400
        reminder.phone_number = normalized

    if 'recipient_name' in data:
        reminder.recipient_name = data['recipient_name'].strip()
    if 'message' in data:
        reminder.message = data['message'].strip()

    # Re-schedule if time/date changed
    if 'scheduled_date' in data or 'scheduled_time' in data or 'timezone' in data:
        date_str = data.get('scheduled_date', reminder.scheduled_at.strftime('%Y-%m-%d'))
        time_str = data.get('scheduled_time', reminder.scheduled_at.strftime('%H:%M'))
        tz_name = data.get('timezone', reminder.timezone)

        utc_dt, err = parse_scheduled_datetime(date_str, time_str, tz_name)
        if err:
            return jsonify(error_response(err, 400)[0]), 400
        if utc_dt <= datetime.now(timezone.utc):
            return jsonify(error_response('Scheduled time must be in the future', 400)[0]), 400

        # Cancel old job and reschedule
        reminder_scheduler.cancel_reminder(reminder.id)
        job_id = reminder_scheduler.schedule_reminder(reminder.id, utc_dt)
        reminder.scheduled_at = utc_dt
        reminder.timezone = tz_name
        if job_id:
            reminder.job_id = job_id
            reminder.status = ReminderStatus.SCHEDULED

    reminder.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(success_response(reminder.to_dict(), 'Reminder updated')[0]), 200


@reminders_bp.route('/<int:reminder_id>', methods=['DELETE'])
@jwt_required()
def delete_reminder(reminder_id):
    user_id = int(get_jwt_identity())
    reminder = Reminder.query.filter_by(id=reminder_id, user_id=user_id).first_or_404()
    reminder_scheduler.cancel_reminder(reminder.id)
    db.session.delete(reminder)
    db.session.commit()
    return jsonify(success_response(None, 'Reminder deleted')[0]), 200


@reminders_bp.route('/<int:reminder_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_reminder(reminder_id):
    user_id = int(get_jwt_identity())
    reminder = Reminder.query.filter_by(id=reminder_id, user_id=user_id).first_or_404()

    if reminder.status not in [ReminderStatus.PENDING, ReminderStatus.SCHEDULED]:
        return jsonify(error_response(f'Cannot cancel reminder with status {reminder.status.value}', 400)[0]), 400

    reminder_scheduler.cancel_reminder(reminder.id)
    reminder.status = ReminderStatus.CANCELLED
    reminder.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(success_response(reminder.to_dict(), 'Reminder cancelled')[0]), 200


@reminders_bp.route('/<int:reminder_id>/retry', methods=['POST'])
@jwt_required()
def retry_reminder(reminder_id):
    user_id = int(get_jwt_identity())
    reminder = Reminder.query.filter_by(id=reminder_id, user_id=user_id).first_or_404()

    if reminder.status != ReminderStatus.FAILED:
        return jsonify(error_response('Only FAILED reminders can be retried', 400)[0]), 400

    # Get new scheduled time from request or use original
    data = request.get_json() or {}
    if 'scheduled_date' in data and 'scheduled_time' in data:
        utc_dt, err = parse_scheduled_datetime(
            data['scheduled_date'], data['scheduled_time'],
            data.get('timezone', reminder.timezone)
        )
        if err:
            return jsonify(error_response(err, 400)[0]), 400
        if utc_dt <= datetime.now(timezone.utc):
            return jsonify(error_response('Retry time must be in the future', 400)[0]), 400
        reminder.scheduled_at = utc_dt

    # Reset retry count and reschedule
    reminder.retry_count = 0
    reminder.status = ReminderStatus.PENDING
    reminder.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    job_id = reminder_scheduler.schedule_reminder(reminder.id, reminder.scheduled_at)
    if job_id:
        reminder.job_id = job_id
        reminder.status = ReminderStatus.SCHEDULED
        db.session.commit()

    return jsonify(success_response(reminder.to_dict(), 'Reminder scheduled for retry')[0]), 200

