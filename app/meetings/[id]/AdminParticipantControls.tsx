'use client';

import { useTransition } from 'react';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Tooltip from '@mui/material/Tooltip';
import { adminRemovePlayer, adminConfirmPlayer } from '@/lib/actions/meetings';

interface AdminParticipantControlsProps {
  meetingId: string;
  userId: string;
  isConfirmed: boolean;
  userName: string;
  showConfirm?: boolean;
  disabled?: boolean;
}

export default function AdminParticipantControls({ meetingId, userId, isConfirmed, userName, showConfirm = true, disabled = false }: AdminParticipantControlsProps) {
  const [isPending, startTransition] = useTransition();

  const handleRemove = () => {
    if (disabled) return;
    if (confirm(`¿Eliminar a ${userName}?`)) {
      startTransition(async () => {
        try {
          await adminRemovePlayer(meetingId, userId);
        } catch (e) {
          console.error(e);
          alert('Error al eliminar usuario');
        }
      });
    }
  };

  const handleConfirm = () => {
    startTransition(async () => {
       try {
         await adminConfirmPlayer(meetingId, userId);
       } catch(e) {
          console.error(e);
          alert('Error al confirmar usuario');
       }
    });
  };

  return (
    <div className="flex gap-1 ml-2">
      {showConfirm && !isConfirmed && (
        <Tooltip title="Confirmar asistencia manualmente">
          <IconButton 
            size="small" 
            color="primary" 
            onClick={handleConfirm}
            disabled={isPending}
          >
            <CheckCircleIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      
      <Tooltip title="Eliminar jugador">
        <IconButton 
            size="small" 
            color="error" 
            onClick={handleRemove}
            disabled={isPending || disabled}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </div>
  );
}
