"""Client management API endpoints."""

from uuid import UUID

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.dependencies import ActiveUser, DbSession, api_error
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientDataResponse, ClientListResponse

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=ClientListResponse)
async def list_clients(
    current_user: ActiveUser,
    db: DbSession,
) -> ClientListResponse:
    """List all clients for the current user."""
    query = (
        select(Client)
        .where(Client.created_by == current_user.id)
        .order_by(Client.name)
    )
    result = await db.execute(query)
    clients = result.scalars().all()

    return ClientListResponse(clients=clients)


@router.post(
    "",
    response_model=ClientDataResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_client(
    client_data: ClientCreate,
    current_user: ActiveUser,
    db: DbSession,
) -> ClientDataResponse:
    """Create a new client owned by the authenticated user."""
    client = Client(
        name=client_data.name,
        email=client_data.email,
        created_by=current_user.id,
    )

    db.add(client)
    await db.commit()
    await db.refresh(client)

    return ClientDataResponse(
        success=True,
        data=client,
    )


@router.get("/{client_id}", response_model=ClientDataResponse)
async def get_client(
    client_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
) -> ClientDataResponse:
    """Get a specific client by ID (must be owned by authenticated user)."""
    query = select(Client).where(
        Client.id == client_id,
        Client.created_by == current_user.id,
    )
    result = await db.execute(query)
    client = result.scalar_one_or_none()

    if not client:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "CLIENT_NOT_FOUND",
            "Client not found",
        )

    return ClientDataResponse(success=True, data=client)
