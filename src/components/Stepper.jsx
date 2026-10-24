import NumberInput from './NumberInput';

/** NumberInput that reports plain numbers and ignores unparsable input. */
function Stepper({ value, onChange, ...props }) {
  return (
    <NumberInput
      value={value}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
      fullWidth
      margin="none"
      {...props}
    />
  );
}

export default Stepper;
