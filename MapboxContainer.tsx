import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { MapPin, Navigation, Compass, ShieldAlert, KeyRound, Loader2, Info } from 'lucide-react';
import { MedPTCConfig } from '../config';

// Inject Mapbox CSS dynamically so developers don't have to worry about template headers
const useMapboxCSS = () => {
  useEffect(() => {
    const linkId = 'mapbox-gl-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
      document.head.appendChild(link);
    }
  }, []);
};

interface MapboxContainerProps {
  origin: { lat: number | string; lng: number | string };
  destination: { lat: number | string; lng: number | string };
  onMapClick?: (lat: number, lng: number, type: 'origin' | 'destination') => void;
  groundRiskScore?: number;
  helicopterRiskScore?: number;
  recommendedMode?: 'GROUND' | 'HELICOPTER' | 'EITHER' | null;
  mapToken?: string;
  onTokenChange?: (token: string) => void;
}

export default function MapboxContainer({
  origin,
  destination,
  onMapClick,
  groundRiskScore = 20,
  helicopterRiskScore = 20,
  recommendedMode,
  mapToken = '',
  onTokenChange,
}: MapboxContainerProps) {
  useMapboxCSS();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [localToken, setLocalToken] = useState(mapToken || localStorage.getItem('MAPBOX_TOKEN') || '');
  const [isSettingPoint, setIsSettingPoint] = useState<'origin' | 'destination' | null>(null);

  // Active Map Token check
  const activeToken = mapToken || localToken;

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localToken.trim()) {
      localStorage.setItem('MAPBOX_TOKEN', localToken.trim());
      if (onTokenChange) onTokenChange(localToken.trim());
      // Refresh window/map
      window.location.reload();
    }
  };

  // Get color code by risk score
  const getRiskColor = (score: number) => {
    if (score > 75) return '#ef4444'; // Red
    if (score > 50) return '#f59e0b'; // Amber
    return '#22c55e'; // Green
  };

  useEffect(() => {
    if (!activeToken || !mapContainerRef.current) return;

    try {
      mapboxgl.accessToken = activeToken;
      
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MedPTCConfig.MAPBOX.STYLE,
        center: [
          (origin.lng + destination.lng) / 2,
          (origin.lat + destination.lat) / 2,
        ],
        zoom: MedPTCConfig.MAPBOX.DEFAULT_ZOOM,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

      map.on('load', () => {
        setIsMapReady(true);
        setMapError(null);
      });

      map.on('error', (e) => {
        console.error('Mapbox rendering error:', e);
        setMapError('Failed to initialize Mapbox GL. Please double-check your public access token.');
      });

      map.on('click', (e) => {
        if (isSettingPoint) {
          const { lat, lng } = e.lngLat;
          if (onMapClick) {
            onMapClick(lat, lng, isSettingPoint);
            setIsSettingPoint(null);
          }
        }
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (err: any) {
      console.error('Mapbox load crash:', err);
      setMapError(err.message || 'An explicit error occurred during Mapbox initialization.');
    }
  }, [activeToken]);

  // Handle markers and route layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (origin.lat === '' || origin.lng === '' || destination.lat === '' || destination.lng === '') return;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Create custom elements for markers
    const createMarkerEl = (color: string, label: string) => {
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center';
      el.innerHTML = `
        <div class="absolute -top-10 bg-slate-900 border border-slate-700 text-[10px] uppercase font-mono px-2 py-0.5 rounded shadow-lg text-white font-medium tracking-wider whitespace-nowrap">
          ${label}
        </div>
        <div class="h-6 w-6 rounded-full flex items-center justify-center shadow-lg border border-white animate-pulse" style="background-color: ${color}">
          <div class="h-2 w-2 rounded-full bg-white"></div>
        </div>
      `;
      return el;
    };

    // Add Origin Marker
    const originMarker = new mapboxgl.Marker({
      element: createMarkerEl('#3b82f6', 'ORIGIN'),
    })
      .setLngLat([Number(origin.lng), Number(origin.lat)])
      .addTo(map);
    markersRef.current.push(originMarker);

    // Add Destination Marker
    const destMarker = new mapboxgl.Marker({
      element: createMarkerEl(getRiskColor(groundRiskScore), 'DESTINATION'),
    })
      .setLngLat([Number(destination.lng), Number(destination.lat)])
      .addTo(map);
    markersRef.current.push(destMarker);

    // Dynamic Zoom Fitting bounds
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([Number(origin.lng), Number(origin.lat)]);
    bounds.extend([Number(destination.lng), Number(destination.lat)]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 1200 });

    // Draw route visual mock lines (Flight path vs Ground Path)
    map.on('style.load', () => {
      drawPaths(map);
    });

    if (map.isStyleLoaded()) {
      drawPaths(map);
    }
  }, [origin, destination, isMapReady, groundRiskScore, helicopterRiskScore]);

  const drawPaths = (map: mapboxgl.Map) => {
    // Cast everything to number to avoid string concatenation issues
    const origLng = Number(origin.lng);
    const origLat = Number(origin.lat);
    const destLng = Number(destination.lng);
    const destLat = Number(destination.lat);

    // Ground route coords (mocking a curved arc)
    const midLng = (origLng + destLng) / 2;
    const midLat = (origLat + destLat) / 2 + 0.02; // curved route
    const groundCoords = [
      [origLng, origLat],
      [origLng + (midLng - origLng) * 0.5, origLat + (midLat - origLat) * 0.4],
      [midLng, midLat],
      [destLng - (destLng - midLng) * 0.5, destLat + (destLat - midLat) * 0.4],
      [destLng, destLat],
    ];

    // Helicopter straight flight path coords
    const heliCoords = [
      [origLng, origLat],
      [destLng, destLat],
    ];

    // Remove old layers/sources if they exist
    ['ground-route', 'heli-route'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    // Add Ground Route Source & Layer
    map.addSource('ground-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: groundCoords,
        },
      },
    });

    map.addLayer({
      id: 'ground-route',
      type: 'line',
      source: 'ground-route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': getRiskColor(groundRiskScore),
        'line-width': 4,
        'line-opacity': 0.85,
      },
    });

    // Add Helicopter Flight Path Source & Layer
    map.addSource('heli-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: heliCoords,
        },
      },
    });

    map.addLayer({
      id: 'heli-route',
      type: 'line',
      source: 'heli-route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#06b6d4', // Cyan
        'line-width': 3,
        'line-dasharray': [2, 2],
        'line-opacity': 0.75,
      },
    });
  };

  return (
    <div className="relative h-full w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden group">
      {/* Simulation / Mock Map View if no valid Token is configured */}
      {(!activeToken || mapError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 z-10">
          <div className="absolute inset-0 opacity-10 bg-radar select-none pointer-events-none" />

          {/* Compass Icon Animation */}
          <div className="relative h-20 w-20 flex items-center justify-center border border-emerald-500/30 rounded-full mb-6">
            <Compass className="h-10 w-10 text-emerald-500 animate-spin" style={{ animationDuration: '25s' }} />
            <div className="absolute inset-2 border border-emerald-500/10 rounded-full animate-ping" />
          </div>

          <h3 className="font-display text-xl font-medium text-slate-100 mb-2">Tactical Map Simulation Active</h3>
          <p className="text-sm text-slate-400 text-center max-w-md mb-6 leading-relaxed">
            Please enter your **Mapbox Public Token** to initialize interactive GL rendering. In the meantime, MedPTC coordinates and route lines are plotted below.
          </p>

          <form onSubmit={handleTokenSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-xl z-20">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="h-4 w-4 text-emerald-500" />
              <label className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">Mapbox Access Token</label>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="pk.ey..."
                value={localToken}
                onChange={(e) => setLocalToken(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-display font-semibold px-4 py-2 rounded-md text-xs transition duration-200"
              >
                Connect Token
              </button>
            </div>
            {mapError && (
              <div className="flex items-start gap-2 mt-3 p-2.5 bg-red-950/40 border border-red-900/50 rounded text-red-400 text-xs text-left">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{mapError}</span>
              </div>
            )}
          </form>

          {/* Mock Interactive Canvas Plot - Allows full simulation and testing without key! */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 w-full max-w-md flex flex-col gap-3">
            <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-lg border border-slate-850">
              <div className="text-left">
                <span className="text-[10px] font-mono text-slate-400 block tracking-widest uppercase">Dispatcher Coordinates</span>
                <div className="flex items-center gap-x-4 mt-1 font-mono text-xs text-emerald-400 font-semibold text-glow-green">
                  <span>O: {origin.lat === '' ? '---' : Number(origin.lat).toFixed(4)}, {origin.lng === '' ? '---' : Number(origin.lng).toFixed(4)}</span>
                  <span>D: {destination.lat === '' ? '---' : Number(destination.lat).toFixed(4)}, {destination.lng === '' ? '---' : Number(destination.lng).toFixed(4)}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setIsSettingPoint(isSettingPoint === 'origin' ? null : 'origin')}
                  className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded transition ${
                    isSettingPoint === 'origin' ? 'bg-blue-900 text-blue-200 border border-blue-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Set Origin
                </button>
                <button
                  onClick={() => setIsSettingPoint(isSettingPoint === 'destination' ? null : 'destination')}
                  className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded transition ${
                    isSettingPoint === 'destination' ? 'bg-amber-900 text-amber-200 border border-amber-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Set Dest
                </button>
              </div>
            </div>

            {isSettingPoint && (
              <div className="text-center text-[11px] font-mono text-cyan-400 animate-pulse bg-cyan-950/30 border border-cyan-800/50 rounded py-1.5">
                Click locations on the mock Map Panel to update dispatch coordinates
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actual Map Target Canvas */}
      {activeToken && !mapError && (
        <div ref={mapContainerRef} className="h-full w-full" />
      )}

      {/* Overlay Overlay Info Panel */}
      <div className="absolute bottom-4 left-4 p-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg max-w-sm pointer-events-auto shadow-2xl z-20">
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wide">Live Dispatch Mapping</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
              Solid path indicates ground ambulance routing (color-keyed to ground risk). Dotted cyan line marks the straight-line MEDEVAC flight path vectors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
