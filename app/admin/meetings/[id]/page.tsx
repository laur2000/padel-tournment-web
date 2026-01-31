import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminMeetingDetailPage(props: PageProps) {
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.is_admin) {
    redirect("/");
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      participations: {
        include: {
          user: true,
        },
        orderBy: [
          { status: "asc" },
          { joinedAt: "asc" },
          { waitlistedAt: "asc" },
        ],
      },
    },
  });

  if (!meeting) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Admin: Detalles del Partido</h1>
          <Link href="/meetings" className="text-blue-600 underline">Volver al público</Link>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">{meeting.place}</h2>
        <p>Fecha: {meeting.startTime.toString()}</p>
        <p>Pistas: {meeting.numCourts}</p>
      </div>

      <h3 className="text-lg font-bold mb-4">Participantes ({meeting.participations.length})</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 border-b text-left">Usuario</th>
              <th className="py-2 px-4 border-b text-left">Email</th>
              <th className="py-2 px-4 border-b text-left">Estado</th>
              <th className="py-2 px-4 border-b text-left">Confirmado</th>
              <th className="py-2 px-4 border-b text-left">Fecha Registro</th>
            </tr>
          </thead>
          <tbody>
            {meeting.participations.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b font-medium">{p.user.name || "N/A"}</td>
                <td className="py-2 px-4 border-b text-gray-600">{p.user.email}</td>
                <td className="py-2 px-4 border-b">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      p.status === "JOINED"
                        ? "bg-green-100 text-green-800"
                        : p.status === "WAITLISTED"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {p.status === "JOINED"
                      ? "UNIDO"
                      : p.status === "WAITLISTED"
                      ? "LISTA DE ESPERA"
                      : "CANCELADO"}
                  </span>
                </td>
                <td className="py-2 px-4 border-b">
                    {p.confirmedAt ? (
                        <span title={p.confirmedAt.toString()}>✅</span>
                    ) : (
                        <span className="text-gray-400">-</span>
                    )}
                </td>
                <td className="py-2 px-4 border-b text-sm text-gray-500">
                  {p.joinedAt
                    ? new Date(p.joinedAt).toLocaleString()
                    : p.waitlistedAt
                    ? new Date(p.waitlistedAt).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}
            {meeting.participations.length === 0 && (
                <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-500">No hay participantes</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
