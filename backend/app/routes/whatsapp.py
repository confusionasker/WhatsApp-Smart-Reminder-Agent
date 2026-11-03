import json
import logging
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone
from app import db
from app.models.models import MessageLog, DeliveryStatus, Reminder
from app.services.whatsapp_service import whatsapp_service
from app.utils.helpers import success_response, error_response, validate_phone_number

whatsapp_bp = Blueprint('whatsapp', __name__)
logger = logging.getLogger(__name__)


@whatsapp_bp.route('/test', methods=['POST'])
@jwt_required()
def test_message():
    """Send a test WhatsApp message."""
    data = request.get_json() or {}
    phone = data.get('phone_number', '').strip()
    message = data.get('message', 'Test message from WhatsApp Smart Reminder Agent').strip()

    if not phone:
        return jsonify(error_response('phone_number is required', 400)[0]), 400

    is_valid, normalized = validate_phone_number(phone)
    if not is_valid:
        return jsonify(error_response(normalized, 400)[0]), 400

    result = whatsapp_service.send_text_message(normalized, message)
    if result['success']:
        return jsonify(success_response(result, 'Test message sent')[0]), 200
    else:
        return jsonify(error_response(result['error'], 502)[0]), 502


@whatsapp_bp.route('/qr', methods=['GET'])
@jwt_required()
def get_qr():
    """Get current WhatsApp Web QR code for scanning."""
    data = whatsapp_service.get_qr_code()
    return jsonify(success_response(data)[0]), 200


@whatsapp_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout_whatsapp():
    """Logout current WhatsApp Web session."""
    data = whatsapp_service.logout_qr()
    return jsonify(success_response(data, 'Logged out from WhatsApp')[0]), 200


@whatsapp_bp.route('/refresh-qr', methods=['POST'])
@jwt_required()
def refresh_qr():
    """Request a fresh QR code."""
    data = whatsapp_service.refresh_qr()
    return jsonify(success_response(data, 'QR refresh requested')[0]), 200


@whatsapp_bp.route('/reset', methods=['POST'])
@jwt_required()
def reset_whatsapp():
    """Reset WhatsApp session completely."""
    data = whatsapp_service.reset_session()
    return jsonify(success_response(data, 'Session reset requested')[0]), 200


@whatsapp_bp.route('/pairing-code', methods=['POST'])
@jwt_required()
def pairing_code():
    """Request an 8-digit pairing code."""
    data = request.get_json() or {}
    phone = data.get('phone', '').strip()
    if not phone:
        return jsonify(error_response('Phone number is required', 400)[0]), 400
    res = whatsapp_service.get_pairing_code(phone)
    if res.get('success'):
        return jsonify(success_response(res.get('data'), 'Pairing code generated')[0]), 200
    return jsonify(error_response(res.get('error', 'Failed to generate pairing code'), 500)[0]), 500


@whatsapp_bp.route('/webhook', methods=['GET'])
def webhook_verify():
    """WhatsApp webhook verification."""
    mode = request.args.get('hub.mode', '')
    token = request.args.get('hub.verify_token', '')
    challenge = request.args.get('hub.challenge', '')

    success, response = whatsapp_service.verify_webhook(mode, token, challenge)
    if success:
        return response, 200
    return 'Forbidden', 403


@whatsapp_bp.route('/webhook', methods=['POST'])
def webhook_receive():
    """Receive WhatsApp webhook events."""
    data = request.get_json() or {}
    logger.info(f"Webhook received: {json.dumps(data)[:500]}")

    try:
        status_updates = whatsapp_service.process_webhook_event(data)
        for update in status_updates:
            _update_delivery_status(
                message_id=update['message_id'],
                status=update['status'],
                timestamp=update['timestamp']
            )
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")

    return jsonify({'status': 'ok'}), 200


def _update_delivery_status(message_id: str, status: str, timestamp=None):
    """Update the delivery status of a message log entry."""
    if not message_id:
        return

    log = MessageLog.query.filter_by(whatsapp_message_id=message_id).first()
    if not log:
        logger.warning(f"No message log found for message_id: {message_id}")
        return

    status_map = {
        'sent': DeliveryStatus.SENT,
        'delivered': DeliveryStatus.DELIVERED,
        'read': DeliveryStatus.READ,
        'failed': DeliveryStatus.FAILED,
    }
    new_status = status_map.get(status.lower())
    if new_status:
        log.delivery_status = new_status
        db.session.commit()
        logger.info(f"Updated delivery status for message {message_id} to {new_status.value}")


@whatsapp_bp.route('/status', methods=['GET'])
@jwt_required()
def api_status():
    """Check WhatsApp API configuration and QR connection status."""
    is_demo = current_app.config.get('DEMO_MODE', False)
    provider = current_app.config.get('WHATSAPP_PROVIDER', 'qr')
    has_token = bool(current_app.config.get('WHATSAPP_ACCESS_TOKEN', ''))
    has_phone_id = bool(current_app.config.get('WHATSAPP_PHONE_NUMBER_ID', ''))

    qr_status = whatsapp_service.get_qr_status()

    return jsonify(success_response({
        'provider': provider,
        'demo_mode': is_demo,
        'qr_gateway': {
            'online': qr_status.get('online', False),
            'connected': qr_status.get('connected', False),
            'phone': qr_status.get('phone'),
            'name': qr_status.get('name'),
            'has_qr': qr_status.get('has_qr', False)
        },
        'meta_api': {
            'configured': has_token and has_phone_id,
            'api_version': current_app.config.get('WHATSAPP_API_VERSION', 'v21.0')
        }
    })[0]), 200
