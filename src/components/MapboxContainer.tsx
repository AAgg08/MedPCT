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
  settingPoint: 'origin' | 'destination' | null;
  onSetPointChange: (type: 'origin' | 'destination' | null) => void;
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
  settingPoint,
  onSetPointChange,
}: MapboxContainerProps) {
  useMapboxCSS();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [localToken, setLocalToken] = useState(
    mapToken || localStorage.getItem('MAPBOX_TOKEN') || 'pk.eyJ1IjoiYXJ5YW5hIiwiYSI6ImNtcGV0aHlrbDAyZXkycXEzM2Z3b24zcnUifQ.vTqdwrLUgUS1GLEM4u0UVw'
  );
  const [showAllUSHelipads, setShowAllUSHelipads] = useState(false);

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
        center: [-98.5795, 39.8283],
        zoom: 4,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

      map.on('load', () => {
        setIsMapReady(true);
        setMapError(null);

        // Add helipads GeoJSON source & layer
        if (!map.getSource('helipads-source')) {
          map.addSource('helipads-source', {
            type: 'geojson',
            data: '/helipads.json', // Served statically from Vite /public directory
          });
        }

        if (!map.getLayer('helipads-layer')) {
          map.addLayer({
            id: 'helipads-layer',
            type: 'circle',
            source: 'helipads-source',
            layout: {
              'visibility': 'none', // Performance mandate: Keep hidden by default
            },
            paint: {
              'circle-color': '#06b6d4',
              'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                2, 2.5,
                8, 5,
                13, 9,
                18, 16
              ],
              'circle-stroke-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                2, 0.5,
                12, 1.5,
                18, 3
              ],
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.85,
              'circle-stroke-opacity': 0.9,
            },
          });
        }

        // Add interactive hover popup for the helipad layer
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
        });

        map.on('mouseenter', 'helipads-layer', (e) => {
          map.getCanvas().style.cursor = 'pointer';
          const features = e.features;
          if (features && features.length > 0) {
            const feature = features[0];
            const coordinates = (feature.geometry as any).coordinates.slice();
            const props = feature.properties;
            const name = props?.name || 'Helipad';
            const city = props?.city || '';
            const state = props?.state || '';

            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
              coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            popup.setLngLat(coordinates)
              .setHTML(`
                <div style="padding: 4px 8px; font-family: monospace; font-size: 11px;">
                  <strong>${name}</strong><br />
                  ${city}${city && state ? ', ' : ''}${state}
                </div>
              `)
              .addTo(map);
          }
        });

        map.on('mouseleave', 'helipads-layer', () => {
          map.getCanvas().style.cursor = '';
          popup.remove();
        });
      });

      map.on('error', (e) => {
        console.error('Mapbox rendering error:', e);
        setMapError('Failed to initialize Mapbox GL. Please double-check your public access token.');
      });

      map.on('click', (e) => {
        if (settingPoint) {
          const { lat, lng } = e.lngLat;
          if (onMapClick) {
            onMapClick(lat, lng, settingPoint);
            onSetPointChange(null);
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

  // Dynamically toggle US helipads visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (map.getLayer('helipads-layer')) {
      map.setLayoutProperty(
        'helipads-layer',
        'visibility',
        showAllUSHelipads ? 'visible' : 'none'
      );
    }
  }, [showAllUSHelipads, isMapReady]);

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
        <div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
          ${label}
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
    <div className="relative w-full h-screen">
      {/* Simulation / Mock Map View if no valid Token is configured */}
      {(!activeToken || mapError) && (
        <div className="absolute inset-0 bg-slate-950 z-20 flex items-center justify-center p-8">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
            {/* Compass Icon Animation */}
            <div className="flex justify-center mb-4">
              <Compass className="w-16 h-16 text-emerald-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 text-center">Tactical Map Simulation Active</h3>
            <p className="text-xs text-slate-400 text-center">
              Please enter your **Mapbox Public Token** to initialize interactive GL rendering. In the meantime, MedPTC coordinates and route lines are plotted below.
            </p>

            <form onSubmit={handleTokenSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <label htmlFor="mapbox-token-input" className="sr-only">Mapbox Access Token</label>
                <input
                  id="mapbox-token-input"
                  type="password"
                  placeholder="pk.ey..."
                  value={localToken}
                  onChange={(e) => setLocalToken(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-md pl-10 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono w-full"
                />
              </div>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-xs font-bold transition"
              >
                Connect Token
              </button>
            </form>

            {mapError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded p-3 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{mapError}</p>
              </div>
            )}

            {/* Mock Interactive Canvas Plot - Allows full simulation and testing without key! */}
            <div className="bg-slate-950/60 border border-slate-800 rounded p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-xs uppercase font-mono">
                <MapPin className="w-3.5 h-3.5" />
                Dispatcher Coordinates
              </div>

              <div className="text-[10px] text-slate-500 font-mono">
                O: {origin.lat === '' ? '---' : Number(origin.lat).toFixed(4)}, {origin.lng === '' ? '---' : Number(origin.lng).toFixed(4)}
                {' '} • {' '}
                D: {destination.lat === '' ? '---' : Number(destination.lat).toFixed(4)}, {destination.lng === '' ? '---' : Number(destination.lng).toFixed(4)}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onSetPointChange(settingPoint === 'origin' ? null : 'origin')}
                  className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded transition ${
                    settingPoint === 'origin'
                      ? 'bg-blue-900 text-blue-200 border border-blue-600'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Set Origin
                </button>
                <button
                  type="button"
                  onClick={() => onSetPointChange(settingPoint === 'destination' ? null : 'destination')}
                  className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded transition ${
                    settingPoint === 'destination'
                      ? 'bg-amber-900 text-amber-200 border border-amber-600'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Set Dest
                </button>
              </div>

              {settingPoint && (
                <p className="text-[10px] text-cyan-400 italic">
                  Click locations on the mock Map Panel to update dispatch coordinates
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actual Map Target Canvas */}
      {activeToken && !mapError && (
        <div ref={mapContainerRef} className="absolute inset-0" />
      )}

      {/* Overlay Info Panel */}
      <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-slate-800 rounded-lg p-4 max-w-sm z-10">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-bold text-slate-100 uppercase">Live Dispatch Mapping</h4>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Solid path indicates ground ambulance routing (color-keyed to ground risk). Dotted cyan line marks the straight-line MEDEVAC flight path vectors.
        </p>

        {/* Show All U.S. Helipads toggle */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
          <label htmlFor="show-all-helipads" className="flex items-center gap-2 cursor-pointer">
            <input
              id="show-all-helipads"
              type="checkbox"
              checked={showAllUSHelipads}
              onChange={(e) => setShowAllUSHelipads(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
            />
            <span className="text-[10px] text-slate-400 uppercase font-mono">Show All U.S. Helipads</span>
          </label>
          <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded ${
            showAllUSHelipads ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-600'
          }`}>
            {showAllUSHelipads ? 'Visible' : 'Hidden'}
          </span>
        </div>
      </div>
    </div>
  );
}
