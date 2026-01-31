'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';

import { registerUser } from '@/lib/actions/auth';

const initialState = {
  message: '',
  errors: {},
};

export default function RegisterPage() {
  const [state, dispatch] = React.useActionState(registerUser, initialState);
  const router = useRouter();

  React.useEffect(() => {
    if (state.message === 'User created successfully.') {
      // Redirect to login after short delay or immediately
      const timer = setTimeout(() => {
        router.push('/auth/login?registered=true');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.message, router]);

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%', borderRadius: 2 }}>
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            Registrarse
          </Typography>

          {state.message && (
             <Alert severity={state.message === 'User created successfully.' ? 'success' : 'error'} sx={{ mb: 2 }}>
               {state.message === 'User created successfully.' ? 'Usuario creado exitosamente.' : state.message}
             </Alert>
          )}

          <Box component="form" action={dispatch} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="name"
              label="Nombre Completo"
              name="name"
              autoComplete="name"
              autoFocus
              error={!!state.errors?.name}
              helperText={state.errors?.name?.[0]}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Correo Electrónico"
              name="email"
              autoComplete="email"
              error={!!state.errors?.email}
              helperText={state.errors?.email?.[0]}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Contraseña"
              type="password"
              id="password"
              autoComplete="new-password"
              error={!!state.errors?.password}
              helperText={state.errors?.password?.[0]}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Registrarse
            </Button>
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Link href="/auth/login" style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="primary">
                  ¿Ya tienes cuenta? Inicia sesión
                </Typography>
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
