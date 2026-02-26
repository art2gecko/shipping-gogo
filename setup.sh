#!/usr/bin/env bash
# ShipGo - One-command setup script for Linux / macOS
# Usage: bash setup.sh

set -euo pipefail

echo ""
echo "=== ShipGo Setup ==="

# 1. Check Node.js
echo ""
echo "[1/7] Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "  ERROR: Node.js not found. Install from https://nodejs.org"
  exit 1
fi
echo "  Node.js $(node --version) found"

# 2. Install backend dependencies
echo ""
echo "[2/7] Installing backend dependencies..."
npm install

# 3. Create .env from .env.example if it doesn't exist
if [ ! -f .env ]; then
  echo ""
  echo "[3/7] Creating .env from .env.example..."
  cp .env.example .env
  echo "  .env created (edit it if you need custom settings)"
else
  echo ""
  echo "[3/7] .env already exists"
fi

# 4. Start PostgreSQL via Docker
echo ""
echo "[4/7] Starting PostgreSQL..."
if command -v docker &>/dev/null; then
  echo "  Docker found, starting PostgreSQL container..."
  docker compose up -d db 2>/dev/null || docker-compose up -d db 2>/dev/null
  echo "  Waiting for PostgreSQL to be ready..."
  sleep 3
  echo "  PostgreSQL running on port 5432"
else
  echo "  Docker not found. Make sure PostgreSQL is running manually on port 5432."
  echo "  If you have PostgreSQL installed locally, create the database:"
  echo '    psql -U postgres -c "CREATE DATABASE shipping_gogo;"'
fi

# 5. Run Prisma setup
echo ""
echo "[5/7] Setting up database..."
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
echo "  Database ready with demo data"

# 6. Install frontend dependencies
echo ""
echo "[6/7] Installing frontend dependencies..."
(cd frontend && npm install)

# 7. Done
echo ""
echo "[7/7] Setup complete!"
echo ""
echo "=== To start the app, open TWO terminals ==="
echo ""
echo "  Terminal 1 (backend):"
echo "    npm run dev"
echo ""
echo "  Terminal 2 (frontend):"
echo "    cd frontend && npm run dev"
echo ""
echo "  Then open: http://localhost:5173"
echo "  Login:     admin / admin123"
echo ""
