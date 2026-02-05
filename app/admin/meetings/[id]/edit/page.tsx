import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EditMeetingForm from "./EditMeetingForm";

export default async function EditMeetingPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
  });

  if (!meeting) {
    notFound();
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Editar Partido</h1>
      <EditMeetingForm meeting={meeting} />
    </div>
  );
}
