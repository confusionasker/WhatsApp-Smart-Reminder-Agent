import json
import logging
import requests
from datetime import datetime, timezone
from flask import current_app

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Service supporting WhatsApp Web (QR Code scan), Meta Cloud API, and Demo mode."""

    def __init__(self):
        self.app = None

    def init_app(self, app):
        self.app = app

    def _get_provider(self):
        if current_app.config.get('DEMO_MODE', False):
            return 'demo'
        provider = current_app.config.get('WHATSAPP_PROVIDER')
        if provider:
            return provider
        if current_app.config.get('WHATSAPP_ACCESS_TOKEN'):
            return 'meta'
        return 'qr'

    def _get_headers(self):
        token = current_app.config.get('WHATSAPP_ACCESS_TOKEN', '')
        return {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        }

    def _get_api_url(self, endpoint='messages'):
        phone_number_id = current_app.config.get('WHATSAPP_PHONE_NUMBER_ID', '')
        api_version = current_app.config.get('WHATSAPP_API_VERSION', 'v21.0')
        return f'https://graph.facebook.com/{api_version}/{phone_number_id}/{endpoint}'

    def _is_demo_mode(self):
        provider = self._get_provider()
        if provider == 'demo':
            return True
        if provider == 'meta':
            token = current_app.config.get('WHATSAPP_ACCESS_TOKEN', '')
            phone_id = current_app.config.get('WHATSAPP_PHONE_NUMBER_ID', '')
            return not token or not phone_id
        return False

    def validate_phone_number(self, phone: str) -> tuple[bool, str]:
        """Validate phone number format (E.164) with smart country code auto-detection."""
        import re
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
        return False, f"Invalid phone number format: {phone}. Use international format with country code (e.g., +919876543210 or +8801712345678)"

    # ─── QR Code Gateway Methods ─────────────────────────────────────────────

    def get_qr_status(self) -> dict:
        """Check status of WhatsApp Web Gateway."""
        gateway_url = current_app.config.get('WHATSAPP_GATEWAY_URL', 'http://localhost:3001')
        try:
            res = requests.get(f"{gateway_url}/api/status", timeout=3)
            if res.status_code == 200:
                data = res.json().get('data', {})
                return {
                    'online': True,
                    'connected': data.get('connected', False),
                    'phone': data.get('phone'),
                    'name': data.get('name'),
                    'has_qr': data.get('hasQr', False)
                }
        except Exception:
            pass
        return {
            'online': False,
            'connected': False,
            'phone': None,
            'name': None,
            'has_qr': False
        }

    def get_qr_code(self) -> dict:
        """Fetch latest QR code image (Data URL) from gateway."""
        gateway_url = current_app.config.get('WHATSAPP_GATEWAY_URL', 'http://localhost:3001')
        try:
            res = requests.get(f"{gateway_url}/api/qr", timeout=4)
            if res.status_code == 200:
                return res.json().get('data', {})
        except Exception as e:
            logger.error(f"Failed to fetch QR code from gateway: {e}")
        return {'connected': False, 'qr': None}

    def logout_qr(self) -> dict:
        """Disconnect and clear WhatsApp Web session."""
        gateway_url = current_app.config.get('WHATSAPP_GATEWAY_URL', 'http://localhost:3001')
        try:
            res = requests.post(f"{gateway_url}/api/logout", timeout=5)
            return res.json()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def refresh_qr(self) -> dict:
        """Request a fresh QR code from gateway."""
        gateway_url = current_app.config.get('WHATSAPP_GATEWAY_URL', 'http://localhost:3001')
        try:
            res = requests.post(f"{gateway_url}/api/refresh-qr", timeout=5)
            return res.json()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def reset_session(self) -> dict:
        """Reset WhatsApp session completely."""
        gateway_url = current_app.config.get('WHATSAPP_GATEWAY_URL', 'http://localhost:3001')
        try:
            res = requests.post(f"{gateway_url}/api/reset", timeout=5)
            return res.json()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_pairing_code(self, phone: str) -> dict:
        """Request an 8-digit pairing code for linking via phone number."""
        gateway_url = current_app.config.get('WHATSAPP_GATEWAY_URL', 'http://localhost:3001')
        try:
            res = requests.post(f"{gateway_url}/api/pairing-code", json={'phone': phone}, timeout=15)
            return res.json()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ─── Send Message ────────────────────────────────────────────────────────

    def send_text_message(self, to: str, message: str) -> dict:
        """
        Send a text message via configured provider:
        - 'qr': sends via WhatsApp Web QR gateway (no Meta developer account needed)
        - 'meta': sends via Meta WhatsApp Cloud API
        - 'demo': logs simulated send
        """
        is_valid, validated_phone = self.validate_phone_number(to)
        if not is_valid:
            return {
                'success': False,
                'message_id': None,
                'api_response': None,
                'error': validated_phone
            }

        provider = self._get_provider()

        # 1. Demo Mode
        if provider == 'demo' or self._is_demo_mode():
            logger.info(f"[DEMO MODE] Would send WhatsApp message to {validated_phone}: {message[:50]}...")
            demo_message_id = f"demo_msg_{int(datetime.now(timezone.utc).timestamp())}"
            return {
                'success': True,
                'message_id': demo_message_id,
                'api_response': json.dumps({'demo': True, 'to': validated_phone, 'message_id': demo_message_id}),
                'error': None
            }

        # 2. QR Code Gateway Mode (WhatsApp Web)
        if provider == 'qr':
            gateway_url = current_app.config.get('WHATSAPP_GATEWAY_URL', 'http://localhost:3001')
            try:
                response = requests.post(
                    f"{gateway_url}/api/send",
                    json={'to': validated_phone, 'message': message},
                    timeout=20
                )
                res_data = response.json()
                if response.status_code == 200 and res_data.get('success'):
                    msg_id = res_data.get('data', {}).get('messageId')
                    logger.info(f"WhatsApp Web message sent to {validated_phone}, id: {msg_id}")
                    return {
                        'success': True,
                        'message_id': msg_id,
                        'api_response': json.dumps(res_data),
                        'error': None
                    }
                else:
                    err_raw = res_data.get('error', 'Failed to send via WhatsApp Web')
                    err_msg = err_raw.get('message', str(err_raw)) if isinstance(err_raw, dict) else str(err_raw)
                    logger.error(f"WhatsApp Web error: {err_msg}")
                    return {
                        'success': False,
                        'message_id': None,
                        'api_response': json.dumps(res_data),
                        'error': err_msg
                    }
            except requests.exceptions.ConnectionError:
                err_msg = "WhatsApp Gateway is offline. Please start the gateway (npm start in whatsapp-gateway/)."
                logger.error(err_msg)
                return {'success': False, 'message_id': None, 'api_response': None, 'error': err_msg}
            except Exception as e:
                logger.error(f"Error sending via WhatsApp Web: {e}")
                return {'success': False, 'message_id': None, 'api_response': None, 'error': str(e)}

        # 3. Meta Cloud API Mode
        payload = {
            'messaging_product': 'whatsapp',
            'recipient_type': 'individual',
            'to': validated_phone,
            'type': 'text',
            'text': {
                'preview_url': False,
                'body': message
            }
        }

        try:
            response = requests.post(
                self._get_api_url('messages'),
                headers=self._get_headers(),
                json=payload,
                timeout=30
            )
            response_data = response.json()

            if response.status_code == 200:
                message_id = None
                messages = response_data.get('messages', [])
                if messages:
                    message_id = messages[0].get('id')

                logger.info(f"Meta WhatsApp message sent to {validated_phone}, message_id: {message_id}")
                return {
                    'success': True,
                    'message_id': message_id,
                    'api_response': json.dumps(response_data),
                    'error': None
                }
            else:
                error_detail = response_data.get('error', {})
                error_msg = error_detail.get('message', f'HTTP {response.status_code}')
                logger.error(f"WhatsApp API error for {validated_phone}: {error_msg}")
                return {
                    'success': False,
                    'message_id': None,
                    'api_response': json.dumps(response_data),
                    'error': error_msg
                }

        except requests.exceptions.Timeout:
            error_msg = "WhatsApp API request timed out"
            logger.error(error_msg)
            return {'success': False, 'message_id': None, 'api_response': None, 'error': error_msg}
        except requests.exceptions.ConnectionError as e:
            error_msg = f"Connection error to WhatsApp API: {str(e)}"
            logger.error(error_msg)
            return {'success': False, 'message_id': None, 'api_response': None, 'error': error_msg}
        except Exception as e:
            error_msg = f"Unexpected error sending WhatsApp message: {str(e)}"
            logger.error(error_msg)
            return {'success': False, 'message_id': None, 'api_response': None, 'error': str(e)}

    def send_template_message(self, to: str, template_name: str, language_code: str = 'en_US',
                               components: list = None) -> dict:
        """Send a template message via WhatsApp Cloud API."""
        is_valid, validated_phone = self.validate_phone_number(to)
        if not is_valid:
            return {'success': False, 'message_id': None, 'api_response': None, 'error': validated_phone}

        if self._is_demo_mode():
            demo_message_id = f"demo_tmpl_{int(datetime.now(timezone.utc).timestamp())}"
            return {
                'success': True,
                'message_id': demo_message_id,
                'api_response': json.dumps({'demo': True, 'template': template_name}),
                'error': None
            }

        payload = {
            'messaging_product': 'whatsapp',
            'to': validated_phone,
            'type': 'template',
            'template': {
                'name': template_name,
                'language': {'code': language_code},
            }
        }
        if components:
            payload['template']['components'] = components

        try:
            response = requests.post(
                self._get_api_url('messages'),
                headers=self._get_headers(),
                json=payload,
                timeout=30
            )
            response_data = response.json()

            if response.status_code == 200:
                messages = response_data.get('messages', [])
                message_id = messages[0].get('id') if messages else None
                return {
                    'success': True,
                    'message_id': message_id,
                    'api_response': json.dumps(response_data),
                    'error': None
                }
            else:
                error_detail = response_data.get('error', {})
                error_msg = error_detail.get('message', f'HTTP {response.status_code}')
                return {
                    'success': False,
                    'message_id': None,
                    'api_response': json.dumps(response_data),
                    'error': error_msg
                }
        except Exception as e:
            return {'success': False, 'message_id': None, 'api_response': None, 'error': str(e)}

    def verify_webhook(self, mode: str, token: str, challenge: str) -> tuple[bool, str]:
        """Verify WhatsApp webhook subscription."""
        verify_token = current_app.config.get('WHATSAPP_VERIFY_TOKEN', '')
        if mode == 'subscribe' and token == verify_token:
            return True, challenge
        return False, 'Forbidden'

    def process_webhook_event(self, data: dict) -> list[dict]:
        """Process incoming webhook events from WhatsApp."""
        processed = []
        entry = data.get('entry', [])
        for entry_item in entry:
            for change in entry_item.get('changes', []):
                value = change.get('value', {})
                for status in value.get('statuses', []):
                    processed.append({
                        'message_id': status.get('id'),
                        'status': status.get('status'),
                        'timestamp': status.get('timestamp'),
                        'recipient_id': status.get('recipient_id'),
                    })
        return processed


whatsapp_service = WhatsAppService()
