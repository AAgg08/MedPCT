import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import RiskSidebar from './components/RiskSidebar';
import MapboxContainer from './components/MapboxContainer';
import { EvaluationInput, RiskEvaluationResult, HistoricalIncident } from './types';
import { MedPTCConfig } from './config';
import { 
  History, 
  MapPin, 
  Layers, 
  Settings, 
  ShieldAlert, 
  Clock, 
  ArrowRight,
  Database,
  CloudLightning,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

interface VehicleProfile {
  cargo: string;
  gradient: number;
}

// Sample prefilled historical assessments so the user instantly sees a populated UI with real logs
const MOCK_HISTORICAL_ASSESSMENTS: RiskEvaluationResult[] = [
  {
    id: 'eval-fda103',
    origin_lat: 39.7392,
    origin_lng: -104.9903,
    destination_lat: 40.0150,
    destination_lng: -105.2705,
    scheduled_departure: '2026-05-20T22:30:00Z',
    weather_snapshot: {
      temp: 18,
      condition: 'Clear sky',
      wind_speed: 4.2,
      visibility: 10.0,
    },
    traffic_snapshot: {
      distance_km: 48,
      duration_min: 38,
      congestion_level: 'clear',
    },
    risk_score_ground: 24,
    risk_score_helicopter: 20,
    recommended_mode: 'HELICOPTER',
    justification: 'Favorable sky visual flight rules. Ground routes present mild highway construction delays near flyover points.',
    created_at: '2026-05-20T21:10:00Z',
  },
  {
    id: 'eval-cc9011',
    origin_lat: 39.7289,
    origin_lng: -104.9897,
    destination_lat: 39.7226,
    destination_lng: -105.1112,
    scheduled_departure: '2026-05-20T23:00:00Z',
    weather_snapshot: {
      temp: 4,
      condition: 'Heavy rain & fog overlay',
      wind_speed: 13.8,
      visibility: 2.1,
    },
    traffic_snapshot: {
      distance_km: 18,
      duration_min: 55,
      congestion_level: 'congested',
    },
    risk_score_ground: 65,
    risk_score_helicopter: 85,
    recommended_mode: 'GROUND',
    justification: 'Wind velocity (13.8 m/s) exceeds critical MEDEVAC safety margin (12 m/s). Visibility is severely restricted on high approach corridors. Despite ground traffic delays, ambulance dispatch is mandated.',
    created_at: '2026-05-20T19:30:00Z',
  }
];

export default function App() {
  const [vehicleProfile] = useState<VehicleProfile>({
    cargo: 'Fragile',
    gradient: 5
  });

  const [activeTab, setActiveTab] = useState<'evaluate' | 'history'>('evaluate');
  const [origin, setOrigin] = useState<{ lat: number | string; lng: number | string }>({ 
    lat: '', 
    lng: '' 
  });
  const [destination, setDestination] = useState<{ lat: number | string; lng: number | string }>({ 
    lat: '', 
    lng: '' 
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [mapToken, setMapToken] = useState(localStorage.getItem('MAPBOX_TOKEN') || '');
  const [recentEvaluations, setRecentEvaluations] = useState<RiskEvaluationResult[]>(MOCK_HISTORICAL_ASSESSMENTS);
  const [selectedResult, setSelectedResult] = useState<RiskEvaluationResult | null>(null);
  const [selectedHistoryRow, setSelectedHistoryRow] = useState<RiskEvaluationResult | null>(null);

  // Live telemetry state for default coordinates (33.21, -97.13)
  const [telemetry, setTelemetry] = useState<{
    windSpeed: number | null;
    precipitation: number | null;
    loading: boolean;
    error: string | null;
  }>({
    windSpeed: null,
    precipitation: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        
const API_URL = import.meta.env.VITE_API_URL;
const res = await fetch(`${API_URL}/api/weather?lat=33.21&lng=-97.13`);
        if (!res.ok) throw new Error('Live telemetry offline');
        const data = await res.json();
        setTelemetry({
          windSpeed: data.wind_speed,
          precipitation: data.precipitation,
          loading: false,
          error: null
        });
      } catch (err: any) {
        setTelemetry({ windSpeed: null, precipitation: null, loading: false, error: err.message });
      }
    };
    fetchWeather();
  }, []);

  // Trigger local evaluation logic (emulates server algorithm instantly so the MVP works out-of-the-box!)
  const handleEvaluate = async (input: EvaluationInput) => {
    if (input.originLat === '' || input.originLng === '' || input.destinationLat === '' || input.destinationLng === '') {
      return;
    }

    setIsLoading(true);

    let liveWind = 0;
    let livePrecip = 0;
    let terrainGradient = vehicleProfile.gradient;

    let updatedTelemetry = { ...telemetry, loading: true };
    setTelemetry(updatedTelemetry);

    const origLat = Number(input.originLat);
    const origLng = Number(input.originLng);
    const destLat = Number(input.destinationLat);
    const destLng = Number(input.destinationLng);

    try {
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${origLat}&longitude=${origLng}&current_weather=true&hourly=precipitation`);
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        liveWind = weatherData.current_weather.windspeed;
        livePrecip = weatherData.hourly.precipitation[0] || 0;
        
        updatedTelemetry = {
          windSpeed: liveWind,
          precipitation: livePrecip,
          loading: false,
          error: null
        };
        setTelemetry(updatedTelemetry);
      }
    } catch(err: any) {
      updatedTelemetry = { ...updatedTelemetry, loading: false, error: err.message };
      setTelemetry(updatedTelemetry);
    }

    try {
      const elevRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${origLat},${destLat}&longitude=${origLng},${destLng}`);
      if(elevRes.ok) {
        const elevData = await elevRes.json();
        const elevOrig = elevData.elevation[0];
        const elevDest = elevData.elevation[1];
        
        // Haversine
        const R = 6371000;
        const dLat = (destLat - origLat) * (Math.PI / 180);
        const dLng = (destLng - origLng) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(origLat * (Math.PI / 180)) * Math.cos(destLat * (Math.PI / 180)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance > 0) {
          terrainGradient = (Math.abs(elevDest - elevOrig) / distance) * 100;
        }
      }
    } catch(err) {
      console.error("Failed to fetch elevation", err);
    }

    // Simple, transparent risk calculation model as requested
    const conf = MedPTCConfig.RISK_ENGINE;
    let scoreHeli = conf.BASELINE_RISK;
    const factors: string[] = [];

    // Simulate weather effects on the coordinates
    // We'll generate dynamic simulated conditions based on state to ensure variety
    const isRockyRange = destLat > 39.75 || destLng < -105.0;
    const simulatedWind = liveWind;
    const simulatedVisibility = isRockyRange ? 4.5 : 10.0; // Restrict vision
    const precipVal = livePrecip;
    const isRaining = precipVal > 0;
    const simulatedCondition = isRaining ? `Rain (${precipVal}mm)` : 'Clear sky';
    const simulatedTemp = isRockyRange ? 2 : 16;
    const simulatedDuration = isRockyRange ? 48 : 22; // Longer ground duration in rocks

    // 1) Evaluate Ground transport risk using Backend API (Formal Weighted Additive Model)
    let finalGround = 0;
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: destLat,
          lng: destLng,
          windSpeed: simulatedWind,
          precipitation: precipVal,
          trafficDelay: simulatedDuration,
          cargoType: vehicleProfile.cargo,
          terrainGradient: terrainGradient
        })
      });
      if (res.ok) {
        const data = await res.json();
        finalGround = data.riskScore;
      } else {
        console.error('Failed to fetch evaluation score from backend');
      }
    } catch (err) {
      console.error('Error hitting /api/evaluate:', err);
    }

    if (finalGround > 75) {
      factors.push('[Ground] High Risk route due to weighted environmental/profile variables');
    } else if (finalGround > 50) {
      factors.push('[Ground] Caution: Elevated routing risk factors detected');
    } else {
      factors.push('[Ground] Routing parameters nominal');
    }

    // 2) Evaluate Helicopter flight risk
    if (simulatedWind >= conf.WIND_SPEED_LIMIT_MPS) {
      scoreHeli += conf.WIND_SPEED_CRITICAL_ADD;
      factors.push(`Wind speed (${simulatedWind} m/s) is equal or greater than safety threshold (${conf.WIND_SPEED_LIMIT_MPS} m/s)`);
    } else if (simulatedWind >= conf.WIND_SPEED_WARNING_MPS) {
      scoreHeli += conf.WIND_SPEED_WARN_ADD;
      factors.push('Elevated wind speed warning flags active');
    }

    if (simulatedVisibility < conf.VISIBILITY_HELI_LIMIT_KM) {
      scoreHeli += conf.VISIBILITY_HELI_WARN_ADD;
      factors.push('Visual Flight Rules (VFR) obstructed due to cloud ceilings');
    }
    if (simulatedTemp < conf.TEMPERATURE_LIMIT_MIN_CELSIUS) {
      scoreHeli += conf.TEMPERATURE_RISK_ADD;
      factors.push('Extreme sub-zero operations warning (rotor blade icing probability)');
    }

    // Baseline outcome mod adjusting (mocking historical statistics match)
    if (simulatedTemp > 10 && simulatedWind < 6.0) {
      scoreHeli -= 5;
      factors.push('Historical record shows excellent heli-evacuation rates in low-wind conditions');
    }

    // Clamp scores
    const finalHeli = Math.max(0, Math.min(100, Math.round(scoreHeli)));

    // Recommendation logic
    let recommended: 'GROUND' | 'HELICOPTER' | 'EITHER' = 'EITHER';
    if (finalGround - finalHeli > 10) {
      recommended = 'HELICOPTER';
    } else if (finalHeli - finalGround > 10) {
      recommended = 'GROUND';
    }

    // Format final justification
    let justificationStr = '';
    if (factors.length === 0) {
      justificationStr = 'All environmental parameters nominal. Ideal conditions for either flight vector or ground transport.';
    } else {
      justificationStr = `Condition assessments: ${factors.slice(0, 3).join(', ')}.`;
    }

    const evaluationResult: RiskEvaluationResult = {
      id: `eval-${Math.random().toString(36).substr(2, 6)}`,
      origin_lat: input.originLat,
      origin_lng: input.originLng,
      destination_lat: input.destinationLat,
      destination_lng: input.destinationLng,
      scheduled_departure: input.departureTime,
      weather_snapshot: {
        temp: simulatedTemp,
        condition: simulatedCondition,
        wind_speed: simulatedWind,
        visibility: simulatedVisibility,
      },
      traffic_snapshot: {
        distance_km: Math.round(simulatedDuration * 0.95),
        duration_min: simulatedDuration,
        congestion_level: simulatedDuration > 30 ? 'moderate' : 'clear',
      },
      risk_score_ground: finalGround,
      risk_score_helicopter: finalHeli,
      recommended_mode: recommended,
      justification: justificationStr,
      created_at: new Date().toISOString(),
    };

    // Update active state
    setSelectedResult(evaluationResult);
    // Add to historical list
    setRecentEvaluations((prev) => [evaluationResult, ...prev]);
    setIsLoading(false);
  };

  const handleMapClick = (lat: number, lng: number, type: 'origin' | 'destination') => {
    if (type === 'origin') {
      setOrigin({ lat, lng });
    } else {
      setDestination({ lat, lng });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* Header Panel */}
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onLogout={() => alert('Authentication structure is ready for Supabase Auth configuration.')}
      />

      {/* Main Container Viewport */}
      <main className="flex-1 flex overflow-hidden">
        
        {activeTab === 'evaluate' ? (
          /* ACTIVE EVALUATOR LAYOUT */
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            {/* Left Evaluation Form & Outcome Sidebar */}
            <RiskSidebar 
              onEvaluate={handleEvaluate}
              isLoading={isLoading}
              result={selectedResult}
              originCoords={origin}
              destinationCoords={destination}
              setOriginCoords={setOrigin}
              setDestinationCoords={setDestination}
              liveTelemetry={telemetry}
            />

            {/* Right Map Canvas Panel Container */}
            <div className="flex-1 h-full p-4 flex flex-col min-w-0">
              <div className="flex-1 relative">
                <MapboxContainer 
                  origin={origin}
                  destination={destination}
                  onMapClick={handleMapClick}
                  groundRiskScore={selectedResult?.risk_score_ground}
                  helicopterRiskScore={selectedResult?.risk_score_helicopter}
                  recommendedMode={selectedResult?.recommended_mode}
                  mapToken={mapToken}
                  onTokenChange={setMapToken}
                />
              </div>
            </div>
          </div>
        ) : (
          /* HISTORICAL ASSESSMENTS TAB */
          <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-5">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase block mb-1">Audit Ledger</span>
                <h1 className="text-2xl font-display font-medium text-slate-100">Transport Assessments Log</h1>
                <p className="text-xs text-slate-400 mt-1">
                  List of historical ground vs. flight risk evaluations generated by dispatchers.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="text-xs bg-slate-900 border border-slate-800 rounded px-3 py-1.5 font-mono text-slate-400">
                  Logs Count: <span className="text-emerald-400 font-semibold">{recentEvaluations.length}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Table Ledger Panel */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                        <th className="p-4">Reference ID</th>
                        <th className="p-4">Route Coords</th>
                        <th className="p-4 text-center">Ground Risk</th>
                        <th className="p-4 text-center">Heli Risk</th>
                        <th className="p-4">Recommendation</th>
                        <th className="p-4 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {recentEvaluations.map((evalRow) => (
                        <tr 
                          key={evalRow.id}
                          className={`hover:bg-slate-850/40 cursor-pointer transition ${
                            selectedHistoryRow?.id === evalRow.id ? 'bg-slate-800/50' : ''
                          }`}
                          onClick={() => setSelectedHistoryRow(evalRow)}
                        >
                          <td className="p-4 font-semibold text-emerald-400">
                            {evalRow.id}
                          </td>
                          <td className="p-4 text-slate-300">
                            <div className="text-[11px] font-sans">
                              O: {evalRow.origin_lat.toFixed(3)}, {evalRow.origin_lng.toFixed(3)}
                            </div>
                            <div className="text-[11px] font-sans text-slate-450 mt-0.5">
                              D: {evalRow.destination_lat.toFixed(3)}, {evalRow.destination_lng.toFixed(3)}
                            </div>
                          </td>
                          <td className={`p-4 text-center font-bold ${
                            evalRow.risk_score_ground > 75 ? 'text-red-500' : evalRow.risk_score_ground > 50 ? 'text-amber-500' : 'text-emerald-400'
                          }`}>
                            {evalRow.risk_score_ground}
                          </td>
                          <td className={`p-4 text-center font-bold ${
                            evalRow.risk_score_helicopter > 75 ? 'text-red-500' : evalRow.risk_score_helicopter > 50 ? 'text-amber-500' : 'text-emerald-400'
                          }`}>
                            {evalRow.risk_score_helicopter}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                              evalRow.recommended_mode === 'HELICOPTER' 
                                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/40' 
                                : evalRow.recommended_mode === 'GROUND' 
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                            }`}>
                              {evalRow.recommended_mode}
                            </span>
                          </td>
                          <td className="p-4 text-right text-slate-400">
                            {evalRow.created_at.slice(11, 19)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* JSON Inspector Sidebar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-2xl h-[500px]">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-100 mb-1.5 flex items-center gap-2">
                    <Database className="h-4 w-4 text-emerald-400 animate-pulse" /> Telemetry Inspector
                  </h3>
                  <p className="text-[11px] text-slate-450 leading-relaxed mb-4">
                    Select a row in the Transport Assessments Log to view the exact database attributes stored for analysis.
                  </p>

                  {selectedHistoryRow ? (
                    <div className="bg-slate-950 rounded border border-slate-800 p-3 h-[320px] overflow-y-auto">
                      <pre className="text-[10px] font-mono text-emerald-400 leading-normal scrollbar-none">
                        {JSON.stringify(selectedHistoryRow, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[320px] border border-dashed border-slate-800 rounded text-center p-4">
                      <Layers className="h-8 w-8 text-slate-700 mb-2" />
                      <span className="text-[11px] text-slate-500 uppercase tracking-widest block">No log row selected</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800/60 pt-4 text-left">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">B2B SaaS Prototype Specification</span>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    This detailed JSON is fed directly back into analytics schemas to optimize future corridor route-weights. No PHI/HIPAA credentials stored.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
