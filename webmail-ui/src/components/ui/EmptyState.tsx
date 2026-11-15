import type { ReactNode } from "react";
export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="emptyIcon" aria-hidden="true">
        {icon}
      </span>
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}
