/**
 * MedPTC System Configuration & Constants
 */

export const MedPTCConfig = {
  // Mapbox & Coordinates Default configuration
  MAPBOX: {
    // Default Map position centered around a realistic EMS flight/ambulance zone (e.g., Denver/Colorado rocky region)
    DEFAULT_CENTER: [-98.5795, 39.8283] as [number, number],
    DEFAULT_ZOOM: 4,
    STYLE: 'mapbox://styles/mapbox/dark-v11',
  },

  // Tactical Routing Defaults
  DEFAULT_COORDINATES: {
    // Denver Health Medical Center
    ORIGIN: {
      lat: 39.7289,
      lng: -104.9897,
      name: 'Origin (Denver Trauma Center)',
    },
    // Rocky Mountain Heliport / Suburban St. Anthony
    DESTINATION: {
      lat: 39.7226,
      lng: -105.1112,
      name: 'Destination (Suburban Trauma Center)',
    },
  },

  // Risk Scoring Engine Weights and Thresholds
  RISK_ENGINE: {
    BASELINE_RISK: 20, // Baseline start score

    // Ground Risks
    WEATHER_RAIN_RISK_ADD: 15,
    WEATHER_SNOW_RISK_ADD: 30,
    WEATHER_FOG_RISK_ADD: 25,
    VISIBILITY_THRESHOLD_KM: 3.0, // Below this added risk
    VISIBILITY_CRITICAL_ADD: 20,
    TRAFFIC_CONGESTION_MINUTES_ADD: 25,

    // Helicopter Risks
    WIND_SPEED_LIMIT_MPS: 12.0, // Critical limit for helis (24 knots / 27 mph / 12 mps)
    WIND_SPEED_WARNING_MPS: 8.0, // Advisory limit
    WIND_SPEED_WARN_ADD: 20,
    WIND_SPEED_CRITICAL_ADD: 50,
    VISIBILITY_HELI_LIMIT_KM: 5.0, // Helis need better visual flight rules (VFR)
    VISIBILITY_HELI_WARN_ADD: 30,
    TEMPERATURE_LIMIT_MIN_CELSIUS: -10, // Extreme cold / icing probability
    TEMPERATURE_LIMIT_MAX_CELSIUS: 40,
    TEMPERATURE_RISK_ADD: 15,

    // Historical Modifier Adjustment Scale
    HISTORICAL_CORRECTION_MAX: 10, // Max modification points based on historical matches
  },

  // API Route definitions
  API_ENDPOINTS: {
    EVALUATE: '/api/risk/evaluate',
    HISTORY: '/api/risk/history',
    SEED: '/api/seed/historical-incidents',
  },
};
