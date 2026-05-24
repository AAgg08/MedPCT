import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Activity,
  Wind,
  Eye,
  Truck,
  CheckCircle,
  ChevronRight,
  ShieldAlert,
  RefreshCw,
  Calendar,
  Layers,
  MapPin,
  CloudLightning,
  AlertTriangle,
  Search,
  MousePointer
} from 'lucide-react';
import { EvaluationInput, RiskEvaluationResult, Helipad } from '../types';

interface RiskSidebarProps {
  onEvaluate: (input: EvaluationInput) => void;
  isLoading: boolean;
  result: RiskEvaluationResult | null;
  originCoords: { lat: number | string; lng: number | string };
  destinationCoords: { lat: number | string; lng: number | string };
  setOriginCoords: (coords: { lat: number | string; lng: number | string }) => void;
  setDestinationCoords: (coords: { lat: number | string; lng: number | string }) => void;
  liveTelemetry?: {
    windSpeed: number | null;
    precipitation: number | null;
    loading: boolean;
    error: string | null;
  };
  helipads: Helipad[];
  onUpdateHelipadStatus: (id: string, status: 'OPEN' | 'CLOSED') => Promise<void>;
  mapToken?: string;
  settingPoint: 'origin' | 'destination' | null;
  onSetPoint: (type: 'origin' | 'destination' | null) => void;
}

interface GeocodeSuggestion {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

export default function RiskSidebar({
  onEvaluate,
  isLoading,
  result,
  originCoords,
  destinationCoords,
  setOriginCoords,
  setDestinationCoords,
  liveTelemetry,
  helipads = [],
  onUpdateHelipadStatus,
  mapToken = '',
  settingPoint,
  onSetPoint,
}: RiskSidebarProps) {
  // Address search states
  const [originAddress, setOriginAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  
  const originDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const destDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Find nearest helipad dynamically
  const activeDestLat = Number(destinationCoords.lat);
  const activeDestLng = Number(destinationCoords.lng);
  let nearestHelipadId = '';
  let nearestDistance = Infinity;

  if (!isNaN(activeDestLat) && !isNaN(activeDestLng) && activeDestLat !== 0 && activeDestLng !== 0) {
    helipads.forEach((pad) => {
      const dLat = (pad.lat - activeDestLat) * (Math.PI / 180);
      const dLng = (pad.lng - activeDestLng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(activeDestLat * (Math.PI / 180)) *
        Math.cos(pad.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = 6371 * c;

      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestHelipadId = pad.id;
      }
    });
  }

  const [departureTime, setDepartureTime] = useState(
    new Date(Date.now() + 1800000).toISOString().slice(0, 16)
  );

  // Geocoding: Forward (address → coords)
  const geocodeAddress = async (query: string): Promise<GeocodeSuggestion[]> => {
    if (!mapToken || query.length < 3) return [];
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapToken}&limit=5&country=US`
      );
      if (res.ok) {
        const data = await res.json();
        return data.features || [];
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
    return [];
  };

  // Reverse geocoding: coords → address
  const reverseGeocode = async (lng: number, lat: number): Promise<string> => {
    if (!mapToken) return '';
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapToken}&limit=1`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          return data.features[0].place_name;
        }
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
    }
    return '';
  };

  // When originCoords change from outside (map click), reverse-geocode to fill address
  useEffect(() => {
    if (originCoords.lat && originCoords.lng && originCoords.lat !== '' && originCoords.lng !== '') {
      const lat = Number(originCoords.lat);
      const lng = Number(originCoords.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        reverseGeocode(lng, lat).then((addr) => {
          if (addr) setOriginAddress(addr);
        });
      }
    }
  }, [originCoords.lat, originCoords.lng]);

  useEffect(() => {
    if (destinationCoords.lat && destinationCoords.lng && destinationCoords.lat !== '' && destinationCoords.lng !== '') {
      const lat = Number(destinationCoords.lat);
      const lng = Number(destinationCoords.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        reverseGeocode(lng, lat).then((addr) => {
          if (addr) setDestAddress(addr);
        });
      }
    }
  }, [destinationCoords.lat, destinationCoords.lng]);

