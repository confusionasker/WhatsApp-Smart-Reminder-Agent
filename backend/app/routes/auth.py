from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from app import db
from app.models.models import User
from app.utils.helpers import success_response, error_response

auth_bp = Blueprint('auth', __name__)


class RegisterSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=2, max=100))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=6))


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True)


@auth_bp.route('/register', methods=['POST'])
def register():
    schema = RegisterSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify(error_response('Validation failed', 422, e.messages)[0]), 422

    if User.query.filter_by(email=data['email'].lower()).first():
        return jsonify(error_response('Email already registered', 409)[0]), 409

    user = User(name=data['name'], email=data['email'].lower())
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify(success_response(
        {'user': user.to_dict(), 'access_token': token},
        'Registration successful',
        201
    )[0]), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    schema = LoginSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify(error_response('Validation failed', 422, e.messages)[0]), 422

    user = User.query.filter_by(email=data['email'].lower()).first()
    if not user or not user.check_password(data['password']):
        return jsonify(error_response('Invalid email or password', 401)[0]), 401

    token = create_access_token(identity=str(user.id))
    return jsonify(success_response(
        {'user': user.to_dict(), 'access_token': token},
        'Login successful'
    )[0]), 200


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    return jsonify(success_response(user.to_dict())[0]), 200


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    if 'name' in data:
        name = data['name'].strip()
        if len(name) < 2:
            return jsonify(error_response('Name must be at least 2 characters')[0]), 400
        user.name = name

    if 'password' in data:
        if len(data['password']) < 6:
            return jsonify(error_response('Password must be at least 6 characters')[0]), 400
        user.set_password(data['password'])

    db.session.commit()
    return jsonify(success_response(user.to_dict(), 'Profile updated')[0]), 200

