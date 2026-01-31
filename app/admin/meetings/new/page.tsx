import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreateMeetingForm from "./CreateMeetingForm";

export default async function AdminNewMeetingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.is_admin) {
    redirect("/"); // Or /auth/login
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Crear Nuevo Partido</h1>
      <CreateMeetingForm />
    </div>
  );
}
