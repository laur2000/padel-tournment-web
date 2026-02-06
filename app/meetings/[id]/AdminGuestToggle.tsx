'use client';

import { useTransition } from 'react';
import { setGuestsAllowed } from '@/lib/actions/meetings';

export default function AdminGuestToggle({ meetingId, allowGuests, disabled = false }: { meetingId: string, allowGuests: boolean, disabled?: boolean }) {
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        startTransition(async () => {
             try {
                await setGuestsAllowed(meetingId, !allowGuests);
             } catch (e: any) {
                alert('Error changing settings');
                console.error(e);
             }
        });
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled || isPending}
            className={`w-full font-bold py-2 px-4 rounded transition disabled:opacity-50 text-sm uppercase tracking-wider ${
                allowGuests 
                ? "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-200" 
                : "w-full bg-blue-100 text-blue-700 font-bold py-2 px-4 rounded hover:bg-blue-200 transition disabled:opacity-50 text-sm uppercase tracking-wider"
            }`}
        >
            {isPending ? "Guardando..." : (allowGuests ? "Cerrar Invitados" : "Permitir Invitados")}
        </button>
    );
}
