'use client';

import { useState, useTransition } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { addGuest } from '@/lib/actions/meetings';
import Tooltip from '@mui/material/Tooltip';

export default function UserAddGuest({ meetingId, disabled = false }: { meetingId: string, disabled?: boolean }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleAdd = () => {
        if (!name.trim()) return;

        startTransition(async () => {
             try {
                await addGuest(meetingId, name);
                setName('');
                setOpen(false);
             } catch (e: any) {
                alert(e.message || 'Error al añadir invitado');
             }
        });
    };

    return (
        <>
            <Tooltip title="Añadir invitado">
                <span>
                    <IconButton 
                        onClick={() => setOpen(true)} 
                        color="primary" 
                        size="small"
                        disabled={disabled || isPending}
                        sx={{ ml: 1,border: '1px solid currentColor' }}
                    >
                        <AddIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>

            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Añadir Invitado</DialogTitle>
                <DialogContent>
                    <p className="text-sm text-gray-500 mb-4">
                        Añade un usuario invitado.
                    </p>
                    <TextField 
                        autoFocus
                        margin="dense"
                        label="Nombre del invitado"
                        fullWidth
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAdd();
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleAdd} disabled={!name.trim() || isPending} variant="contained">
                        {isPending ? 'Añadiendo...' : 'Añadir'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
