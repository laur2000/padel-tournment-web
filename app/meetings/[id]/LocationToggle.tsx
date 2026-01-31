'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import MapIcon from '@mui/icons-material/Map';
import MapViewer from "@/components/MapViewer";

interface LocationToggleProps {
  latitude: number;
  longitude: number;
}

export default function LocationToggle({ latitude, longitude }: LocationToggleProps) {
  const [showMap, setShowMap] = React.useState(false);

  if (showMap) {
    return (
      <div className="mb-6 h-[300px] w-full border border-gray-200 rounded-lg overflow-hidden animate-fade-in">
         <MapViewer lat={latitude} lng={longitude} />
      </div>
    );
  }

  return (
    <div className="mb-6 flex justify-center">
      <Button 
        variant="outlined" 
        startIcon={<MapIcon />}
        onClick={() => setShowMap(true)}
      >
        Ver ubicación
      </Button>
    </div>
  );
}
