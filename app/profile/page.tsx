import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";

import ProfileDetails from "./ProfileDetails";
import MatchesList from "./MatchesList";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      participations: {
        include: {
          meeting: true,
        },
        orderBy: {
            meeting: {
                startTime: 'desc'
            }
        }
      },
    },
  });

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Perfil
        </Typography>

        <ProfileDetails user={user} />
        
        {user.is_admin && (
           <Chip label="Administrador" color="secondary" size="small" sx={{ mt: 1, display: 'block', mx: 'auto', width: 'fit-content' }} />
        )}

        <Divider sx={{ my: 4 }} />

        <Typography variant="h5" gutterBottom>
          Mis Partidos
        </Typography>

        <MatchesList matches={user.participations.map(p => ({
            id: p.id,
            meetingId: p.meeting.id,
            place: p.meeting.place,
            startTime: p.meeting.startTime.toISOString(),
            status: p.status,
            confirmed: !!p.confirmedAt
        }))} />
      </Paper>
    </Container>
  );
}
