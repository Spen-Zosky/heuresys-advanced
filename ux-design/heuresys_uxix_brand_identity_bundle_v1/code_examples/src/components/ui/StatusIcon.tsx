import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle } from "lucide-react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "disabled";

type StatusIconProps = {
  status: StatusTone;
  className?: string;
};

const iconByStatus = {
  neutral: CircleDashed,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  disabled: CircleDashed,
};

const classByStatus = {
  neutral: "text-[var(--color-icon-default)]",
  info: "text-[var(--color-icon-info)]",
  success: "text-[var(--color-icon-success)]",
  warning: "text-[var(--color-icon-warning)]",
  danger: "text-[var(--color-icon-danger)]",
  disabled: "text-[var(--color-icon-disabled)]",
};

export function StatusIcon({ status, className = "h-4 w-4" }: StatusIconProps) {
  const Icon = iconByStatus[status];

  return <Icon className={`${className} ${classByStatus[status]}`} aria-hidden="true" />;
}
