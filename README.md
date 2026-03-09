# Eid Namaz & Mosque Locator (Open Access)

A community-driven platform to find and verify Eid prayer locations and timings. No registration required.

## Features

- **Interactive Map**: View mosques and prayer times on a map.
- **Open Submissions**: Anyone can submit new mosque locations.
- **Verification System**: Users can vote on the accuracy of mosque information (limited to once per mosque per browser).
- **Real-time Updates**: New submissions and votes appear instantly via WebSockets.
- **Multilingual**: Support for English and Bengali.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

## API Documentation

- `GET /api/mosques`: Get all mosques.
- `POST /api/mosques`: Submit a new mosque.
- `POST /api/votes`: Vote on a mosque's accuracy.
