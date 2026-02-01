import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

// Helper to format date for Madrid (approximate using Intl or date-fns if tz needed, 
// strictly speaking date-fns doesn't do TZ without date-fns-tz, 
// but for now I'll use standard formatting which uses server time. 
// Ideally we should convert to UTC+1/UTC+2)

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  
  const meetings = await prisma.meeting.findMany({
    where: {
      startTime: {
        gte: new Date(),
      },
      // If user is not logged in, we just show all. If logged in, we fetch participations to split.
    },
    orderBy: {
      startTime: "asc",
    },
    include: {
        _count: {
            select: { participations: { where: { status: "JOINED" } } }
        },
        participations: userId ? {
            where: { userId: userId },
            select: { status: true }
        } : false
    }
  });

  const myMeetings = meetings.filter(m => 
    m.participations && m.participations.length > 0 && 
    (m.participations[0].status === 'JOINED' || m.participations[0].status === 'WAITLISTED')
  );

  const availableMeetings = meetings.filter(m => 
    !m.participations || m.participations.length === 0 || m.participations[0].status === 'LEFT'
  );

  // Reusable card component (inline for simplicity or extracted)
  const MeetingCard = ({ meeting }: { meeting: typeof meetings[0] }) => (
    <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="block h-full">
        <div className="border rounded-lg p-6 shadow-sm hover:shadow-md transition bg-white h-full flex flex-col justify-between">
            <div>
                <h2 className="text-xl font-semibold mb-2">{meeting.place}</h2>
                <p className="text-gray-600 mb-2">
                    {new Date(meeting.startTime).toLocaleString("es-ES", {
                    dateStyle: "full",
                    timeStyle: "short",
                    timeZone: "Europe/Madrid",
                    })}
                </p>
            </div>
            <div className="flex justify-between items-center mt-4">
                <span className="text-sm font-medium bg-gray-100 px-3 py-1 rounded-full">
                {meeting._count.participations} / {meeting.numCourts * 4} Jugadores
                </span>
                <span className="text-blue-600 text-sm font-semibold">Ver detalles &rarr;</span>
            </div>
        </div>
    </Link>
  );

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Partidos</h1>
        {session?.user?.is_admin && (
          <Link
            href="/admin/meetings/new"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Crear Partido
          </Link>
        )}
      </div>

      {myMeetings.length > 0 && (
          <div className="mb-10">
              <h2 className="text-2xl font-semibold mb-4 text-blue-800 border-b pb-2">Mis Partidos</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {myMeetings.map(meeting => <MeetingCard key={meeting.id} meeting={meeting} />)}
              </div>
          </div>
      )}

      {availableMeetings.length > 0 && (
        <div>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 border-b pb-2">
                {myMeetings.length > 0 ? "Otros Partidos Disponibles" : "Próximos Partidos"}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableMeetings.map(meeting => <MeetingCard key={meeting.id} meeting={meeting} />)}
            </div>
        </div>
      )}

      {meetings.length === 0 && (
          <p className="text-gray-500 text-center py-10">No hay partidos programados próximamente.</p>
      )}
    </div>
  );
}
