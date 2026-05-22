import React, { useState } from 'react';
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
  AlertTriangle
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
}: RiskSidebarProps) {
  // Find nearest helipad dynamically based on current destination coordinates input
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
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = 6371 * c;
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestHelipadId = pad.id;
      }
    });
  }
  // Input tracking
  const [departureTime, setDepartureTime] = useState(
    new Date(Date.now() + 1800000).toISOString().slice(0, 16) // Default 30 mins in future
  );

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
    <div className="w-full lg:w-[420px] shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-y-auto">
      {/* Title Segment */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">MedPTC Core engine</span>
        </div>
        <h1 className="text-2xl font-display font-medium text-slate-100 tracking-tight">Active Dispatch</h1>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Tactical ground vs. air transport risk evaluation system for immediate trauma dispatching.
        </p>
      </div>

      {/* Live Telemetry Banner */}
      {liveTelemetry && (
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/80 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">Live Weather Node (33.21, -97.13)</span>
            <CloudLightning className="h-3.5 w-3.5 text-slate-500" />
          </div>
          
          {liveTelemetry.loading ? (
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-500 animate-pulse mt-1">
              <RefreshCw className="h-3 w-3 animate-spin"/> Syncing telemetry...
            </div>
          ) : liveTelemetry.error ? (
            <div className="flex items-center gap-2 text-xs font-mono text-red-400 mt-1">
              <AlertTriangle className="h-3 w-3"/> Connection failed: {liveTelemetry.error}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-slate-900 border border-slate-800 rounded p-2 flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Surface Wind</span>
                <span className="text-xs font-mono text-blue-400 font-semibold">{liveTelemetry.windSpeed} km/h</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded p-2 flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Precipitation</span>
                <span className="text-xs font-mono text-cyan-400 font-semibold">{liveTelemetry.precipitation} mm</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Coordinate Input Form */}
      <form onSubmit={handleSubmit} className="p-5 border-b border-slate-800 space-y-4">
        <h2 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase mb-2">Location Parameters</h2>
        
        {/* Origin Coordinates Input */}
        <div>
          <label className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-blue-500" /> Origin Latitude / Longitude</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest">Trauma Site</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={originCoords.lat}
              onChange={(e) => setOriginCoords({ ...originCoords, lat: e.target.value === '' ? '' : Number(e.target.value) })}
              className="bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 focus:bg-slate-950"
              placeholder="Origin Lat"
              required
            />
            <input
              type="number"
              step="any"
              value={originCoords.lng}
              onChange={(e) => setOriginCoords({ ...originCoords, lng: e.target.value === '' ? '' : Number(e.target.value) })}
              className="bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 focus:bg-slate-950"
              placeholder="Origin Lng"
              required
            />
          </div>
        </div>

        {/* Destination Coordinates Input */}
        <div>
          <label className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-emerald-500" /> Destination Latitude / Longitude</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest">Receiving Center</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={destinationCoords.lat}
              onChange={(e) => setDestinationCoords({ ...destinationCoords, lat: e.target.value === '' ? '' : Number(e.target.value) })}
              className="bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500 focus:bg-slate-950"
              placeholder="Dest Lat"
              required
            />
            <input
              type="number"
              step="any"
              value={destinationCoords.lng}
              onChange={(e) => setDestinationCoords({ ...destinationCoords, lng: e.target.value === '' ? '' : Number(e.target.value) })}
              className="bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500 focus:bg-slate-950"
              placeholder="Dest Lng"
              required
            />
          </div>
        </div>

        {/* Departure Date Time */}
        <div>
          <label className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mb-1.5">
            <Calendar className="h-3 w-3 text-cyan-500" /> Planned Departure Window
          </label>
          <input
            type="datetime-local"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500 focus:bg-slate-950"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-zinc-950 font-display font-semibold py-2.5 rounded-lg text-xs tracking-wider uppercase transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/20"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Analyzing Vectors...</span>
            </>
          ) : (
            <>
              <Activity className="h-3.5 w-3.5" />
              <span>Evaluate Routing Risk</span>
            </>
          )}
        </button>
      </form>

      {/* Helipad Control Node */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/20 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">Emergency Helipad Registry</h3>
          <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">
            Tactical Override
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed font-light text-left">
          Dispatcher manual override of tactical heliports. Marking the nearest helipad to the receiving center as CLOSED maximizes MEDEVAC evacuation risk vectors.
        </p>

        {helipads.length === 0 ? (
          <div className="text-[11px] font-mono text-slate-500 py-3 text-center bg-slate-950/45 border border-slate-850 rounded">
            No helipads loaded from server.
          </div>
        ) : (
          <div className="space-y-2">
            {helipads.map((pad) => {
              const isNearest = pad.id === nearestHelipadId;
              const isOpen = pad.status === 'OPEN';
              
              return (
                <div 
                  key={pad.id}
                  className={`p-3 rounded-lg border transition duration-155 flex flex-col gap-2 ${
                    isNearest 
                      ? 'bg-indigo-950/15 border-indigo-500/30 shadow-md shadow-indigo-950/10' 
                      : 'bg-slate-950/30 border-slate-850'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="text-left animate-fade-in">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-200">{pad.name}</span>
                        {isNearest && (
                          <span className="text-[9px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1 rounded animate-pulse font-semibold">
                            Nearest
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                        Location: {pad.lat.toFixed(4)}, {pad.lng.toFixed(4)}
                        {isNearest && ` (~${nearestDistance.toFixed(1)} km)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-850/50">
                    <span className="text-[10px] font-mono text-slate-400">
                      Operator Status: 
                      <span className={`ml-1 font-bold ${isOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pad.status}
                      </span>
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

      {/* Decision Output / Evaluation Results Area */}
      <div className="flex-1 p-5 space-y-5 bg-slate-950/15">
        <h2 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">Live Evaluation Assessment</h2>

        {!result && !isLoading && (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-850 rounded-lg bg-slate-900/10 p-5 text-center">
            <Layers className="h-10 w-10 text-slate-700 mb-3" />
            <p className="text-xs text-slate-300 font-medium">Assessment Idle</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
              Enter target coordinates or tap markers on the map canvas, then trigger evaluation to assess transport risk levels.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 p-5 text-center">
            <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin mb-4" />
            <p className="text-xs font-mono text-emerald-400 text-glow-green animate-pulse">Running Environmental Models...</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
              Fetching weather systems and Mapbox traffic details...
            </p>
          </div>
        )}

        {result && !isLoading && (
          <div className="space-y-5 animate-fade-in">
            {/* Recommendation Ribbon */}
            <div className={`p-4 rounded-lg border flex items-start gap-3 ${
              result.recommended_mode === 'HELICOPTER' 
                ? 'bg-cyan-950/30 border-cyan-800 text-cyan-400' 
                : result.recommended_mode === 'GROUND' 
                  ? 'bg-amber-950/30 border-amber-800 text-amber-400'
                  : 'bg-emerald-950/30 border-emerald-800 text-emerald-400'
            }`}>
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block font-bold">Recommended mode</span>
                <span className="font-display text-base font-semibold tracking-wide">
                  {result.recommended_mode === 'EITHER' ? 'GROUND OR HELICOPTER (VECTORS EQUAL)' : `DISPATCH BY ${result.recommended_mode}`}
                </span>
              </div>
            </div>

            {/* Score Comparison Display */}
            <div className="grid grid-cols-2 gap-4">
              {/* Ground transport score */}
              <div className={`p-4 border rounded-lg flex flex-col justify-between h-28 ${getScoreColorClass(result.risk_score_ground)}`}>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono uppercase tracking-tight text-slate-300 font-semibold">Ground Risk</span>
                  <Truck className="h-4 w-4 opacity-75" />
                </div>
                <div className="mt-2 text-left">
                  <span className="text-4xl font-display font-semibold tracking-tighter">
                    {result.risk_score_ground}
                  </span>
                  <span className="text-[11px] font-mono text-slate-450 block mt-1">
                    {result.risk_score_ground > 75 ? 'Critical Risk' : result.risk_score_ground > 50 ? 'Caution' : 'Low Risk'}
                  </span>
                </div>
              </div>

              {/* Helicopter transport score */}
              <div className={`p-4 border rounded-lg flex flex-col justify-between h-28 ${getScoreColorClass(result.risk_score_helicopter)}`}>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono uppercase tracking-tight text-slate-300 font-semibold">Heli Risk</span>
                  <Activity className="h-4 w-4 opacity-75 rotate-45 animate-pulse" />
                </div>
                <div className="mt-2 text-left">
                  <span className="text-4xl font-display font-semibold tracking-tighter">
                    {result.risk_score_helicopter}
                  </span>
                  <span className="text-[11px] font-mono text-slate-450 block mt-1">
                    {result.risk_score_helicopter > 75 ? 'Critical Risk' : result.risk_score_helicopter > 50 ? 'Caution' : 'Low Risk'}
                  </span>
                </div>
              </div>
            </div>

            {/* Justification & Narrative Text */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold block mb-1.5 text-left">Justification Analysis</span>
              <p className="text-xs text-slate-305 leading-relaxed text-left font-light">
                {result.justification}
              </p>
            </div>

            {/* Detail Snapshot Parameters */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold block text-left mb-1">Environmental telemetry</span>
              
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="flex items-center gap-2 p-2 bg-slate-900/60 border border-slate-850 rounded">
                  <Wind className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-[8px] font-mono text-slate-500 block uppercase">Wind velocity</span>
                    <span className="text-xs font-mono text-slate-205 font-medium">{result.weather_snapshot.wind_speed} m/s</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-slate-900/60 border border-slate-850 rounded">
                  <Eye className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <div>
                    <span className="text-[8px] font-mono text-slate-500 block uppercase">Visibility index</span>
                    <span className="text-xs font-mono text-slate-205 font-medium">{result.weather_snapshot.visibility} km</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-slate-900/60 border border-slate-850 rounded">
                  <Truck className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-[8px] font-mono text-slate-400 block uppercase">Travel time</span>
                    <span className="text-xs font-mono text-slate-205 font-medium">{result.traffic_snapshot.duration_min} mins</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-slate-900/60 border border-slate-850 rounded">
                  <Layers className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[8px] font-mono text-slate-450 block uppercase">Conditions</span>
                    <span className="text-xs font-mono text-slate-205 font-medium capitalize prose-sm truncate max-w-[120px] block">
                      {result.weather_snapshot.condition}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Evaluated Nearest Helipad Detail */}
            {result.nearest_helipad && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-left">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold block mb-2">Distance-Keyed Heliport</span>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-250 mb-0.5">{result.nearest_helipad.name}</div>
                    <div className="text-[10px] font-mono text-slate-500 leading-normal">
                      Proximity: {result.nearest_helipad.distance.toFixed(1)} km to Active Center
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    result.nearest_helipad.status === 'OPEN' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {result.nearest_helipad.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
