#!/usr/bin/env python3
"""
Local FastAPI server runner for Context8 CLI.

This is the local deployment alternative to modal_app.py.
It runs the FastAPI application using uvicorn.

Usage:
    python local_server.py

Or with custom host/port:
    python local_server.py --host 0.0.0.0 --port 8000
"""
import argparse
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def main():
    parser = argparse.ArgumentParser(description="Run Context8 FastAPI server locally")
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to (default: 8000)",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (default: 1)",
    )
    args = parser.parse_args()

    # Validate required environment variables
    required_vars = [
        "DATABASE_URL",
        "JWT_SECRET",
        "API_KEY_SECRET",
    ]

    missing_vars = [var for var in required_vars if not os.environ.get(var)]
    if missing_vars:
        print(f"Error: Missing required environment variables: {', '.join(missing_vars)}")
        print("Please create a .env file based on .env.example")
        return 1

    # Import uvicorn here to avoid loading app before env vars are set
    import uvicorn

    print(f"Starting Context8 FastAPI server on {args.host}:{args.port}")
    print(f"Workers: {args.workers}")
    print(f"Reload: {args.reload}")
    print("\nAPI will be available at:")
    print(f"  http://{args.host}:{args.port}")
    print(f"  Docs: http://{args.host}:{args.port}/docs")
    print(f"  OpenAPI: http://{args.host}:{args.port}/openapi.json")

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,  # reload doesn't work with multiple workers
        log_level="info",
    )


if __name__ == "__main__":
    exit(main() or 0)
