import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env and .env.local
dotenv.config();
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Add JSON body parsing middleware
app.use(express.json());

// Add CORS middleware - allow requests from Vercel frontend
app.use(cors({
  origin: ['https://med-pct.vercel.app', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Lazy initialization of Supabase
let supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.warn("SUPABASE_URL or SUPABASE_ANON_KEY is missing. Supabase inserts will fail.");
    }
    supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');
  }
  return supabase;
}

// In-memory helipad status store (overrides for the session)
type HelipadStatus = 'OPEN' | 'CLOSED';
const helipadStatusOverrides: Record<string, HelipadStatus> = {};

// Helper: load helipads from public/helipads.json and apply status overrides
function loadHelipads(): any[] {
  try {
    // On Render, process.cwd() is /opt/render/project/src
    const helipadPath = path.join(process.cwd(), 'public', 'helipads.json');
    if (!fs.existsSync(helipadPath)) {
      console.warn('helipads.json not found at:', helipadPath);
      return [];
    }
    const raw = fs.readFileSync(helipadPath, 'utf-8');
    const geojson = JSON.parse(raw);
    const features = geojson.features || [];
    return features.map((f: any) => ({
      id: f.properties.id,
      name: f.properties.name,
      city: f.properties.city,
      state: f.properties.state,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      status: helipadStatusOverrides[f.properties.id] || 'OPEN',
    }));
  } catch (err) {
    console.error('Error loading helipads.json:', err);
    return [];
  }
}

// Helper: Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/helipads - returns all helipads with current status
app.get("/api/helipads", (req, res) => {
  const helipads = loadHelipads();
  res.json(helipads);
});

// POST /api/helipads/status - update helipad status override
app.post("/api/helipads/status", (req, res) => {
  const { id, status } = req.body;
  if (!id || !['OPEN', 'CLOSED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid id or status. Status must be OPEN or CLOSED.' });
  }
  helipadStatusOverrides[id] = status as HelipadStatus;
  res.json({ success: true, id, status });
});

// POST /api/evaluate - risk scoring + nearest helipad
app.post("/api/evaluate", async (req, res) => {
  try {
    const { lat, lng, windSpeed, precipitation, trafficDelay, cargoType, terrainGradient } = req.body;

    // Weighted Additive Model
    const wWind = 0.3;
    const wPrecip = 0.3;
    const wTraffic = 0.2;
    const wCargo = 0.2;

    const normWind = Math.min(100, ((windSpeed || 0) / 50) * 100);
    const normPrecip = Math.min(100, ((precipitation || 0) / 20) * 100);
    const normTraffic = Math.min(100, ((trafficDelay || 0) / 60) * 100);

    // Cargo risk mapping
    const isHighRiskCargo = ['Hazardous/Fragile', 'Hazardous', 'Fragile', 'Critical', 'Hazmat'].includes(cargoType);
    const cargoRisk = isHighRiskCargo ? 80 : 20;

    let riskScore = Math.round(
      (wWind * normWind) + (wPrecip * normPrecip) + (wTraffic * normTraffic) + (wCargo * cargoRisk)
    );

    const gradient = terrainGradient || 0;
    if (gradient > 10) {
      riskScore += 30;
    } else if (gradient > 5) {
      riskScore += 15;
    }
    riskScore = Math.min(100, riskScore);

    // Find nearest helipad to destination
    const helipads = loadHelipads();
    let nearestPad: any = null;
    let nearestDist = Infinity;
    if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      for (const pad of helipads) {
        const dist = haversineKm(Number(lat), Number(lng), pad.lat, pad.lng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPad = { ...pad, distance: dist };
        }
      }
    }

    const payload = {
      lat,
      lng,
      wind_speed: windSpeed,
      precipitation,
      traffic_delay: trafficDelay,
      cargo_type: cargoType,
      risk_score: riskScore,
      details: { terrain_gradient: gradient }
    };

    // Log evaluation to Supabase
    const db = getSupabase();
    if (process.env.SUPABASE_URL) {
      const { error } = await db
        .from('risk_evaluations')
        .insert([payload]);
      if (error) {
        console.error("Supabase insert error:", JSON.stringify(error, null, 2));
      }
    }

    res.json({ riskScore, nearestPad });
  } catch (error) {
    console.error("Error evaluating risk:", error);
    res.status(500).json({ error: "Internal server error during evaluation" });
  }
});

app.get("/api/weather", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: "Missing lat or lng" });
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,wind_speed_10m`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch weather data from Open-Meteo");
    }
    const data = await response.json();
    res.json({
      wind_speed: data.current.wind_speed_10m,
      precipitation: data.current.precipitation
    });
  } catch (error) {
    console.error("Error fetching weather telemetry:", error);
    res.status(500).json({ error: "Internal server error connecting to weather API" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Express API Server running on port ${PORT}`);
});
