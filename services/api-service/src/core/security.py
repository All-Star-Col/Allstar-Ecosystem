from passlib.context import CryptContext
from src.core.logging_config import get_logger
logger = get_logger(__name__)

# Esta es una "herramienta pura", no importa a nadie más
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)