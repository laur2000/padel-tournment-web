import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Helper to format date for Madrid (approximate using Intl or date-fns if tz needed, 
// strictly speaking date-fns doesn't do TZ without date-fns-tz, 
// but for now I'll use standard formatting which uses server time. 
// Ideally we should convert to UTC+1/UTC+2)

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const session = await getServerSession(authOptions);
  
  const meetings = await prisma.meeting.findMany({
    where: {
      startTime: {
        gte: new Date(),
      },
    },
    orderBy: {
      startTime: "asc",
    },
    include: {
        _count: {
            select: { participations: { where: { status: "JOINED" } } }
        }
    }
  });

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Próximos Partidos</h1>
        {session?.user?.is_admin && (
          <Link
            href="/admin/meetings/new"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Crear Partido
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {meetings.length === 0 ? (
          <p className="text-gray-500 col-span-full">No hay partidos programados próximamente.</p>
        ) : (
          meetings.map((meeting) => (
            <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="block">
              <div className="border rounded-lg p-6 shadow-sm hover:shadow-md transition bg-white">
                <h2 className="text-xl font-semibold mb-2">{meeting.place}</h2>
                <p className="text-gray-600 mb-2">
                  {new Date(meeting.startTime).toLocaleString("es-ES", {
                    dateStyle: "full",
                    timeStyle: "short",
                    timeZone: "Europe/Madrid",
                  })}
                </p>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-sm font-medium bg-gray-100 px-3 py-1 rounded-full">
                    {meeting._count.participations} / {meeting.numCourts * 4} Jugadores
                  </span>
                  <span className="text-blue-600 text-sm font-semibold">Ver detalles &rarr;</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
