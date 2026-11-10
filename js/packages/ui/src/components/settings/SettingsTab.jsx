import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, CardContent, CardHeader, Stack, TextField, InputAdornment, IconButton, Box, Tooltip } from '@mui/material';
import { cloningActions } from '@opencloning/store/cloning';
import { Info as InfoIcon } from '@mui/icons-material';

const { setGlobalPrimerSettings } = cloningActions;

function HeaderWithTooltip() {
    const tooltipMessage = (
        <Box>
            These settings affect thermodynamic calculations for:
            <ul>
                <li>Primer design</li>
                <li>Values displayed in the primer table</li>
                <li>Values displayed in the PCR details</li>
            </ul>
        </Box>
    )
    const title = (
        <Box>
            Global Primer Settings
            <Tooltip title={tooltipMessage} arrow placement="right">
                <IconButton size="small">
                    <InfoIcon />
                </IconButton>
            </Tooltip>
        </Box>
    )
    return (
        <CardHeader
            title={title}
        />
    )
}





function GlobalPrimerSettingsSection() {
    const dispatch = useDispatch();
    const current = useSelector((state) => state.cloning.globalPrimerSettings);
    const [editing, setEditing] = React.useState(false);
    const [form, setForm] = React.useState({
        primer_dna_conc: current.primer_dna_conc,
        primer_salt_monovalent: current.primer_salt_monovalent,
        primer_salt_divalent: current.primer_salt_divalent,
    });

    const fieldsValid = {
        primer_dna_conc: form.primer_dna_conc > 0,
        primer_salt_monovalent: form.primer_salt_monovalent > 0,
        primer_salt_divalent: form.primer_salt_divalent > 0,
    }
    const allFieldsValid = Object.values(fieldsValid).every((valid) => valid);

    React.useEffect(() => {
        if (!editing) {
            setForm({
                primer_dna_conc: current.primer_dna_conc,
                primer_salt_monovalent: current.primer_salt_monovalent,
                primer_salt_divalent: current.primer_salt_divalent,
            });
        }
    }, [current, editing]);

    const onChange = (key) => (e) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

    const onCancel = () => {
        setEditing(false);
        setForm({
            primer_dna_conc: current.primer_dna_conc,
            primer_salt_monovalent: current.primer_salt_monovalent,
            primer_salt_divalent: current.primer_salt_divalent,
        });
    };

    const onSave = () => {
        dispatch(setGlobalPrimerSettings({
            primer_dna_conc: Number(form.primer_dna_conc),
            primer_salt_monovalent: Number(form.primer_salt_monovalent),
            primer_salt_divalent: Number(form.primer_salt_divalent),
        }));
        setEditing(false);
    };

    return (
        <Card className="settings-tab">
            <HeaderWithTooltip />
            <CardContent sx={{ margin: 'auto' }}>

                <Stack spacing={2} sx={{ maxWidth: 300, margin: 'auto' }}>
                    <TextField
                        label="Primer DNA concentration"
                        type="number"
                        value={form.primer_dna_conc}
                        onChange={onChange('primer_dna_conc')}
                        inputProps={{ min: 0, step: '1' }}
                        variant="standard"
                        required
                        disabled={!editing}
                        InputProps={{
                            endAdornment: <InputAdornment position="end">nM</InputAdornment>,
                        }}
                        error={!fieldsValid.primer_dna_conc}
                        helperText={!fieldsValid.primer_dna_conc ? 'Must be greater than 0' : ''}
                    />
                    <TextField
                        label="Monovalent ions"
                        type="number"
                        value={form.primer_salt_monovalent}
                        onChange={onChange('primer_salt_monovalent')}
                        inputProps={{ min: 0, step: '0.1' }}
                        variant="standard"
                        required
                        disabled={!editing}
                        InputProps={{
                            endAdornment: <InputAdornment position="end">mM</InputAdornment>,
                        }}
                        error={!fieldsValid.primer_salt_monovalent}
                        helperText={!fieldsValid.primer_salt_monovalent ? 'Must be greater than 0' : ''}
                    />
                    <TextField
                        label="Divalent ions"
                        type="number"
                        value={form.primer_salt_divalent}
                        onChange={onChange('primer_salt_divalent')}
                        inputProps={{ min: 0, step: '0.1' }}
                        variant="standard"
                        required
                        disabled={!editing}
                        InputProps={{
                            endAdornment: <InputAdornment position="end">mM</InputAdornment>,
                        }}
                        error={!fieldsValid.primer_salt_divalent}
                        helperText={!fieldsValid.primer_salt_divalent ? 'Must be greater than 0' : ''}
                    />
                    {!editing ? (
                        <Stack direction="row" justifyContent="center">
                            <Button variant="contained" onClick={() => setEditing(true)}>Edit</Button>
                        </Stack>
                    ) : (
                        <Stack direction="row" spacing={1} justifyContent="center">
                            <Button onClick={onCancel}>Cancel</Button>
                            <Button variant="contained" onClick={onSave} disabled={!allFieldsValid}>Save</Button>
                        </Stack>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

function SettingsTab() {
    return (
        <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: 600, width: '100%' }}>
                <GlobalPrimerSettingsSection />
            </div>
        </div>
    );
}

export default SettingsTab;


