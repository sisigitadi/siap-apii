#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Menjalankan PostgreSQL + Redis di WSL2 Ubuntu untuk development SIAP APII.
# Pengganti `docker compose up -d db redis` saat Docker tidak tersedia.
#
# MinIO tidak dibutuhkan - backend menyimpan upload ke folder storage/ lokal
# (filesystem), bukan S3. Yang dibutuhkan saat bootstrap hanya PostgreSQL
# (Prisma) dan Redis (cache + WebSocket event bus).
#
# Jalankan sebagai root (tidak butuh password sudo):
#   wsl -d Ubuntu -u root -- bash "/mnt/d/Projects/APII Jabo/APII Jabo Apps/scripts/wsl-dev-services.sh"
#
# Catatan: WSL2 tidak meneruskan loopback (127.0.0.1) dari Windows ke WSL,
# bahkan dengan networkingMode=mirrored. Karena itu service dibind ke 0.0.0.0
# dan backend Windows terhubung via IP mesin (lihat .env). Re-run script ini
# setiap kali WSL di-restart / setelah reboot.
# -----------------------------------------------------------------------------
set -euo pipefail

DB_NAME="apii_jabo"
DB_USER="apii"
DB_PASS="apii"

echo "==> Memasang PostgreSQL + Redis..."
apt-get update
apt-get install -y postgresql postgresql-contrib redis-server

echo "==> Mengonfigurasi bind 0.0.0.0 (WSL2 tidak meneruskan loopback ke host)..."
PG_VERSION="$(ls -1 /etc/postgresql | sort -V | tail -1)"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
grep -q "^listen_addresses = '\*'" "$PG_CONF" || printf "\nlisten_addresses = '*'\n" >> "$PG_CONF"
grep -q "apii-dev-net" "$PG_HBA" || printf "host all all 0.0.0.0/0 scram-sha-256\t# apii-dev-net\nhost all all ::/0 scram-sha-256\t# apii-dev-net\n" >> "$PG_HBA"
grep -q "^bind 0.0.0.0" /etc/redis/redis.conf || printf "\nbind 0.0.0.0\nprotected-mode no\n" >> /etc/redis/redis.conf

echo "==> Menjalankan PostgreSQL + Redis..."
service postgresql restart
service redis-server restart || redis-server --daemonize yes --bind 0.0.0.0 --port 6379

echo "==> Membuat role '$DB_USER' & database '$DB_NAME'..."
runuser -u postgres -- psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'apii') THEN
    CREATE ROLE apii WITH LOGIN PASSWORD 'apii';
  ELSE
    ALTER ROLE apii WITH LOGIN PASSWORD 'apii';
  END IF;
END
$$;
SQL
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
  || runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

echo "==> Verifikasi koneksi (dari dalam WSL)..."
pg_isready -h 127.0.0.1 -p 5432
redis-cli -h 127.0.0.1 -p 6379 ping
ss -tln | grep -E ':5432|:6379'

VM_IP="$(ip -4 addr show eth0 | grep -oP 'inet \K[\d.]+' | head -1)"
echo ""
echo "Selesai. PostgreSQL (:5432) & Redis (:6379) berjalan di 0.0.0.0 (WSL2)."
echo "IP VM WSL2 (NAT) saat ini: ${VM_IP}"
echo ""
echo "Langkah berikutnya dari Windows (PowerShell):"
echo "  1. Pastikan .env di repo root menunjuk ke IP di atas:"
echo "       DATABASE_URL=postgresql://apii:apii@${VM_IP}:5432/apii_jabo"
echo "       REDIS_URL=redis://${VM_IP}:6379"
echo "  2. Cegah WSL idle-shutdown (wajib, sekali per sesi):"
echo "       Start-Process wsl -ArgumentList '-d','Ubuntu','--','exec','sleep','infinity' -WindowStyle Hidden"
echo "  3. Jalankan migrasi & seed:"
echo "       npm run migrate:deploy; npm run seed"
echo "  4. Jalankan app:"
echo "       npm run dev                        # backend :3000"
echo "       cd frontend; npm run dev           # SPA :5173"
