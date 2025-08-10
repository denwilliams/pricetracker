#!/bin/bash

# Price Tracker Deployment Script
set -e

echo "🚀 Starting Price Tracker deployment..."

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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Set environment
ENVIRONMENT=${1:-production}
log_info "Deploying to environment: $ENVIRONMENT"

# Create necessary directories
log_info "Creating necessary directories..."
mkdir -p logs ssl

# Copy environment file
if [ -f ".env.$ENVIRONMENT" ]; then
    log_info "Using environment file: .env.$ENVIRONMENT"
    cp ".env.$ENVIRONMENT" .env
elif [ -f ".env.example" ]; then
    log_warning "No .env.$ENVIRONMENT found, copying from .env.example"
    cp .env.example .env
else
    log_error "No environment configuration found. Please create .env.$ENVIRONMENT or .env.example"
    exit 1
fi

# Build and start services
log_info "Building Docker images..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

$COMPOSE_CMD down --remove-orphans
$COMPOSE_CMD build --no-cache

log_info "Starting services..."
$COMPOSE_CMD up -d database

# Wait for database to be ready
log_info "Waiting for database to be ready..."
until $COMPOSE_CMD exec database pg_isready -U postgres; do
    log_info "Waiting for database..."
    sleep 2
done

log_success "Database is ready!"

# Run database migrations
log_info "Running database migrations..."
$COMPOSE_CMD run --rm app npm run db:generate
$COMPOSE_CMD run --rm app npm run db:migrate

# Seed initial data
log_info "Seeding database with initial store data..."
$COMPOSE_CMD run --rm app npm run db:seed

# Start the application
log_info "Starting Price Tracker application..."
$COMPOSE_CMD up -d app

# Wait for app to be ready
log_info "Waiting for application to be ready..."
sleep 10

# Check health
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    log_success "Application is healthy!"
else
    log_error "Application health check failed. Check logs with: $COMPOSE_CMD logs app"
    exit 1
fi

# Start nginx if in production
if [ "$ENVIRONMENT" = "production" ]; then
    log_info "Starting Nginx reverse proxy..."
    $COMPOSE_CMD --profile production up -d nginx
fi

log_success "🎉 Price Tracker deployment completed successfully!"
log_info "📊 Access the application at: http://localhost:3001"
log_info "🔍 View logs with: $COMPOSE_CMD logs -f"
log_info "🛑 Stop services with: $COMPOSE_CMD down"

# Show running services
log_info "Running services:"
$COMPOSE_CMD ps