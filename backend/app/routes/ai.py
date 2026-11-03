import json
import logging
import requests
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.helpers import success_response, error_response

ai_bp = Blueprint('ai', __name__)
logger = logging.getLogger(__name__)


def _call_ollama(prompt: str, model: str, base_url: str) -> str | None:
    """Call Ollama API and return the response text."""
    try:
        response = requests.post(
            f"{base_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=60
        )
        if response.status_code == 200:
            return response.json().get('response', '').strip()
        logger.error(f"Ollama API error: {response.status_code} {response.text}")
        return None
    except requests.exceptions.ConnectionError:
        logger.error("Cannot connect to Ollama. Is it running?")
        return None
    except Exception as e:
        logger.error(f"Ollama error: {e}")
        return None


@ai_bp.route('/parse-reminder', methods=['POST'])
@jwt_required()
def parse_reminder():
    """
    Parse a natural language reminder description using Ollama.
    Returns extracted fields for user confirmation.
    """
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    text = data.get('text', '').strip()

    if not text:
        return jsonify(error_response('text field is required', 400)[0]), 400

    # Get user's contacts for AI to match phone numbers
    from app.models.models import Contact
    contacts = Contact.query.filter_by(user_id=user_id).all()
    contacts_json = json.dumps([
        {'name': c.contact_name, 'phone': c.phone_number} for c in contacts
    ])

    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')

    prompt = f"""You are a reminder parsing assistant. Extract reminder details from the user's text.
Current time: {now_str}

User's contacts (for phone number lookup):
{contacts_json}

User input: "{text}"

Extract and return ONLY a JSON object with these fields:
- recipient_name: string (name of the person)
- phone_number: string (E.164 format like +919876543210, or null if unknown)
- message: string (the reminder message to send)
- scheduled_date: string (YYYY-MM-DD format, calculated from "tomorrow", "next week", etc.)
- scheduled_time: string (HH:MM in 24-hour format)
- timezone: string (timezone identifier, default "UTC")
- confidence: number (0-1, how confident you are in the parsing)

If you cannot extract a field, set it to null.
Return ONLY the JSON object, no explanation."""

    ollama_base = current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    ollama_model = current_app.config.get('OLLAMA_MODEL', 'mistral:latest')

    response_text = _call_ollama(prompt, ollama_model, ollama_base)

    if not response_text:
        return jsonify(error_response(
            'AI service is unavailable. Please ensure Ollama is running and the model is loaded.',
            503
        )[0]), 503

    # Parse JSON from response
    try:
        # Strip markdown code blocks if present
        clean = response_text.strip()
        if clean.startswith('```'):
            lines = clean.split('\n')
            clean = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse Ollama JSON response: {response_text}")
        return jsonify(error_response('AI returned an invalid response. Please try again.', 502)[0]), 502

    return jsonify(success_response({
        'parsed': parsed,
        'original_text': text,
        'requires_confirmation': True
    }, 'Reminder parsed. Please confirm before saving.')[0]), 200


@ai_bp.route('/status', methods=['GET'])
@jwt_required()
def ai_status():
    """Check if Ollama AI service is available."""
    base_url = current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    model = current_app.config.get('OLLAMA_MODEL', 'mistral:latest')

    try:
        response = requests.get(f"{base_url}/api/tags", timeout=5)
        if response.status_code == 200:
            models = [m['name'] for m in response.json().get('models', [])]
            return jsonify(success_response({
                'available': True,
                'base_url': base_url,
                'configured_model': model,
                'loaded_models': models,
                'model_ready': model in models
            })[0]), 200
    except Exception:
        pass

    return jsonify(success_response({
        'available': False,
        'base_url': base_url,
        'configured_model': model,
    })[0]), 200

