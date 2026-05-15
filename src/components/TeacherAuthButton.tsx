import { AccountCircle, Logout } from '@mui/icons-material';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import type { AuthResponse, TeacherPublic } from '../shared/types';

type TeacherAuthButtonProps = {
  teacher: TeacherPublic | null;
  onTeacherChange: (teacher: TeacherPublic | null) => void;
};

function TeacherAuthButton({ teacher, onTeacherChange }: TeacherAuthButtonProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      setError(mode === 'login' ? 'Connexion impossible.' : 'Inscription impossible.');
      return;
    }

    const payload = (await response.json()) as AuthResponse;
    onTeacherChange(payload.teacher);
    setOpen(false);
    setPassword('');
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    onTeacherChange(null);
  };

  return (
    <Box sx={{ position: 'absolute', right: 20, top: 16, zIndex: 10 }}>
      {teacher ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2">{teacher.email}</Typography>
          <Button startIcon={<Logout />} variant="outlined" size="small" onClick={logout}>
            Déconnexion
          </Button>
        </Stack>
      ) : (
        <Button startIcon={<AccountCircle />} variant="outlined" size="small" onClick={() => setOpen(true)}>
          Connexion enseignant
        </Button>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{mode === 'login' ? 'Connexion enseignant' : 'Créer un compte enseignant'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} fullWidth />
            <TextField label="Mot de passe" type="password" value={password} onChange={(event) => setPassword(event.target.value)} fullWidth />
            {error ? <Typography color="error">{error}</Typography> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte'}
          </Button>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={submit} disabled={email.length === 0 || password.length < 8}>
            {mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TeacherAuthButton;
