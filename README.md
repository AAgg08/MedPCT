# MedPTC 🚁

**MedPTC** is a full-stack medical air transport planning tool that maps every helipad in the United States using merged FAA and OpenStreetMap (OSM) data. Built for emergency responders, flight planners, and medical logistics teams, MedPTC provides an interactive geospatial interface powered by Mapbox and augmented with AI-driven insights via the Gemini API.

**Live Demo:** [med-pct.vercel.app](https://med-pct.vercel.app)

***

## Features

- 🗺️ **Interactive Helipad Map** — Visualizes 15,419+ helipads across the U.S. sourced from merged FAA and OpenStreetMap datasets
- 🤖 **AI-Powered Insights** — Integrates Google Gemini API to provide contextual information and query support for landing zones
- 📡 **Real-Time Geolocation** — Supports location-based filtering to surface nearby helipads for rapid medical transport planning
- 🌐 **Full-Stack Architecture** — TypeScript frontend (React + Vite) with a Node.js/Express backend deployed on Render, frontend on Vercel
- 🔒 **CORS-Enabled API** — Secure cross-origin communication between frontend and backend services

***

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Mapbox GL JS |
| Backend | Node.js, Express, TypeScript |
| AI | Google Gemini API |
| Data | FAA Helipad Database + OpenStreetMap (merged, 15,419 records) |
| Deployment | Vercel (frontend), Render (backend) |
| Styling | CSS Modules |

***

## Getting Started

### Prerequisites

- Node.js v18+
- A [Mapbox](https://mapbox.com) access token
- A [Google Gemini](https://ai.google.dev) API key

### Installation

```bash
git clone https://github.com/AAgg08/MedPTC.git
cd MedPTC
npm install
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

### Run Locally

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

***

## Data Sources

- **FAA Helipad Database** — Official Federal Aviation Administration records of registered U.S. helipads
- **OpenStreetMap** — Community-sourced helipad location data
- Both datasets are merged and deduplicated into a unified GeoJSON dataset (`helipads.json`) containing 15,419 records

***

## Deployment

The frontend is continuously deployed to **Vercel** on every push to `main`. The backend API is hosted on **Render**.

```bash
# Build for production
npm run build
```

***

## Use Cases

- Emergency medical service (EMS) route planning
- Hospital and trauma center helipad lookup
- Aviation logistics for air ambulance operators
- Research and analysis of U.S. medical air transport infrastructure

***

## License

MIT License — see [LICENSE](LICENSE) for details.
