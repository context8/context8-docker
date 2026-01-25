import modal

image = (
    modal.Image.debian_slim()
    .pip_install_from_requirements("requirements.txt")
    .env({"PYTHONPATH": "/root/context8-cloud"})
    .add_local_dir(".", remote_path="/root/context8-cloud", copy=True)
)

app = modal.App("context")


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("postgres-credentials"),
        modal.Secret.from_name("resend-key"),
        modal.Secret.from_name("api-key-secret"),
        modal.Secret.from_name("jwt-secret"),
        modal.Secret.from_name("openrouter-api")
    ],
    timeout=300,
    name="8",
    serialized=True,
)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def fastapi_app():
    from app.main import app as fastapi_app
    return fastapi_app


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("postgres-credentials")],
    schedule=modal.Cron("0 */6 * * *"),  # Run every 6 hours
    timeout=600,
)
async def cleanup_expired_codes():
    """Cleanup expired verification codes older than 24 hours."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import delete
    from app.database import engine
    from app.models import VerificationCode
    from sqlalchemy.ext.asyncio import AsyncSession

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    async with AsyncSession(engine) as session:
        result = await session.execute(
            delete(VerificationCode).where(
                VerificationCode.created_at < cutoff
            )
        )
        await session.commit()
        deleted_count = result.rowcount

    print(f"Cleanup completed: deleted {deleted_count} expired verification codes")
    return {"deleted": deleted_count, "cutoff": cutoff.isoformat()}
