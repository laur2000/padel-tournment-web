"use client";

import { useTransition } from "react";
import { joinMeeting, leaveMeeting, confirmAttendance, deleteMeeting } from "@/lib/actions/meetings";
import { useRouter } from "next/navigation";

interface MeetingActionsProps {
  meetingId: string;
  userStatus: "JOINED" | "WAITLISTED" | "LEFT" | "NONE";
  isConfirmed: boolean;
  canConfirm: boolean; 
  isLocked: boolean;
  isAdmin: boolean;
}

export default function MeetingActions({
  meetingId,
  userStatus,
  isConfirmed,
  canConfirm,
  isLocked,
  isAdmin,
}: MeetingActionsProps) {
  const [isJoinPending, startJoinTransition] = useTransition();
  const [isLeavePending, startLeaveTransition] = useTransition();
  const [isConfirmPending, startConfirmTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  
  const router = useRouter();

  const handleJoin = () => {
    startJoinTransition(async () => {
      try {
        await joinMeeting(meetingId);
      } catch (error) {
        alert("Error al unirse al partido");
      }
    });
  };

  const handleLeave = () => {
    if (!confirm("¿Estás seguro de que quieres salir?")) return;
    startLeaveTransition(async () => {
      try {
        await leaveMeeting(meetingId);
      } catch (error) {
        alert("Error al salir del partido");
      }
    });
  };

  const handleConfirm = () => {
    startConfirmTransition(async () => {
      try {
        await confirmAttendance(meetingId);
      } catch (error) {
        alert("Error al confirmar asistencia");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("¿ESTÁS SEGURO? Esto eliminará el partido permanentemente.")) return;
    startDeleteTransition(async () => {
        try {
            await deleteMeeting(meetingId);
        } catch(error: any) {
            if (error.message === "NEXT_REDIRECT") return;
            alert("Error al eliminar el partido");
        }
    });
  }

  const renderUserActions = () => {
    if (userStatus === "NONE" || userStatus === "LEFT") {
        return (
          <button
            onClick={handleJoin}
            disabled={isJoinPending}
            className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isJoinPending ? "Uniéndote..." : "Unirse al Partido"}
          </button>
        );
      }
    
      return (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg border">
            <p className="font-medium text-lg mb-2">
              Estado:{" "}
              <span
                className={
                  userStatus === "JOINED" ? "text-green-600" : "text-yellow-600"
                }
              >
                {userStatus === "JOINED" ? "Apuntado" : "En lista de espera"}
              </span>
            </p>
            
            {userStatus === "JOINED" && (
                <p className="text-sm text-gray-600">
                    {isConfirmed ? (
                        <span className="text-green-600 font-bold">✅ Asistencia Confirmada</span>
                    ) : (
                       canConfirm ? "⚠️ Por favor confirma tu asistencia" : "La confirmación se abrirá 24h antes"
                    )}
                </p>
            )}
          </div>
    
          <div className="flex gap-4">
            {userStatus === "JOINED" && !isConfirmed && canConfirm && (
              <button
                onClick={handleConfirm}
                disabled={isConfirmPending || isLeavePending}
                className="flex-1 bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                {isConfirmPending ? "Confirmando..." : "Confirmar Asistencia"}
              </button>
            )}
    
            <button
              onClick={handleLeave}
              disabled={isLeavePending || isConfirmPending || isLocked}
              className="flex-1 bg-red-100 text-red-700 font-bold py-2 px-4 rounded hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={isLocked ? "No puedes salir, el partido está confirmado y comienza en breve." : ""}
            >
              {isLeavePending ? "Saliendo..." : "Salir del Partido"}
            </button>
          </div>
        </div>
      );
  }

  return (
    <div className="space-y-6">
        {renderUserActions()}

        {isAdmin && (
            <div className="border-t pt-4 mt-4">
                <button
                    onClick={handleDelete}
                    disabled={isDeletePending}
                    className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-700 transition disabled:opacity-50 text-sm uppercase tracking-wider"
                >
                    {isDeletePending ? "Eliminando..." : "Eliminar Partido"}
                </button>
            </div>
        )}
    </div>
  );
}
