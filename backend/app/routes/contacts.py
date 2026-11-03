from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from sqlalchemy.exc import IntegrityError
from app import db
from app.models.models import Contact
from app.utils.helpers import success_response, error_response, validate_phone_number, paginate_query

contacts_bp = Blueprint('contacts', __name__)


class ContactSchema(Schema):
    contact_name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    phone_number = fields.Str(required=True)


@contacts_bp.route('', methods=['POST'])
@jwt_required()
def create_contact():
    user_id = int(get_jwt_identity())
    schema = ContactSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify(error_response('Validation failed', 422, e.messages)[0]), 422

    is_valid, normalized = validate_phone_number(data['phone_number'])
    if not is_valid:
        return jsonify(error_response(normalized, 400)[0]), 400

    contact = Contact(
        user_id=user_id,
        contact_name=data['contact_name'].strip(),
        phone_number=normalized
    )
    db.session.add(contact)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error_response('Phone number already exists in your contacts', 409)[0]), 409

    return jsonify(success_response(contact.to_dict(), 'Contact created', 201)[0]), 201


@contacts_bp.route('', methods=['GET'])
@jwt_required()
def get_contacts():
    user_id = int(get_jwt_identity())
    search = request.args.get('search', '').strip()
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 50)), 100)

    query = Contact.query.filter_by(user_id=user_id)
    if search:
        query = query.filter(
            db.or_(
                Contact.contact_name.ilike(f'%{search}%'),
                Contact.phone_number.ilike(f'%{search}%')
            )
        )
    query = query.order_by(Contact.contact_name.asc())
    result = paginate_query(query, page, per_page)
    return jsonify(success_response(result)[0]), 200


@contacts_bp.route('/<int:contact_id>', methods=['GET'])
@jwt_required()
def get_contact(contact_id):
    user_id = int(get_jwt_identity())
    contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first_or_404()
    return jsonify(success_response(contact.to_dict())[0]), 200


@contacts_bp.route('/<int:contact_id>', methods=['PUT'])
@jwt_required()
def update_contact(contact_id):
    user_id = int(get_jwt_identity())
    contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first_or_404()

    schema = ContactSchema()
    try:
        data = schema.load(request.get_json() or {}, partial=True)
    except ValidationError as e:
        return jsonify(error_response('Validation failed', 422, e.messages)[0]), 422

    if 'phone_number' in data:
        is_valid, normalized = validate_phone_number(data['phone_number'])
        if not is_valid:
            return jsonify(error_response(normalized, 400)[0]), 400
        contact.phone_number = normalized

    if 'contact_name' in data:
        contact.contact_name = data['contact_name'].strip()

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error_response('Phone number already exists in your contacts', 409)[0]), 409

    return jsonify(success_response(contact.to_dict(), 'Contact updated')[0]), 200


@contacts_bp.route('/<int:contact_id>', methods=['DELETE'])
@jwt_required()
def delete_contact(contact_id):
    user_id = int(get_jwt_identity())
    contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first_or_404()
    db.session.delete(contact)
    db.session.commit()
    return jsonify(success_response(None, 'Contact deleted')[0]), 200