  // Debounced address search
  const handleOriginAddressChange = (value: string) => {
    setOriginAddress(value);
    if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
    originDebounceRef.current = setTimeout(async () => {
      const suggestions = await geocodeAddress(value);
      setOriginSuggestions(suggestions);
      setShowOriginDropdown(suggestions.length > 0);
    }, 300);
  };

  const handleDestAddressChange = (value: string) => {
    setDestAddress(value);
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    destDebounceRef.current = setTimeout(async () => {
      const suggestions = await geocodeAddress(value);
      setDestSuggestions(suggestions);
      setShowDestDropdown(suggestions.length > 0);
    }, 300);
  };

  const selectOriginSuggestion = (suggestion: GeocodeSuggestion) => {
    setOriginAddress(suggestion.place_name);
    setOriginCoords({ lat: suggestion.center[1], lng: suggestion.center[0] });
    setShowOriginDropdown(false);
  };

  const selectDestSuggestion = (suggestion: GeocodeSuggestion) => {
    setDestAddress(suggestion.place_name);
    setDestinationCoords({ lat: suggestion.center[1], lng: suggestion.center[0] });
    setShowDestDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onEvaluate({
      originLat: originCoords.lat,
      originLng: originCoords.lng,
      destinationLat: destinationCoords.lat,
      destinationLng: destinationCoords.lng,
      departureTime,
    });
  };

  const getScoreColorClass = (score: number) => {
    if (score > 75) return 'text-red-500 border-red-500/20 bg-red-500/5';
    if (score > 50) return 'text-amber-500 border-amber-500/20 bg-amber-500/5';
    return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5';
  };

  const getScoreBadgeClass = (score: number) => {
    if (score > 75) return 'bg-red-500/10 text-red-500 border border-red-500/20';
    if (score > 50) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  };

