"use client";

import type { ComponentProps } from "react";

type RutInputProps = Omit<ComponentProps<"input">, "onChange" | "type">;

function normalizeRut(value: string): string {
  const allowedCharacters = value.toUpperCase().replace(/[^0-9K]/g, "");
  const numbers = allowedCharacters.replace(/K/g, "");

  return allowedCharacters.includes("K")
    ? `${numbers.slice(0, 8)}K`
    : numbers.slice(0, 9);
}

function formatRut(value: string): string {
  const normalizedRut = normalizeRut(value);

  if (normalizedRut.length <= 1) {
    return normalizedRut;
  }

  const body = normalizedRut.slice(0, -1);
  const checkDigit = normalizedRut.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${formattedBody}-${checkDigit}`;
}

export function RutInput({ defaultValue, ...props }: RutInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={12}
      defaultValue={formatRut(String(defaultValue ?? ""))}
      onChange={(event) => {
        event.currentTarget.value = formatRut(event.currentTarget.value);
      }}
    />
  );
}
