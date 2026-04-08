import { Add, Remove } from '@mui/icons-material';
import {
  Box,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  TextField,
} from '@mui/material';

/**
 * A number input with explicit −/+ stepper buttons.
 * When `select` is true, falls back to a standard TextField select.
 * The `onChange` prop always receives a synthetic event `{ target: { value } }`
 * so existing handlers need no changes.
 */
function NumberInput({
  label,
  helperText,
  value,
  onChange,
  unit,
  min,
  step = 1,
  disabled,
  fullWidth,
  margin,
  // select / children — for Gridfinity preset selects
  select,
  children,
  slotProps,
}) {
  if (select) {
    return (
      <TextField
        label={label}
        helperText={helperText}
        value={value}
        onChange={onChange}
        fullWidth={fullWidth}
        margin={margin}
        variant="standard"
        select
        slotProps={slotProps}
      >
        {children}
      </TextField>
    );
  }

  const emit = (newVal) => {
    const clamped = min !== undefined ? Math.max(min, newVal) : newVal;
    onChange({ target: { value: String(clamped) } });
  };

  return (
    <FormControl fullWidth={fullWidth} margin={margin} variant="outlined">
      <InputLabel shrink htmlFor={`ni-${label}`}>{label}</InputLabel>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2.5 }}>
        <IconButton size="small" onClick={() => emit(parseFloat(value) - step)} disabled={disabled}>
          <Remove fontSize="small" />
        </IconButton>
        <OutlinedInput
          id={`ni-${label}`}
          value={value}
          onChange={onChange}
          endAdornment={unit && <InputAdornment position="end">{unit}</InputAdornment>}
          size="small"
          label={label}
          notched
          inputProps={{ style: { textAlign: 'center', MozAppearance: 'textfield' }, type: 'number' }}
          disabled={disabled}
          sx={{ flexGrow: 1, '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' } }}
        />
        <IconButton size="small" onClick={() => emit(parseFloat(value) + step)} disabled={disabled}>
          <Add fontSize="small" />
        </IconButton>
      </Box>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}

export default NumberInput;
