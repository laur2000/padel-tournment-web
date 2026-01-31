import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";

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
        <Typography variant="body1">
          <strong>Nombre:</strong> {user.name}
        </Typography>
        <Typography variant="body1" gutterBottom>
          <strong>Correo:</strong> {user.email}
        </Typography>
        
        {user.is_admin && (
           <Chip label="Administrador" color="secondary" size="small" sx={{ mt: 1 }} />
        )}

        <Divider sx={{ my: 4 }} />

        <Typography variant="h5" gutterBottom>
          Mis Partidos
        </Typography>

        {user.participations.length === 0 ? (
          <Typography color="text.secondary">Aún no te has unido a ningún partido.</Typography>
        ) : (
          <List>
            {user.participations.map((part) => {
              const statusMap: Record<string, string> = {
                "JOINED": "UNIDO",
                "WAITLISTED": "LISTA DE ESPERA",
                "LEFT": "ABANDONÓ",
                "REMOVED_BY_TRUNCATION": "ELIMINADO POR TRUNCAMIENTO"
              };

              return (
              <ListItem key={part.id} divider>
                <ListItemText
                  primary={part.meeting.place}
                  secondary={
                    <>
                      <Typography variant="body2" component="span">
                        {new Date(part.meeting.startTime).toLocaleString("es-ES", {
                          dateStyle: "full",
                          timeStyle: "short",
                          timeZone: "Europe/Madrid",
                        })}
                      </Typography>
                      <br />
                      Estado: <strong>{statusMap[part.status] || part.status}</strong>
                    </>
                  }
                />
              </ListItem>
            )})}
          </List>
        )}
      </Paper>
    </Container>
  );
}
