from datetime import datetime, timezone
from enum import Enum as PyEnum
import bcrypt
from app import db


def format_iso_utc(dt):
    """Format datetime as timezone-aware ISO string ending in Z."""
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    contacts = db.relationship('Contact', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    reminders = db.relationship('Reminder', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password: str):
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'created_at': format_iso_utc(self.created_at),
        }

    def __repr__(self):
        return f'<User {self.email}>'


class Contact(db.Model):
    __tablename__ = 'contacts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    contact_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    reminders = db.relationship('Reminder', backref='contact', lazy='dynamic')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'phone_number', name='uq_user_phone'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'contact_name': self.contact_name,
            'phone_number': self.phone_number,
            'created_at': format_iso_utc(self.created_at),
        }

    def __repr__(self):
        return f'<Contact {self.contact_name} ({self.phone_number})>'


class ReminderStatus(PyEnum):
    PENDING = 'PENDING'
    SCHEDULED = 'SCHEDULED'
    PROCESSING = 'PROCESSING'
    SENT = 'SENT'
    FAILED = 'FAILED'
    CANCELLED = 'CANCELLED'


class Reminder(db.Model):
    __tablename__ = 'reminders'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    contact_id = db.Column(db.Integer, db.ForeignKey('contacts.id', ondelete='SET NULL'), nullable=True, index=True)

    recipient_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    message = db.Column(db.Text, nullable=False)
    scheduled_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    timezone = db.Column(db.String(50), nullable=False, default='UTC')
    status = db.Column(db.Enum(ReminderStatus), nullable=False, default=ReminderStatus.PENDING, index=True)
    retry_count = db.Column(db.Integer, nullable=False, default=0)
    max_retries = db.Column(db.Integer, nullable=False, default=3)
    job_id = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    message_logs = db.relationship('MessageLog', backref='reminder', lazy='dynamic', cascade='all, delete-orphan')

    __table_args__ = (
        db.Index('idx_reminder_scheduled_status', 'scheduled_at', 'status'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'contact_id': self.contact_id,
            'recipient_name': self.recipient_name,
            'phone_number': self.phone_number,
            'message': self.message,
            'scheduled_at': format_iso_utc(self.scheduled_at),
            'timezone': self.timezone,
            'status': self.status.value if self.status else None,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'job_id': self.job_id,
            'created_at': format_iso_utc(self.created_at),
            'updated_at': format_iso_utc(self.updated_at),
        }

    def __repr__(self):
        return f'<Reminder {self.id} to {self.phone_number} at {self.scheduled_at}>'


class DeliveryStatus(PyEnum):
    ACCEPTED = 'ACCEPTED'
    SENT = 'SENT'
    DELIVERED = 'DELIVERED'
    READ = 'READ'
    FAILED = 'FAILED'


class MessageLog(db.Model):
    __tablename__ = 'message_logs'

    id = db.Column(db.Integer, primary_key=True)
    reminder_id = db.Column(db.Integer, db.ForeignKey('reminders.id', ondelete='CASCADE'), nullable=False, index=True)
    whatsapp_message_id = db.Column(db.String(200), nullable=True, index=True)
    api_response = db.Column(db.Text, nullable=True)
    delivery_status = db.Column(db.Enum(DeliveryStatus), nullable=True, default=DeliveryStatus.ACCEPTED)
    error_message = db.Column(db.Text, nullable=True)
    sent_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'reminder_id': self.reminder_id,
            'whatsapp_message_id': self.whatsapp_message_id,
            'api_response': self.api_response,
            'delivery_status': self.delivery_status.value if self.delivery_status else None,
            'error_message': self.error_message,
            'sent_at': format_iso_utc(self.sent_at),
            'created_at': format_iso_utc(self.created_at),
        }

    def __repr__(self):
        return f'<MessageLog {self.id} for Reminder {self.reminder_id}>'

