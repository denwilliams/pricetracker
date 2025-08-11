#!/bin/bash
set -e

echo "🚀 Starting Price Tracker..."

# Check if database is accessible
echo "🔍 Checking database connectivity..."
until npm run db:migrate 2>/dev/null; do
    echo "⏳ Database not ready, waiting 5 seconds..."
    sleep 5
done

echo "✅ Database is ready"

# Start the application
echo "🏃 Starting application..."
exec npm start