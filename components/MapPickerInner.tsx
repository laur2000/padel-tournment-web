'use client';

import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix Leaflet default icon not appearing correctly in Webpack/Next.js
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

function MapUpdater({ position }: { position: { lat: number; lng: number } | null }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], map.getZoom());
    }
  }, [position, map]);
  return null;
}

function LocationMarker({ position, onChange }: { position: { lat: number, lng: number } | null, onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={icon}></Marker>
  );
}

export default function MapPickerInner({ onLocationSelect, position }: { onLocationSelect: (lat: number, lng: number) => void, position?: { lat: number; lng: number } | null }) {
  const defaultCenter = { lat: 40.4168, lng: -3.7038 }; // Madrid

  return (
    <MapContainer center={position || defaultCenter} zoom={13} style={{ height: '300px', width: '100%', borderRadius: '8px' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater position={position || null} />
      <LocationMarker position={position || null} onChange={onLocationSelect} />
    </MapContainer>
  );
}
