"""Client schemas for request/response validation."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.auth import APIResponse


class ClientBase(BaseModel):
    """Base client schema."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Client name",
        examples=["John Doe", "Acme Corporation"],
    )

    email: Optional[EmailStr] = Field(
        default=None,
        description="Client email address",
        examples=["john@example.com"],
    )


class ClientCreate(ClientBase):
    """Schema for creating a new client."""

    pass


class ClientResponse(ClientBase):
    """Schema for client in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Client unique identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class ClientListResponse(BaseModel):
    """Response schema for listing clients."""

    clients: list[ClientResponse] = Field(..., description="List of clients")


class ClientDataResponse(APIResponse):
    """Response schema for single client operations."""

    data: ClientResponse = Field(..., description="Client data")
