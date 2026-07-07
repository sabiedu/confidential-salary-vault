export function Spinner({ label }: { label?: string }) {
  return (
    <span className="row" style={{ justifyContent: "center" }}>
      <span className="spinner" />
      {label && <span className="faint">{label}</span>}
    </span>
  );
}

export function CenterSpinner({ label }: { label?: string }) {
  return (
    <div className="center-spin">
      <Spinner label={label} />
    </div>
  );
}
