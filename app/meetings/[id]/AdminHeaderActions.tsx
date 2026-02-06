'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteMeeting } from '@/lib/actions/meetings';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Tooltip from '@mui/material/Tooltip';

export default function AdminHeaderActions({ meetingId, disabled = false }: { meetingId: string, disabled?: boolean }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        if (!confirm("¿ESTÁS SEGURO? Esto eliminará el partido permanentemente.")) return;
        startTransition(async () => {
            try {
                await deleteMeeting(meetingId);
            } catch(error: any) {
                if (error.message === "NEXT_REDIRECT") return;
                alert("Error al eliminar el partido");
            }
        });
    };

    return (
        <div className="flex items-center">
            <Tooltip title={disabled ? "No se puede editar con matchmaking generado" : "Editar Partido"}>
                <span>
                    <IconButton 
                        onClick={() => router.push(`/admin/meetings/${meetingId}/edit`)} 
                        disabled={disabled || isPending}
                        color="primary"
                        aria-label="edit"
                    >
                        <EditIcon />
                    </IconButton>
                </span>
            </Tooltip>
            
            <Tooltip title="Eliminar Partido">
                <span>
                    <IconButton 
                        onClick={handleDelete} 
                        disabled={isPending}
                        color="error" // Red color for delete
                        aria-label="delete"
                    >
                        <DeleteIcon />
                    </IconButton>
                </span>
            </Tooltip>
        </div>
    );
}
