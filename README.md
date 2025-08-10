## Online Store Price Tracker

> [!WARNING]
> AI generated project.


A comprehensive price tracking application similar to CamelCamelCamel but designed to work with any online store. This personal-use application monitors product prices across multiple retailers and sends notifications when prices drop below your target thresholds.

## Features

- 🛒 **Universal Store Support** - Track prices from any online store (JB Hi-Fi, Amazon, specialty retailers, etc.)
- 📊 **Price History Charts** - Interactive charts showing price trends over time
- 🎯 **Target Price Alerts** - Set target prices and get notified when reached
- 📱 **Smart Notifications** - Pushover integration with intelligent alerting (no spam)
- 🔄 **Automated Monitoring** - Checks prices every 30 minutes automatically
- 📦 **Stock Availability** - Tracks whether products are in stock
- 🎨 **Clean Interface** - Modern React UI with Tailwind CSS
- 🔍 **Advanced Scraping** - Uses JSON-LD structured data and fallback methods

## Technology Stack

- **Backend**: Node.js with Hono (fast web framework)
- **Frontend**: React with Vite and Tailwind CSS
- **Database**: PostgreSQL with Drizzle ORM
- **Scraping**: Puppeteer and Cheerio
- **Notifications**: Pushover API
- **Deployment**: Docker support with automated scripts

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Pushover account (for notifications)

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd pricetracker
npm install
cd client && npm install && cd ..
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your database and Pushover credentials
```

3. **Set up database:**
```bash
npm run db:migrate
npm run db:seed  # Optional: adds sample data
```

4. **Start development servers:**
```bash
npm run dev:all  # Starts both backend and frontend
```

Visit http://localhost:5173 for the web interface.

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/pricetracker
PUSHOVER_TOKEN=your_pushover_app_token
PUSHOVER_USER=your_pushover_user_key
```

## Usage

1. **Add Products**: Paste any product URL to start tracking
2. **Set Target Prices**: Define your ideal price point for notifications
3. **Monitor**: The system checks prices every 30 minutes
4. **Get Alerts**: Receive Pushover notifications when targets are reached

## Supported Stores

The scraper works with most online stores by:
- Parsing JSON-LD structured data (preferred)
- Using store-specific CSS selectors for major retailers
- Fallback generic price detection methods

Tested stores include JB Hi-Fi, Amazon, specialty retailers, and more.

## API Endpoints

- `GET /api/products` - List all tracked products
- `POST /api/products` - Add new product to track
- `GET /api/products/:id/history` - Get price history
- `POST /api/scrape` - Manual price check
- `GET /api/system/status` - Health check

## Development

### Available Scripts

```bash
npm run dev          # Start backend only
npm run dev:client   # Start frontend only  
npm run dev:all      # Start both (recommended)
npm run build        # Build for production
npm run test         # Run tests
npm run db:studio    # Open database GUI
```

### Project Structure

```
├── src/                 # Backend source
│   ├── routes/          # API endpoints
│   ├── services/        # Core business logic
│   ├── db/             # Database schema and migrations
│   └── index.ts        # Server entry point
├── client/             # React frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── hooks/      # Custom React hooks
│   │   └── types/      # TypeScript definitions
└── test-data/          # Local test pages for development
```

## Recent Updates

- ✅ Fixed availability detection (products no longer incorrectly show as out of stock)
- ✅ Improved notification logic (prevents spam alerts every 30 minutes)
- ✅ Enhanced scraping with JSON-LD structured data parsing
- ✅ Added local test data capture for faster development iteration
- ✅ Redesigned UI with clean, modern Tailwind CSS styling

## Deployment

### Docker

```bash
npm run docker:build
npm run docker:run
```

### Manual Deployment

```bash
npm run build
npm start
```

See deployment scripts in `scripts/` directory for automated deployment options.
