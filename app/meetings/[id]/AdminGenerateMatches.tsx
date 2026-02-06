'use client';

import { useTransition } from 'react';
import { triggerMatchmaking } from '@/lib/actions/meetings';

export default function AdminGenerateMatches({ meetingId, disabled = false, hasMatches = false }: { meetingId: string, disabled?: boolean, hasMatches?: boolean }) {
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        if (hasMatches && !confirm("¿Estás seguro? Se borrarán los partidos actuales y se generarán nuevos.")) {
            return;
        }

        startTransition(async () => {
             try {
                await triggerMatchmaking(meetingId);
             } catch (e: any) {
                alert('Error generating matches');
                console.error(e);
             }
        });
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled || isPending}
            className="w-full bg-blue-100 text-blue-700 font-bold py-2 px-4 rounded hover:bg-blue-200 transition disabled:opacity-50 text-sm uppercase tracking-wider"
        >
            {isPending ? "Generando..." : (hasMatches ? "Regenerar Partidos" : "Generar Partidos")}
        </button>
    );
}
