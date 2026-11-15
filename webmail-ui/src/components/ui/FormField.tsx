import type { ReactNode } from "react";
export default function FormField({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <div id={`${id}-hint`} className="fieldHints">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
