'use client';

import { useState, useTransition, useEffect } from 'react';
import { Autocomplete, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { searchUsers } from '@/lib/actions/user';
import { adminAddPlayer } from '@/lib/actions/meetings';

interface UserOption {
    id: string;
    name: string | null;
    email: string | null;
    isGuest: boolean;
    inputValue?: string;
}

export default function AdminAddPlayer({ meetingId, disabled = false }: { meetingId: string, disabled?: boolean }) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [value, setValue] = useState<UserOption | string | null>(null);
    const [isPending, startTransition] = useTransition();

    // Debounce search
    const [inputValue, setInputValue] = useState('');
    
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (inputValue.length < 2) {
                setOptions([]);
                return;
            }
            setLoading(true);
            try {
                const users = await searchUsers(inputValue);
                setOptions(users);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [inputValue]);

    const handleAdd = () => {
        if (!value) return;

        startTransition(async () => {
             let payload: { name: string, userId?: string } = { name: '' };
             
             if (typeof value === 'string') {
                 // Free solo input
                 payload.name = value;
             } else if (value.inputValue) {
                 // "Add xxx" option selected
                 payload.name = value.inputValue;
             } else {
                 // Existing user
                 payload = {
                     name: value.name || 'Sin nombre',
                     userId: value.id
                 };
             }

             try {
                await adminAddPlayer(meetingId, payload);
                setOpen(false);
                setValue(null);
                setInputValue('');
             } catch (error) {
                 alert('Error adding player');
                 console.error(error);
             }
        });
    };

    return (
        <>
            <IconButton onClick={() => setOpen(true)} color="primary" size="small" disabled={disabled}>
                <AddIcon />
            </IconButton>
            
            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Añadir Jugador</DialogTitle>
                <DialogContent className="pt-4">
                    <Autocomplete
                        freeSolo
                        options={options}
                        loading={loading}
                        getOptionLabel={(option) => {
                            if (typeof option === 'string') return option;
                            if (option.inputValue) return option.inputValue;
                            return `${option.name || 'Usuario'} (${option.email || 'Guest'})`;
                        }}
                        filterOptions={(options, params) => {
                            const filtered = options.slice(); // Copy
                            const { inputValue } = params;
                            // Add "Add xxx" option if input is not empty
                            if (inputValue !== '') {
                                filtered.push({
                                    inputValue,
                                    name: `Añadir "${inputValue}" como invitado`,
                                    id: 'new',
                                    email: null,
                                    isGuest: true
                                });
                            }
                            return filtered;
                        }}
                        onInputChange={(_, newInputValue) => {
                             setInputValue(newInputValue);
                        }}
                        onChange={(_, newValue) => {
                             setValue(newValue);
                        }}
                        renderInput={(params) => <TextField {...params} label="Buscar usuario o nombre" variant="outlined" margin="dense" />}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleAdd} disabled={!value || isPending} variant="contained">
                        {isPending ? 'Añadiendo...' : 'Añadir'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
