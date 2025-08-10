#!/bin/bash

# Price Tracker Database Restore Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
BACKUP_DIR="./backups"

# Check if backup file is provided
if [ -z "$1" ]; then
    log_error "Usage: $0 <backup_file>"
    log_info "Available backups:"
    ls -la "$BACKUP_DIR"/pricetracker_backup_*.sql.gz 2>/dev/null || log_info "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try to find it in backup directory
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

log_info "Restoring from backup: $BACKUP_FILE"

# Check if Docker Compose is running
if ! docker-compose ps | grep -q "pricetracker_database"; then
    log_error "Database container is not running. Please start the services first."
    exit 1
fi

# Warning about data loss
log_warning "⚠️  WARNING: This will replace ALL existing data in the database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log_info "Restore cancelled."
    exit 0
fi

# Create a backup of current data before restore
log_info "Creating backup of current data before restore..."
CURRENT_BACKUP="./backups/pre_restore_backup_$(date +"%Y%m%d_%H%M%S").sql"
docker-compose exec -T database pg_dump -U postgres -d pricetracker > "$CURRENT_BACKUP"
log_success "Current data backed up to: $CURRENT_BACKUP"

# Stop the application to prevent data corruption
log_info "Stopping application services..."
docker-compose stop app

# Decompress backup if needed
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "Decompressing backup file..."
    RESTORE_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
fi

# Drop and recreate database
log_info "Recreating database..."
docker-compose exec -T database psql -U postgres -c "DROP DATABASE IF EXISTS pricetracker;"
docker-compose exec -T database psql -U postgres -c "CREATE DATABASE pricetracker;"

# Restore database
log_info "Restoring database from backup..."
docker-compose exec -T database psql -U postgres -d pricetracker < "$RESTORE_FILE"

# Clean up decompressed file if it was created
if [[ "$BACKUP_FILE" == *.gz ]] && [ -f "$RESTORE_FILE" ]; then
    rm "$RESTORE_FILE"
fi

# Start the application
log_info "Starting application services..."
docker-compose start app

# Wait for application to be ready
log_info "Waiting for application to be ready..."
sleep 10

# Check health
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    log_success "Application is healthy after restore!"
else
    log_error "Application health check failed after restore. Check logs with: docker-compose logs app"
    exit 1
fi

log_success "🎉 Database restore completed successfully!"
log_info "📊 Application is available at: http://localhost:3001"
log_info "🔍 Check logs with: docker-compose logs -f"