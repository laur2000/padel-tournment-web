"use client";

import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Link from "next/link";

interface MatchItem {
  id: string;
  meetingId: string;
  place: string;
  startTime: string; 
  status: string;
  confirmed: boolean;
}

interface MatchesListProps {
  matches: MatchItem[];
}

export default function MatchesList({ matches }: MatchesListProps) {
  if (matches.length === 0) {
    return <Typography color="text.secondary">Aún no te has unido a ningún partido.</Typography>;
  }

  return (
    <List>
      {matches.map((match) => {
        const statusMap: Record<string, string> = {
          "JOINED": "UNIDO",
          "WAITLISTED": "LISTA DE ESPERA",
          "LEFT": "ABANDONÓ",
          "REMOVED_BY_TRUNCATION": "ELIMINADO POR TRUNCAMIENTO"
        };

        return (
          <ListItem key={match.id} disablePadding divider>
            <ListItemButton component={Link} href={`/meetings/${match.meetingId}`}>
              <ListItemText
                primary={match.place}
                secondaryTypographyProps={{ component: "div" }}
                secondary={
                  <>
                    <Typography variant="body2" component="span">
                      {new Date(match.startTime).toLocaleString("es-ES", {
                        dateStyle: "full",
                        timeStyle: "short",
                        timeZone: "Europe/Madrid",
                      })}
                    </Typography>
                    <br />
                    Estado: <strong>{statusMap[match.status] || match.status}</strong>
                    {match.confirmed && (
                      <Chip 
                        label="CONFIRMADO" 
                        size="small" 
                        color="success" 
                        sx={{ ml: 1, height: 20, fontSize: '0.65rem' }} 
                      />
                    )}
                  </>
                }
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
