import type { ReactNode } from "react";
export default function StatusMessage({
  children,
  severity = "error",
  announce = false,
}: {
  children: ReactNode;
  severity?: "error" | "success";
  announce?: boolean;
}) {
  return (
    <p
      className={`status ${severity === "error" ? "error" : ""}`}
      role={announce ? "alert" : undefined}
    >
      {children}
    </p>
  );
}
