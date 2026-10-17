from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from jose import JWTError, jwt
from pwdlib import PasswordHash

from app.config import ALGORITHM, SECRET_KEY

# pwdlib recommended password hashing (Argon2id)
pwd_context = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hashes a plain text password using Argon2id."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain text password against an Argon2id hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Encodes JWT token with payload and expiration."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=1440)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Decodes a JWT token and returns the payload if valid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

