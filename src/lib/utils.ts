import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMetric(value: number | null, digits = 3): string {
  if (value === null) return "待实现";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

