/**
 * MedFlight EMS Tactical Decision Support Types
 */

export type TransportMode = 'GROUND' | 'HELICOPTER' | 'EITHER';

export interface EvaluationInput {
  originLat: number | string;
  originLng: number | string;
  destinationLat: number | string;
  destinationLng: number | string;
  departureTime: string;
}

export interface HistoricalIncident {
  id: string;
  location_lat: number;
  location_lng: number;
  road_type: 'highway' | 'rural' | 'urban';
  weather_condition: 'clear' | 'rain' | 'snow' | 'fog';
  visibility_km: number;
  wind_speed_mps: number;
  time_of_day: 'day' | 'night';
  incident_severity: number; // 1 to 5
  transport_mode: 'GROUND' | 'HELICOPTER';
  outcome: 'good' | 'poor' | 'death';
  created_at: string;
}

export interface RiskEvaluationResult {
  id: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  scheduled_departure: string;
  weather_snapshot: {
    temp: number;
    condition: string;
    wind_speed: number;
    visibility: number;
    precipitation_mm?: number;
    alerts?: string[];
  };
  traffic_snapshot: {
    distance_km: number;
    duration_min: number;
    congestion_level: 'clear' | 'moderate' | 'congested';
  };
  risk_score_ground: number;
  risk_score_helicopter: number;
  recommended_mode: TransportMode;
  justification: string;
  created_at: string;
}
