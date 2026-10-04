"""Vercel build hook for the Django service.

Executed as the service buildCommand from the service root (backend/), after
dependencies are installed and before Vercel runs collectstatic.
"""
import os
import subprocess
import sys

DATABASE_VARS = ("DATABASE_URL", "POSTGRES_URL", "POSTGRES_HOST")


def run(args: list[str]) -> int:
    print("+", " ".join(args), flush=True)
    return subprocess.run(args, check=False).returncode


def main() -> int:
    if not any(os.environ.get(key) for key in DATABASE_VARS):
        print("No database configured (set DATABASE_URL); skipping migrate.")
    elif run([sys.executable, "manage.py", "migrate", "--noinput"]) != 0:
        return 1

    if os.environ.get("SEED_DATA", "").strip().lower() in ("1", "true", "yes", "on"):
        if run([sys.executable, "manage.py", "seed_data"]) != 0:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
