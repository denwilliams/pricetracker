# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Online Store Price Tracker** application similar to 3camels but designed to work with any online store. The project is currently in the planning/concept stage with only a README file present - no implementation has been created yet.

## Technology Stack (Planned)

- **Backend**: Node.js with Hono (fast web framework)
- **Frontend**: React with Vite
- **Database**: PostgreSQL with Drizzle ORM
- **Notifications**: Pushover API for price drop alerts

## Project Status

**⚠️ Important**: This is a greenfield project with no implementation yet. The codebase currently contains only a README.md file describing the intended functionality.

## When Starting Development

Since this project needs to be built from scratch, the initial setup will require:

1. Initialize git repository: `git init`
2. Set up Node.js project: `npm init -y`
3. Install dependencies for the planned tech stack:
   - Hono for backend API
   - React for frontend
   - PostgreSQL client library
   - Pushover client for notifications
4. Set up project structure with separate directories for frontend/backend
5. Configure database connection and create initial schemas
6. Set up build and development scripts

## Intended Features

- Track prices across multiple online stores
- Send notifications when prices drop below thresholds
- Display price history charts
- Personal use application (no authentication required)

## Architecture Notes

Based on the planned technology stack, the application should follow a typical full-stack pattern:
- Hono backend API for price tracking logic and data management
- React frontend for user interface and price visualization  
- PostgreSQL database for storing product information and price history
- Background jobs/scheduling for periodic price checking
- Pushover integration for real-time notifications