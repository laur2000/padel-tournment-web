import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import MeetingActions from "./MeetingActions";
import { ParticipationStatus, TeamSide } from "@prisma/client";
import Link from "next/link";
import LocationToggle from "./LocationToggle";
import AdminParticipantControls from "./AdminParticipantControls";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MeetingDetailPage(props: PageProps) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      participations: {
        include: {
          user: {
            select: { name: true, image: true, id: true },
          },
        },
        orderBy: [
          { status: "asc" }, // JOINED first (alphabetically J < W)
          { joinedAt: "asc" },
          { waitlistedAt: "asc" },
        ]
      },
      matches: {
        include: {
          teams: {
            include: {
              members: {
                include: {
                  user: {
                    select: { name: true, image: true, id: true },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          courtNumber: "asc",
        },
      },
    },
  });

  if (!meeting) {
    notFound();
  }

  const joinedParticipants = meeting.participations.filter(
    (p) => p.status === ParticipationStatus.JOINED
  );
  
  const waitlistedParticipants = meeting.participations.filter(
    (p) => p.status === ParticipationStatus.WAITLISTED
  );

  let userStatus: "JOINED" | "WAITLISTED" | "LEFT" | "NONE" = "NONE";
  let userParticipation = null;
  let waitlistPosition = 0;

  if (session?.user?.id) {
    userParticipation = meeting.participations.find(
      (p) => p.userId === session.user.id
    );
    if (userParticipation) {
      if (
        userParticipation.status === ParticipationStatus.JOINED ||
        userParticipation.status === ParticipationStatus.WAITLISTED || 
        userParticipation.status === ParticipationStatus.LEFT
      ) {
         // Map Prisma enum to our simple union type
         userStatus = userParticipation.status as "JOINED" | "WAITLISTED" | "LEFT";
      }
    }

    if (userStatus === 'WAITLISTED') {
        waitlistPosition = waitlistedParticipants.findIndex(p => p.userId === session.user.id) + 1;
    }
  }

  // Confirm logic: Allow confirm if joined and not confirmed. 
  // "only be able to confirm match in the 24h interval before the match starts"
  
  const now = new Date();
  const startTime = new Date(meeting.startTime);
  const diffHours = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  const canConfirm = diffHours <= 24 && diffHours >= 0;
  
  const minutesUntilStart = diffHours * 60;
  const allConfirmed = joinedParticipants.length > 0 && joinedParticipants.every(p => p.confirmedAt);
  const isLocked = minutesUntilStart < 15 && minutesUntilStart > 0 && allConfirmed;

  const isConfirmed = !!userParticipation?.confirmedAt;

  return (
    <div className="container mx-auto max-w-4xl">
      <div className="mb-6">
        <Link href="/meetings" className="text-blue-600 hover:underline">
          &larr; Volver a partidos
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h1 className="text-3xl font-bold mb-4">{meeting.place}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 mb-6">
          <div>
            <p className="font-semibold">Fecha:</p>
            <p>
              {new Date(meeting.startTime).toLocaleString("es-ES", {
                dateStyle: "full",
                timeStyle: "short",
                timeZone: "Europe/Madrid",
              })}
            </p>
          </div>
          <div>
            <p className="font-semibold">Pistas:</p>
            <p>{meeting.numCourts} ({meeting.numCourts * 4} Jugadores)</p>
          </div>
        </div>

        {meeting.latitude && meeting.longitude && (
            <LocationToggle latitude={meeting.latitude} longitude={meeting.longitude} />
        )}

        {session?.user ? (
            <div className="border-t pt-6">
                <MeetingActions 
                    meetingId={meeting.id}
                    userStatus={userStatus}
                    isConfirmed={isConfirmed}
                    canConfirm={canConfirm}
                    isLocked={isLocked}
                    isAdmin={session.user.is_admin}
                />
                {userStatus === "WAITLISTED" && (
                    <div className="mt-2 text-yellow-700 bg-yellow-50 p-3 rounded">
                        Estás en la posición <strong>#{waitlistPosition}</strong> de la lista de espera.
                    </div>
                )}
            </div>
        ) : (
            <div className="bg-gray-100 p-4 rounded text-center">
                <Link href="/auth/login" className="text-blue-600 font-bold hover:underline">Inicia sesión</Link> para apuntarte.
            </div>
        )}
      </div>

      {meeting.matchmakingGeneratedAt && meeting.matches.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-slate-800">Partidos Generados</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {meeting.matches.map((match) => (
              <div key={match.id} className="bg-white min-w-[336px] p-4 rounded shadow border border-gray-100">
                <h3 className="font-bold text-lg mb-3 text-center border-b pb-2">
                  Pista {match.courtNumber}
                </h3>
                <div className="flex justify-between items-center gap-2">
                  <div className="flex-1 text-center bg-blue-50 p-2 rounded">
                    <div className="text-xs text-blue-800 font-bold mb-1 uppercase">Equipo A</div>
                    {match.teams
                      .find((t) => t.side === TeamSide.A)
                      ?.members.map((m) => {
                        const displayName = m.user.name || "Usuario";
                        return (
                          <div key={m.id} className="text-sm truncate" title={displayName}>
                            {displayName.length > 16 ? `${displayName.slice(0, 16)}...` : displayName}
                          </div>
                        );
                      })}
                  </div>
                  <div className="font-bold text-gray-400">VS</div>
                  <div className="flex-1 text-center bg-red-50 p-2 rounded">
                    <div className="text-xs text-red-800 font-bold mb-1 uppercase">Equipo B</div>
                    {match.teams
                      .find((t) => t.side === TeamSide.B)
                      ?.members.map((m) => {
                        const displayName = m.user.name || "Usuario";
                        return (
                          <div key={m.id} className="text-sm truncate" title={displayName}>
                            {displayName.length > 16 ? `${displayName.slice(0, 16)}...` : displayName}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            Jugadores Confirmados 
            <span className="text-sm font-normal bg-green-100 text-green-800 px-2 py-1 rounded-full">
                {joinedParticipants.length} / {meeting.numCourts * 4}
            </span>
          </h3>
          <ul className="bg-white rounded-lg shadow divide-y">
            {joinedParticipants.length === 0 ? (
                <li className="p-4 text-gray-500">Aún no hay jugadores apuntados.</li>
            ) : (
                joinedParticipants.map((p) => (
                    <li key={p.userId} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                {p.user.image ? (
                                    <img src={p.user.image} alt={p.user.name || "User"} />
                                ) : (
                                    <span className="text-xs font-bold text-gray-500">
                                        {(p.user.name || "U").charAt(0).toUpperCase()}
                                    </span>
                                )}
                             </div>
                             <span>{p.user.name || "Usuario"}</span>
                        </div>
                        <div className="flex items-center">
                            {p.confirmedAt && (
                                <span className="mr-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full border border-green-200">
                                    Confirmado
                                </span>
                            )}
                            {session?.user?.is_admin && (
                                <AdminParticipantControls 
                                    meetingId={meeting.id}
                                    userId={p.userId}
                                    isConfirmed={!!p.confirmedAt}
                                    userName={p.user.name || "Usuario"}
                                />
                            )}
                        </div>
                    </li>
                ))
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            Lista de Espera 
            <span className="text-sm font-normal bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                {waitlistedParticipants.length}
            </span>
          </h3>
           <ul className="bg-white rounded-lg shadow divide-y">
             {waitlistedParticipants.length === 0 ? (
                <li className="p-4 text-gray-500">Lista de espera vacía.</li>
             ) : (
                waitlistedParticipants.map((p, idx) => (
                    <li key={p.userId} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-mono text-sm">#{idx + 1}</span>
                        <span>{p.user.name || "Usuario"}</span>
                      </div>
                      {session?.user?.is_admin && (
                        <AdminParticipantControls 
                            meetingId={meeting.id}
                            userId={p.userId}
                            isConfirmed={false}
                            userName={p.user.name || "Usuario"}
                            showConfirm={false}
                        />
                      )}
                    </li>
                ))
             )}
           </ul>
        </div>
      </div>
    </div>
  );
}
