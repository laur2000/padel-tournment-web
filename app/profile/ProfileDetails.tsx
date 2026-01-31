"use client";

import { useState, useTransition } from "react";
import { Avatar, IconButton, Typography, Box, Alert, Button } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { updateProfileImage } from "@/lib/actions/user";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { useSession } from "next-auth/react";

interface ProfileDetailsProps {
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export default function ProfileDetails({ user }: ProfileDetailsProps) {
  const { update } = useSession();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB
      setError("La imagen debe ser menor de 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      
      startTransition(async () => {
        try {
          await updateProfileImage(base64String);
          await update(); // Trigger session refresh from server (DB)
          setError(null);
        } catch (err) {
          setError("Error al actualizar la imagen.");
        }
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
        <Box sx={{ position: 'relative', mb: 2 }}>
            <Avatar 
                src={user.image || undefined} 
                alt={user.name || "Usuario"} 
                sx={{ width: 100, height: 100, fontSize: '2.5rem' }}
            >
                {!user.image && (user.name?.charAt(0).toUpperCase() || "U")}
            </Avatar>
            <input
                accept="image/*"
                style={{ display: 'none' }}
                id="icon-button-file"
                type="file"
                onChange={handleFileChange}
                disabled={isPending}
            />
            <label htmlFor="icon-button-file">
                <IconButton 
                    color="primary" 
                    aria-label="upload picture" 
                    component="span"
                    disabled={isPending}
                    sx={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        backgroundColor: 'white',
                        boxShadow: 1,
                        '&:hover': { backgroundColor: '#f5f5f5' }
                    }}
                >
                    <EditIcon fontSize="small" />
                </IconButton>
            </label>
        </Box>
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Typography variant="h5" align="center">
            {user.name}
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center">
            {user.email}
        </Typography>
    </Box>
  );
}
