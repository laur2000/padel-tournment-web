"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { updateMeeting } from "@/lib/actions/meetings";
import { useRouter } from "next/navigation";
import MapPicker from "@/components/MapPicker";
import { Meeting } from "@prisma/client";

export default function EditMeetingForm({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    meeting.latitude && meeting.longitude 
      ? { lat: meeting.latitude, lng: meeting.longitude } 
      : null
  );
  
  // Geolocation states
  const [placeQuery, setPlaceQuery] = useState(meeting.place);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestionCoords, setSuggestionCoords] = useState<{lat: number, lng: number} | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
        clearTimeout(debounceRef.current);
    }

    if (!placeQuery || placeQuery.length < 3 || placeQuery === meeting.place) {
        setSuggestion(null);
        return;
    }

    debounceRef.current = setTimeout(async () => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeQuery)}&format=json&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
                const result = data[0];
                setSuggestion(result.display_name);
                setSuggestionCoords({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
            } else {
                setSuggestion(null);
                setSuggestionCoords(null);
            }
        } catch (e) {
            console.error("Nominatim error", e);
        }
    }, 1000);

    return () => {
        if(debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [placeQuery, meeting.place]);


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    const place = formData.get("place") as string;
    const startTimeStr = formData.get("startTime") as string;
    const numCourts = parseInt(formData.get("numCourts") as string);

    if (!place || !startTimeStr || isNaN(numCourts)) {
      setError("Por favor, completa todos los campos correctamente.");
      return;
    }

    const startTime = new Date(startTimeStr);
    
    startTransition(async () => {
      try {
        await updateMeeting(meeting.id, {
          place,
          startTime: startTime,
          numCourts,
          latitude: location?.lat,
          longitude: location?.lng
        });
        // Redirect handled in server action
      } catch (err) {
        setError("Error al actualizar el partido.");
      }
    });
  };

  // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
  // meeting.startTime is a Date object or string depending on how it's serialized if passed from server component
  // Since it's passed from server component props, it's a Date object if using query, but client components props serialization..
  // Let's assume it's a Date object.
  const toLocalISOString = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const defaultStartDate = toLocalISOString(new Date(meeting.startTime));

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md bg-white p-6 rounded shadow">
      {error && <div className="text-red-500 mb-4">{error}</div>}
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Lugar</label>
        <input
          name="place"
          type="text"
          required
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          placeholder="e.g. Club de Padel"
          value={placeQuery}
          onChange={(e) => setPlaceQuery(e.target.value)}
        />
        {suggestion && (
            <p className="text-xs text-blue-600 mt-1 cursor-pointer" onClick={() => {
                setPlaceQuery(suggestion);
                if (suggestionCoords) setLocation(suggestionCoords);
            }}>
                Sugerencia: {suggestion}
            </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Ubicación (Opcional)</label>
        <div className="mt-1 border border-gray-300 rounded-md overflow-hidden">
             <MapPicker onLocationSelect={(lat, lng) => setLocation({ lat, lng })} position={location} />
        </div>
        {location && <p className="text-xs text-gray-500 mt-1">Ubicación seleccionada: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Fecha y Hora</label>
        <input
          name="startTime"
          type="datetime-local"
          required
          defaultValue={defaultStartDate}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Número de Pistas</label>
        <input
          name="numCourts"
          type="number"
          min="1"
          max="20"
          defaultValue={meeting.numCourts}
          required
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        />
      </div>

      <div className="flex gap-2">
        <button
            type="button"
            onClick={() => router.back()}
            disabled={isPending}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
            Cancelar
        </button>
        <button
            type="submit"
            disabled={isPending}
            className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
            {isPending ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </form>
  );
}
