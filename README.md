# SIAQ (سياق)

SIAQ is a human-centered platform for evaluating and comparing Large Language Model (LLM) responses across multiple alignment dimensions.

The platform is designed to let users compare model responses through a structured evaluation process based on three dimensions:

- **Contextual Appropriateness**
- **Positivity Alignment**
- **Socio-Cultural Values Alignment**

## Current Features

- User registration, login, and logout
- Secure password hashing with Argon2
- Cookie-based user session management
- LLM model selection interface with Mistral and Aya configurations
- Prompt input and validation, with a 1,000-character limit
- PostgreSQL database integration
- Responsive web interface

Model selection and prompt validation are available in the interface. LLM response generation, comparison, and alignment evaluation are planned for a later development stage.

## Technologies

| Layer | Technologies |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Python, FastAPI, Uvicorn |
| Database | PostgreSQL |
| Database management | pgAdmin 4 |
| Database driver | Psycopg 3 |
| Authentication | pwdlib with Argon2, Starlette session middleware |

## Project Structure

```text
SIAQ/
├── backend/
│   ├── main.py          # API routes, authentication, and frontend serving
│   ├── database.py      # PostgreSQL connection settings
│   └── siaq_db.sql      # Database schema and demo data
├── assets/
│   └── logo.png
├── index.html
├── signup.html
├── login.html
├── style.css
├── script.js
└── README.md
```

## Database

SIAQ uses PostgreSQL to store user account information. The FastAPI backend communicates with the database through Psycopg.

The current `users` table includes:

- User ID
- First name
- Last name
- Email
- Hashed password
- Role
- Account status (`is_blocked`)

Passwords are stored as hashes rather than plain text. The included `backend/siaq_db.sql` file contains the table structure and demo user data for local development.

## Running the Project

The commands below use Windows PowerShell. Install Python and PostgreSQL first; pgAdmin 4 can be used to manage the database.

### 1. Download the project

Clone the repository, or download and extract its ZIP file from GitHub:

```powershell
git clone https://github.com/Sarahhtamimi/SIAQ.git
cd SIAQ
```

Run the remaining commands from the project root, which contains `index.html` and the `backend` folder.

### 2. Install Python dependencies

```powershell
py -m pip install fastapi "uvicorn[standard]" "psycopg[binary]" "pwdlib[argon2]" itsdangerous
```

### 3. Create and import the database

Create an empty PostgreSQL database named `siaq_db`, either in pgAdmin 4 or with the command below. Import the included SQL file into that empty database:

```powershell
createdb -U postgres siaq_db
psql -U postgres -d siaq_db -v ON_ERROR_STOP=1 -f backend/siaq_db.sql
```

If you already created the database in pgAdmin 4, skip the `createdb` command. The dump includes demo data and should be imported only once into a fresh database.

The dump was exported from PostgreSQL 18.6. Using PostgreSQL 18 with its bundled command-line tools is recommended for this project. If PowerShell cannot find `createdb` or `psql`, add the PostgreSQL `bin` directory to your PATH, or run the commands from the PostgreSQL installation directory using their full executable paths.

### 4. Configure the database connection

Update the connection settings in `backend/database.py` to match your local PostgreSQL installation:

```python
def connect_db():
    return psycopg.connect(
        dbname="siaq_db",
        user="postgres",
        password="YOUR_POSTGRES_PASSWORD",
        host="localhost",
        port=5432,
    )
```

Use the password for your PostgreSQL database user, which may differ from the pgAdmin master password. Keep your personal database credentials out of commits.

### 5. Set a session secret and start the server

Generate a session secret for the current PowerShell session, then start FastAPI:

```powershell
$env:SESSION_SECRET = py -c "import secrets; print(secrets.token_hex(32))"
py -m uvicorn backend.main:app --reload
```

Changing the session secret invalidates existing login sessions.

Open the application at:

[http://127.0.0.1:8000/index.html](http://127.0.0.1:8000/index.html)

Keep the server running while using the application. Open the pages through this address so the frontend can communicate with the backend. The root URL (`/`) returns a database connection status message; the homepage is served at `/index.html`.

Interactive API documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## Project Status

SIAQ is currently under development as a graduation project at **King Saud University**.

The current version provides user authentication, database integration, and the initial evaluation interface. LLM integration and the complete response evaluation workflow are still under development.
