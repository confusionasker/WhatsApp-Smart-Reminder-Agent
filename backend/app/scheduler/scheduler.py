import logging
import json
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED
import pytz
from app.services.whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)


class ReminderScheduler:
    """APScheduler-based reminder scheduling service."""

    def __init__(self):
        self.scheduler = None
        self.app = None

    def init_app(self, app):
        self.app = app
        jobstores = {'default': MemoryJobStore()}
        executors = {'default': ThreadPoolExecutor(max_workers=10)}
        job_defaults = {'coalesce': True, 'max_instances': 1, 'misfire_grace_time': 300}

        self.scheduler = BackgroundScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone=pytz.utc
        )
        self.scheduler.add_listener(self._job_listener, EVENT_JOB_ERROR | EVENT_JOB_EXECUTED)
        self.scheduler.start()
        logger.info("APScheduler started successfully")

        # Restore pending reminders on startup
        with app.app_context():
            self._restore_pending_reminders()

    def _job_listener(self, event):
        if event.exception:
            logger.error(f"Scheduler job {event.job_id} failed: {event.exception}")
        else:
            logger.info(f"Scheduler job {event.job_id} completed successfully")

    def _restore_pending_reminders(self):
        """Load pending/scheduled reminders from DB and re-register them."""
        try:
            from app.models.models import Reminder, ReminderStatus
            from app import db

            now = datetime.now(timezone.utc)
            pending = Reminder.query.filter(
                Reminder.status.in_([ReminderStatus.PENDING, ReminderStatus.SCHEDULED]),
                Reminder.scheduled_at > now
            ).all()

            count = 0
            for reminder in pending:
                self.schedule_reminder(reminder.id, reminder.scheduled_at)
                count += 1

            logger.info(f"Restored {count} pending reminders from database")
        except Exception as e:
            logger.error(f"Error restoring pending reminders: {e}")

    def schedule_reminder(self, reminder_id: int, scheduled_at: datetime) -> str:
        """Schedule a reminder job. Returns the job_id."""
        job_id = f"reminder_{reminder_id}"

        # Ensure scheduled_at is timezone-aware UTC
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
        else:
            scheduled_at = scheduled_at.astimezone(timezone.utc)

        now = datetime.now(timezone.utc)
        if scheduled_at <= now:
            logger.warning(f"Attempted to schedule reminder {reminder_id} in the past: {scheduled_at}")
            return None

        # Remove existing job if any (prevent duplicates)
        self._remove_job_if_exists(job_id)

        self.scheduler.add_job(
            func=self._execute_reminder,
            trigger='date',
            run_date=scheduled_at,
            id=job_id,
            args=[reminder_id],
            replace_existing=True,
            misfire_grace_time=300
        )
        logger.info(f"Scheduled reminder {reminder_id} for {scheduled_at}")
        return job_id

    def cancel_reminder(self, reminder_id: int) -> bool:
        """Cancel a scheduled reminder job."""
        job_id = f"reminder_{reminder_id}"
        return self._remove_job_if_exists(job_id)

    def _remove_job_if_exists(self, job_id: str) -> bool:
        """Remove a job if it exists. Returns True if removed."""
        try:
            job = self.scheduler.get_job(job_id)
            if job:
                self.scheduler.remove_job(job_id)
                return True
        except Exception as e:
            logger.error(f"Error removing job {job_id}: {e}")
        return False

    def _execute_reminder(self, reminder_id: int):
        """Execute a reminder: send WhatsApp message and update DB."""
        if not self.app:
            logger.error("No Flask app context available")
            return

        with self.app.app_context():
            self._process_reminder(reminder_id)

    def _process_reminder(self, reminder_id: int):
        from app.models.models import Reminder, ReminderStatus, MessageLog, DeliveryStatus
        from app import db

        # Atomic status check and update to PROCESSING
        reminder = db.session.execute(
            db.select(Reminder).filter_by(id=reminder_id).with_for_update()
        ).scalar_one_or_none()

        if not reminder:
            logger.error(f"Reminder {reminder_id} not found")
            return

        if reminder.status not in [ReminderStatus.PENDING, ReminderStatus.SCHEDULED]:
            logger.info(f"Reminder {reminder_id} is in status {reminder.status}, skipping")
            return

        # Mark as PROCESSING atomically
        reminder.status = ReminderStatus.PROCESSING
        reminder.updated_at = datetime.now(timezone.utc)
        db.session.commit()

        logger.info(f"Processing reminder {reminder_id} to {reminder.phone_number}")

        # Send WhatsApp message
        result = whatsapp_service.send_text_message(reminder.phone_number, reminder.message)

        now = datetime.now(timezone.utc)
        log = MessageLog(
            reminder_id=reminder_id,
            whatsapp_message_id=result.get('message_id'),
            api_response=result.get('api_response'),
            error_message=result.get('error'),
            sent_at=now if result['success'] else None,
            delivery_status=DeliveryStatus.ACCEPTED if result['success'] else DeliveryStatus.FAILED
        )
        db.session.add(log)

        if result['success']:
            reminder.status = ReminderStatus.SENT
            logger.info(f"Reminder {reminder_id} sent successfully, message_id: {result.get('message_id')}")
        else:
            reminder.retry_count += 1
            if reminder.retry_count < reminder.max_retries:
                # Schedule retry with exponential backoff
                from datetime import timedelta
                retry_delay = timedelta(minutes=2 ** reminder.retry_count)
                retry_time = now + retry_delay
                reminder.status = ReminderStatus.SCHEDULED
                self.schedule_reminder(reminder_id, retry_time)
                logger.warning(f"Reminder {reminder_id} failed, retry {reminder.retry_count}/{reminder.max_retries} at {retry_time}")
            else:
                reminder.status = ReminderStatus.FAILED
                logger.error(f"Reminder {reminder_id} failed after {reminder.retry_count} retries")

        reminder.updated_at = now
        db.session.commit()

    def get_scheduled_jobs(self) -> list:
        """Return list of currently scheduled jobs."""
        if not self.scheduler:
            return []
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                'id': job.id,
                'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
            })
        return jobs

    def shutdown(self):
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("Scheduler shut down")


reminder_scheduler = ReminderScheduler()
