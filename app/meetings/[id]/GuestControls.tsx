'use client';

import { useTransition } from 'react';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Tooltip from '@mui/material/Tooltip';
import { removeGuest, confirmGuest } from '@/lib/actions/meetings';

interface GuestControlsProps {
  meetingId: string;
  guestUserId: string;
  isConfirmed: boolean;
  canConfirm: boolean;
  userName: string;
  disabled?: boolean;
}

export default function GuestControls({ meetingId, guestUserId, isConfirmed, canConfirm, userName, disabled = false }: GuestControlsProps) {
  const [isPending, startTransition] = useTransition();

  const handleRemove = () => {
    if (disabled) return;
    if (confirm(`¿Eliminar a tu invitado ${userName}?`)) {
        startTransition(async () => {
            try {
                await removeGuest(meetingId, guestUserId);
            } catch (e: any) {
                alert(e.message || 'Error al eliminar invitado');
            }
        });
    }
  };

  const handleConfirm = () => {
    if (disabled) return;
    startTransition(async () => {
        try {
            await confirmGuest(meetingId, guestUserId);
        } catch (e: any) {
            alert(e.message || 'Error al confirmar invitado');
        }
    });
  };

  return (
    <div className="flex gap-1 ml-2">
      {/* Confirm Button: Only if not confirmed and within time window */}
      {!isConfirmed && (
          <Tooltip title={canConfirm ? "Confirmar asistencia" : "Aún no disponible para confirmar"}>
            <span>
                <IconButton 
                    onClick={handleConfirm} 
                    color="success" 
                    disabled={disabled || isPending || !canConfirm}
                    size="small"
                >
                    <CheckCircleIcon />
                </IconButton>
            </span>
          </Tooltip>
      )}

      {/* Remove Button */}
      <Tooltip title="Eliminar invitado">
        <IconButton 
            onClick={handleRemove} 
            color="error" 
            disabled={disabled || isPending}
            size="small"
        >
            <DeleteIcon />
        </IconButton>
      </Tooltip>
    </div>
  );
}
