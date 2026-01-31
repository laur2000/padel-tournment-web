'use client';

import Link from 'next/link';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';

interface LandingPageProps {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export default function LandingPage({ user }: LandingPageProps) {
  return (
    <Container component="main" maxWidth="md">
      <Box
        sx={{
          marginTop: 8,
          marginBottom: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <Typography component="h1" variant="h2" gutterBottom>
          Gestor de Torneos de Pádel
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          Organiza y únete a torneos de pádel con facilidad.
        </Typography>

        <Paper elevation={3} sx={{ p: 4, mt: 4, width: '100%', maxWidth: 500 }}>
          {user ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                ¡Bienvenido de nuevo, {user.name || user.email || 'Usuario'}!
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Button 
                  variant="contained" 
                  size="large" 
                  fullWidth 
                  component={Link} 
                  href="/meetings"
                >
                  Ir a Partidos
                </Button>
              </Box>
            </Box>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body1" paragraph>
                Únete a torneos existentes o crea el tuyo propio.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                <Button variant="contained" size="large" fullWidth component={Link} href="/auth/login">
                  Iniciar sesión
                </Button>
                <Button variant="outlined" size="large" fullWidth component={Link} href="/auth/register">
                  Registrarse
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>
      </Box>
    </Container>
  );
}
