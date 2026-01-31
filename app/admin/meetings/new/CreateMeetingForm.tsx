"use client";

import { useState, useTransition } from "react";
import { createMeeting } from "@/lib/actions/meetings";
import { useRouter } from "next/navigation";

export default function CreateMeetingForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

    startTransition(async () => {
      try {
        await createMeeting({
          place,
          startTime: new Date(startTimeStr),
          numCourts,
        });
        // Redirect is handled in server action, ensuring types match
      } catch (err) {
        setError("Error al crear el partido. Asegúrate de ser administrador.");
      }
    });
  };

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
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Fecha y Hora</label>
        <input
          name="startTime"
          type="datetime-local"
          required
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Número de Pistas</label>
        <input
          name="numCourts"
          type="number"
          min="1"
          max="10"
          defaultValue="3"
          required
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear Partido"}
      </button>
    </form>
  );
}
