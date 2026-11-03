import os
import logging
from app import create_app, db
from app.scheduler.scheduler import reminder_scheduler
from app.services.whatsapp_service import whatsapp_service

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)

config_name = os.environ.get('FLASK_ENV', 'development')
app = create_app(config_name)

# Create all tables first before initializing scheduler
with app.app_context():
    db.create_all()
    logging.getLogger(__name__).info("Database tables verified/created successfully")

# Initialize services
whatsapp_service.init_app(app)
reminder_scheduler.init_app(app)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=app.config.get('DEBUG', False))

