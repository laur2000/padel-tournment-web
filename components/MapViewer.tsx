'use client';

import dynamic from 'next/dynamic';

const MapViewerInner = dynamic(() => import('./MapViewerInner'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">Cargando mapa...</div>,
});

export default MapViewerInner;