  return (
    <div className="w-96 bg-slate-900 border-r border-slate-800 overflow-y-auto h-screen flex flex-col">
      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wide">
            MedPTC Core engine
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-1">Active Dispatch</h2>
        <p className="text-xs text-slate-400">
          Tactical ground vs. air transport risk evaluation system for immediate trauma dispatching.
        </p>
      </div>

      {liveTelemetry && (
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <CloudLightning className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-wide">
              Live Weather Node (33.21, -97.13)
            </span>
          </div>
          {liveTelemetry.loading ? (
            <p className="text-xs text-slate-500 italic">Syncing telemetry...</p>
          ) : liveTelemetry.error ? (
            <p className="text-xs text-red-400">Connection failed: {liveTelemetry.error}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Wind className="w-3 h-3 text-blue-400" />
                  <span className="text-[9px] text-slate-400 uppercase font-mono">Surface Wind</span>
                </div>
                <div className="text-sm font-bold text-slate-100">{liveTelemetry.windSpeed} km/h</div>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Eye className="w-3 h-3 text-amber-400" />
                  <span className="text-[9px] text-slate-400 uppercase font-mono">Precipitation</span>
                </div>
                <div className="text-sm font-bold text-slate-100">{liveTelemetry.precipitation} mm</div>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 space-y-4 flex-1 overflow-y-auto">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] text-blue-400 uppercase font-bold tracking-wide">
              Location Parameters
            </span>
          </div>

          {/* Origin Address Search */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 uppercase font-mono flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-blue-400" />
                Origin Address
              </label>
              <span className="text-[9px] text-slate-500 uppercase">Trauma Site</span>
            </div>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={originAddress}
                  onChange={(e) => handleOriginAddressChange(e.target.value)}
                  onFocus={() => {
                    if (originSuggestions.length > 0) setShowOriginDropdown(true);
                  }}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5 pr-7 text-xs text-slate-100 focus:outline-none focus:border-blue-500 focus:bg-slate-950"
                  placeholder="Search address or place..."
                  required
                />
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                {showOriginDropdown && originSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-950 border border-slate-700 rounded shadow-xl max-h-48 overflow-y-auto">
                    {originSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => selectOriginSuggestion(suggestion)}
                        className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 border-b border-slate-800 last:border-b-0"
                      >
                        {suggestion.place_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSetPoint(settingPoint === 'origin' ? null : 'origin')}
                className={`px-2.5 py-1.5 rounded text-[10px] font-mono uppercase transition flex items-center gap-1 ${
                  settingPoint === 'origin'
                    ? 'bg-blue-900 text-blue-200 border border-blue-600'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Click on map to set origin"
              >
                <MousePointer className="w-3 h-3" />
                {settingPoint === 'origin' ? 'Click Map' : 'Map'}
              </button>
            </div>
            {originCoords.lat && originCoords.lng && (
              <div className="mt-1 text-[9px] text-slate-500 font-mono">
                {Number(originCoords.lat).toFixed(4)}, {Number(originCoords.lng).toFixed(4)}
              </div>
            )}
          </div>

          {/* Destination Address Search */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 uppercase font-mono flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-emerald-400" />
                Destination Address
              </label>
              <span className="text-[9px] text-slate-500 uppercase">Receiving Center</span>
            </div>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={destAddress}
                  onChange={(e) => handleDestAddressChange(e.target.value)}
                  onFocus={() => {
                    if (destSuggestions.length > 0) setShowDestDropdown(true);
                  }}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5 pr-7 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 focus:bg-slate-950"
                  placeholder="Search address or place..."
                  required
                />
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                {showDestDropdown && destSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-950 border border-slate-700 rounded shadow-xl max-h-48 overflow-y-auto">
                    {destSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => selectDestSuggestion(suggestion)}
                        className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 border-b border-slate-800 last:border-b-0"
                      >
                        {suggestion.place_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSetPoint(settingPoint === 'destination' ? null : 'destination')}
                className={`px-2.5 py-1.5 rounded text-[10px] font-mono uppercase transition flex items-center gap-1 ${
                  settingPoint === 'destination'
                    ? 'bg-emerald-900 text-emerald-200 border border-emerald-600'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Click on map to set destination"
              >
                <MousePointer className="w-3 h-3" />
                {settingPoint === 'destination' ? 'Click Map' : 'Map'}
              </button>
            </div>
            {destinationCoords.lat && destinationCoords.lng && (
              <div className="mt-1 text-[9px] text-slate-500 font-mono">
                {Number(destinationCoords.lat).toFixed(4)}, {Number(destinationCoords.lng).toFixed(4)}
              </div>
            )}
          </div>

          {/* Departure Time */}
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-mono flex items-center gap-1.5 mb-1">
              <Calendar className="w-3 h-3 text-cyan-400" />
              Planned Departure Window
            </label>
            <input
              type="datetime-local"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500 focus:bg-slate-950"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2.5 px-4 rounded text-sm transition flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Analyzing Vectors...
            </>
          ) : (
            <>
              <Activity className="w-4 h-4" />
              Evaluate Routing Risk
            </>
          )}
        </button>
      </form>

      {/* Helipad Registry */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-100 uppercase">Emergency Helipad Registry</h3>
          <span className="text-[9px] text-amber-400 uppercase font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            Tactical Override
          </span>
        </div>
        <p className="text-[10px] text-slate-500 mb-3">
          Dispatcher manual override of tactical heliports. Marking the nearest helipad to the receiving center as CLOSED maximizes MEDEVAC evacuation risk vectors.
        </p>

        {helipads.length === 0 ? (
          <p className="text-xs text-slate-600 italic">No helipads loaded from server.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {helipads.map((pad) => {
              const isNearest = pad.id === nearestHelipadId;
              const isOpen = pad.status === 'OPEN';
              return (
                <div
                  key={pad.id}
                  className={`bg-slate-900 border rounded p-2.5 ${
                    isNearest ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-bold text-slate-100">{pad.name}</span>
                        {isNearest && (
                          <span className="text-[8px] text-cyan-300 bg-cyan-500/20 px-1 py-0.5 rounded font-mono uppercase border border-cyan-500/30">
                            Nearest
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Location: {pad.lat.toFixed(4)}, {pad.lng.toFixed(4)}{' '}
                        {isNearest && `(~${nearestDistance.toFixed(1)} km)`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-600 uppercase font-mono">
                      Operator Status: <span className={isOpen ? 'text-emerald-400' : 'text-red-400'}>{pad.status}</span>
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateHelipadStatus(pad.id, 'OPEN')}
                        className={`px-2.5 py-1 text-[10px] font-mono uppercase font-bold rounded transition cursor-pointer ${
                          isOpen
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        OPEN
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateHelipadStatus(pad.id, 'CLOSED')}
                        className={`px-2.5 py-1 text-[10px] font-mono uppercase font-bold rounded transition cursor-pointer ${
                          !isOpen
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        CLOSED
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Evaluation Results */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex-shrink-0">
        <h3 className="text-xs font-bold text-slate-100 uppercase mb-3">Live Evaluation Assessment</h3>

        {!result && !isLoading && (
          <div className="text-center py-8">
            <div className="mb-3">
              <Layers className="w-12 h-12 text-slate-700 mx-auto" />
            </div>
            <p className="text-sm font-bold text-slate-400 mb-1">Assessment Idle</p>
            <p className="text-xs text-slate-600">
              Enter target coordinates or tap markers on the map canvas, then trigger evaluation to assess transport risk levels.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-cyan-400 mx-auto mb-2 animate-spin" />
            <p className="text-sm font-bold text-slate-300 mb-1">Running Environmental Models...</p>
            <p className="text-xs text-slate-500">Fetching weather systems and Mapbox traffic details...</p>
          </div>
        )}

        {result && !isLoading && (
          <div className="space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[9px] text-cyan-400 uppercase font-mono">Recommended mode</span>
              </div>
              <div className="text-sm font-bold text-slate-100">
                {result.recommended_mode === 'EITHER'
                  ? 'GROUND OR HELICOPTER (VECTORS EQUAL)'
                  : `DISPATCH BY ${result.recommended_mode}`}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={`border rounded p-2.5 ${getScoreColorClass(result.risk_score_ground)}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Truck className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-mono">Ground Risk</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold">{result.risk_score_ground}</div>
                  <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded ${getScoreBadgeClass(result.risk_score_ground)}`}>
                    {result.risk_score_ground > 75 ? 'Critical Risk' : result.risk_score_ground > 50 ? 'Caution' : 'Low Risk'}
                  </span>
                </div>
              </div>

              <div className={`border rounded p-2.5 ${getScoreColorClass(result.risk_score_helicopter)}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-mono">Heli Risk</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold">{result.risk_score_helicopter}</div>
                  <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded ${getScoreBadgeClass(result.risk_score_helicopter)}`}>
                    {result.risk_score_helicopter > 75 ? 'Critical Risk' : result.risk_score_helicopter > 50 ? 'Caution' : 'Low Risk'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[9px] text-amber-400 uppercase font-mono">Justification Analysis</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{result.justification}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <CloudLightning className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[9px] text-cyan-400 uppercase font-mono">Environmental telemetry</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-slate-600">Wind velocity</span>
                  <div className="text-slate-300 font-mono">{result.weather_snapshot.wind_speed} m/s</div>
                </div>
                <div>
                  <span className="text-slate-600">Visibility index</span>
                  <div className="text-slate-300 font-mono">{result.weather_snapshot.visibility} km</div>
                </div>
                <div>
                  <span className="text-slate-600">Travel time</span>
                  <div className="text-slate-300 font-mono">{result.traffic_snapshot.duration_min} mins</div>
                </div>
                <div>
                  <span className="text-slate-600">Conditions</span>
                  <div className="text-slate-300 font-mono">{result.weather_snapshot.condition}</div>
                </div>
              </div>
            </div>

            {result.nearest_helipad && (
              <div className="bg-slate-900 border border-cyan-500/30 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[9px] text-cyan-400 uppercase font-mono">Distance-Keyed Heliport</span>
                </div>
                <div className="text-sm font-bold text-slate-100 mb-1">{result.nearest_helipad.name}</div>
                <p className="text-[10px] text-slate-500 mb-2">
                  Proximity: {result.nearest_helipad.distance.toFixed(1)} km to Active Center
                </p>
                <span
                  className={`inline-block text-[9px] uppercase font-mono px-2 py-1 rounded ${
                    result.nearest_helipad.status === 'OPEN'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {result.nearest_helipad.status}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
