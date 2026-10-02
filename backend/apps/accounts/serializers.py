from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import Organization, User


class OrganizationSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "type",
            "contact_email",
            "contact_phone",
            "address",
            "created_at",
            "user_count",
        ]
        read_only_fields = ["id", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True, default=None)
    organization_type = serializers.CharField(source="organization.type", read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "organization",
            "organization_name",
            "organization_type",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "password", "role", "organization", "is_active"]

    def validate(self, attrs):
        role = attrs.get("role", User.Role.VENDOR)
        organization = attrs.get("organization")
        if role != User.Role.SUPER_ADMIN and organization is None:
            raise serializers.ValidationError({"organization": "Non-super-admin users must belong to an organization."})
        if role == User.Role.VENDOR:
            if organization and organization.type != Organization.Type.VENDOR:
                raise serializers.ValidationError({"organization": "Vendor users must belong to a Vendor organization."})
        if role == User.Role.WAREHOUSE_MANAGER:
            if organization and organization.type != Organization.Type.DISTRIBUTOR:
                raise serializers.ValidationError(
                    {"organization": "Warehouse Manager users must belong to a Distributor organization."}
                )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT pair serializer that embeds identity/role claims in the payload."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["role"] = user.role
        token["organization_id"] = user.organization_id
        token["organization_name"] = user.organization.name if user.organization_id else None
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data["user"] = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "organization_id": user.organization_id,
            "organization_name": user.organization.name if user.organization_id else None,
        }
        return data
