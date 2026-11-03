from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate
import os

from app.config.settings import config

db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()


def _ensure_database_exists(app):
    """Auto-create MySQL database if it does not exist yet."""
    db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if 'mysql' in db_uri:
        try:
            import pymysql
            host = app.config.get('MYSQL_HOST', 'localhost')
            port = int(app.config.get('MYSQL_PORT', 3306))
            user = app.config.get('MYSQL_USER', 'root')
            password = app.config.get('MYSQL_PASSWORD', '')
            database = app.config.get('MYSQL_DATABASE', 'whatsapp_reminder')

            conn = pymysql.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                charset='utf8mb4'
            )
            with conn.cursor() as cursor:
                cursor.execute(
                    f"CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
                )
            conn.commit()
            conn.close()
            app.logger.info(f"Database '{database}' verified/created in MySQL")
        except Exception as e:
            app.logger.warning(f"Could not auto-create MySQL database '{database}': {e}")


def create_app(config_name='development'):
    app = Flask(__name__)
    cfg = config[config_name]
    app.config.from_object(cfg)

    # Automatically create MySQL database if it doesn't exist
    _ensure_database_exists(app)

    # Override pool options for SQLite (testing)
    if 'sqlite' in app.config.get('SQLALCHEMY_DATABASE_URI', ''):
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {}

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)

    # CORS
    CORS(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}}, supports_credentials=True)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.contacts import contacts_bp
    from app.routes.reminders import reminders_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.whatsapp import whatsapp_bp
    from app.routes.ai import ai_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(contacts_bp, url_prefix='/api/contacts')
    app.register_blueprint(reminders_bp, url_prefix='/api/reminders')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')

    # Health check
    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'version': '1.0.0'}

    return app
