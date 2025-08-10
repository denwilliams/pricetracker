#!/bin/bash

# Price Tracker Database Backup Script
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

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="pricetracker_backup_$DATE.sql"
CONTAINER_NAME="pricetracker_database_1"

# Check if Docker Compose is running
if ! docker-compose ps | grep -q "pricetracker_database"; then
    log_error "Database container is not running. Please start the services first."
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

log_info "Starting database backup..."
log_info "Backup file: $BACKUP_DIR/$BACKUP_FILE"

# Create database backup
docker-compose exec -T database pg_dump -U postgres -d pricetracker > "$BACKUP_DIR/$BACKUP_FILE"

# Check if backup was successful
if [ -s "$BACKUP_DIR/$BACKUP_FILE" ]; then
    log_success "Database backup completed successfully!"
    log_info "Backup saved to: $BACKUP_DIR/$BACKUP_FILE"
    log_info "Backup size: $(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)"
else
    log_error "Backup failed or resulted in empty file"
    rm -f "$BACKUP_DIR/$BACKUP_FILE"
    exit 1
fi

# Compress backup
log_info "Compressing backup..."
gzip "$BACKUP_DIR/$BACKUP_FILE"
COMPRESSED_FILE="$BACKUP_DIR/$BACKUP_FILE.gz"

if [ -f "$COMPRESSED_FILE" ]; then
    log_success "Backup compressed successfully!"
    log_info "Compressed backup: $COMPRESSED_FILE"
    log_info "Compressed size: $(du -h "$COMPRESSED_FILE" | cut -f1)"
else
    log_error "Compression failed"
    exit 1
fi

# Clean up old backups (keep last 7 days)
log_info "Cleaning up old backups (keeping last 7 days)..."
find "$BACKUP_DIR" -name "pricetracker_backup_*.sql.gz" -type f -mtime +7 -delete
log_success "Cleanup completed!"

# Show available backups
log_info "Available backups:"
ls -lah "$BACKUP_DIR"/pricetracker_backup_*.sql.gz 2>/dev/null || log_info "No backups found"

log_success "🎉 Backup process completed!"