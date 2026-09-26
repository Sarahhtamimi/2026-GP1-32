import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pwdlib import PasswordHash
from psycopg.errors import UniqueViolation
from starlette.middleware.sessions import SessionMiddleware

from .database import connect_db


app = FastAPI()
password_hash = PasswordHash.recommended()

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "LOCAL_DEVELOPMENT_ONLY_CHANGE_ME"),
    same_site="lax",
    https_only=False,
)


class SignupData(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str


class LoginData(BaseModel):
    email: str
    password: str


@app.get("/")
def home():
    with connect_db() as conn:
        conn.execute("SELECT 1")

    return {"message": "SIAQ backend is connected to PostgreSQL"}


@app.post("/api/signup")
def signup(data: SignupData, request: Request):
    first_name = data.first_name.strip()
    last_name = data.last_name.strip()
    email = data.email.strip().lower()

    if not first_name or not last_name or not email or not data.password:
        raise HTTPException(status_code=400, detail="All fields are required")

    if len(first_name) > 50 or len(last_name) > 50:
        raise HTTPException(status_code=400, detail="Name is too long")

    if len(email) > 254 or not (
        "@" in email
        and "." in email.split("@")[-1]
        and " " not in email
    ):
        raise HTTPException(status_code=400, detail="Invalid email address")

    if (
        len(data.password) < 8
        or not any(char.isalpha() for char in data.password)
        or not any(char.isdigit() for char in data.password)
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must be at least 8 characters and "
                "contain at least one letter and one number"
            ),
        )

    hashed_password = password_hash.hash(data.password)

    try:
        with connect_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users
                        (first_name, last_name, email, password_hash)
                    VALUES (%s, %s, %s, %s)
                    RETURNING user_id
                    """,
                    (first_name, last_name, email, hashed_password),
                )
                user_id = cur.fetchone()[0]

    except UniqueViolation:
        raise HTTPException(
            status_code=409,
            detail="This email is already registered",
        )

    # Log in automatically after successful registration.
    request.session.clear()
    request.session["user_id"] = user_id

    return {
        "message": "Account created successfully",
        "user_id": user_id,
    }


@app.post("/api/login")
def login(data: LoginData, request: Request):
    email = data.email.strip().lower()

    with connect_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id, first_name, last_name,
                       email, password_hash, role, is_blocked
                FROM users
                WHERE email = %s
                """,
                (email,),
            )
            user = cur.fetchone()

    if user is None or not password_hash.verify(data.password, user[4]):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if user[6]:
        raise HTTPException(
            status_code=403,
            detail="This account is blocked",
        )

    request.session.clear()
    request.session["user_id"] = user[0]

    return {
        "message": "Login successful",
        "user": {
            "user_id": user[0],
            "first_name": user[1],
            "last_name": user[2],
            "email": user[3],
            "role": user[5],
        },
    }


@app.get("/api/me")
def get_current_user(request: Request):
    user_id = request.session.get("user_id")

    if user_id is None:
        raise HTTPException(status_code=401, detail="Not logged in")

    with connect_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id, first_name, last_name,
                       email, role, is_blocked
                FROM users
                WHERE user_id = %s
                """,
                (user_id,),
            )
            user = cur.fetchone()

    if user is None or user[5]:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Account unavailable")

    return {
        "user_id": user[0],
        "first_name": user[1],
        "last_name": user[2],
        "email": user[3],
        "role": user[4],
    }


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logout successful"}


# Serve the existing frontend files.
FRONTEND_DIR = Path(__file__).resolve().parent.parent


@app.get("/index.html", include_in_schema=False)
def index_page():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/signup.html", include_in_schema=False)
def signup_page():
    return FileResponse(FRONTEND_DIR / "signup.html")


@app.get("/login.html", include_in_schema=False)
def login_page():
    return FileResponse(FRONTEND_DIR / "login.html")


@app.get("/style.css", include_in_schema=False)
def stylesheet():
    return FileResponse(FRONTEND_DIR / "style.css")


@app.get("/script.js", include_in_schema=False)
def javascript():
    return FileResponse(FRONTEND_DIR / "script.js")


app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIR / "assets"),
    name="assets",
)