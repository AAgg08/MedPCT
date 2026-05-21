import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load .env and .env.local
dotenv.config();
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3001;

// Add JSON body parsing middleware
app.use(express.json());

// Lazy initialization of Supabase
let supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.warn("⚠️ SUPABASE_URL or SUPABASE_ANON_KEY is missing. Supabase inserts will fail.");
    }
    supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');
  }
  return supabase;
}

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

    let riskScore = Math.round((wWind * normWind) + (wPrecip * normPrecip) + (wTraffic * normTraffic) + (wCargo * cargoRisk));

    const gradient = terrainGradient || 0;
    if (gradient > 10) {
      riskScore += 30;
    } else if (gradient > 5) {
      riskScore += 15;
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

    res.json({ riskScore });
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

// Production fallback
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Express API Server running on port ${PORT}`);
});
