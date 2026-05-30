"use client";

import { useDeferredValue, useEffect, useState } from "react";

type ClienteOption = {
  id: string;
  nombre: string;
  rut: string;
};

type ClienteSearchFieldProps = {
  clientes: ClienteOption[];
  inputId: string;
  selectedClienteId?: string;
};

function formatClienteLabel(cliente: ClienteOption): string {
  return `${cliente.nombre} (${cliente.rut})`;
}

const ALL_CLIENTES_LABEL = "Todos los clientes";
const MIN_SEARCH_LENGTH = 3;

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function ClienteSearchField({
  clientes,
  inputId,
  selectedClienteId,
}: ClienteSearchFieldProps) {
  const selectedCliente =
    clientes.find((cliente) => cliente.id === selectedClienteId) ?? null;

  const [query, setQuery] = useState(selectedCliente ? formatClienteLabel(selectedCliente) : "");
  const [selectedId, setSelectedId] = useState(selectedClienteId ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setSelectedId(selectedClienteId ?? "");
    setQuery(selectedCliente ? formatClienteLabel(selectedCliente) : "");
  }, [selectedCliente, selectedClienteId]);

  const normalizedQuery = normalizeSearchValue(deferredQuery);
  const selectedLabel = selectedCliente ? formatClienteLabel(selectedCliente) : "";
  const isAllClientesQuery = normalizedQuery === normalizeSearchValue(ALL_CLIENTES_LABEL);
  const canSearchClientes = normalizedQuery.length >= MIN_SEARCH_LENGTH;
  const filteredClientes =
    normalizedQuery.length === 0 || isAllClientesQuery || !canSearchClientes
      ? []
      : clientes
          .filter((cliente) =>
            normalizeSearchValue(`${cliente.nombre} ${cliente.rut}`).includes(normalizedQuery),
          )
          .slice(0, 8);

  const showResults = isOpen;

  return (
    <div className="relative">
      <input
        id={inputId}
        type="text"
        value={query}
        placeholder="Escribe nombre o RUT"
        autoComplete="off"
        className="h-14 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (
            selectedId &&
            query === selectedLabel &&
            selectedLabel.includes(")") &&
            (event.key === "Backspace" || event.key === "Delete")
          ) {
            event.preventDefault();
            setQuery("");
            setSelectedId("");
            setIsOpen(true);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          const exactMatch =
            clientes.find(
              (cliente) =>
                normalizeSearchValue(formatClienteLabel(cliente)) ===
                normalizeSearchValue(nextValue),
            ) ?? null;

          if (exactMatch) {
            setSelectedId(exactMatch.id);
            return;
          }

          if (nextValue.trim().length === 0 || nextValue !== selectedLabel) {
            setSelectedId("");
          }
        }}
      />

      <input type="hidden" name="clienteId" value={selectedId} />

      {showResults ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.625rem)] z-10 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/70">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-base text-zinc-700 transition hover:bg-zinc-50"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery(ALL_CLIENTES_LABEL);
              setSelectedId("");
              setIsOpen(false);
            }}
          >
            <span>Todos los clientes</span>
            {!selectedId ? <span className="text-xs text-zinc-400">Actual</span> : null}
          </button>

          {filteredClientes.length > 0 ? (
            <div className="max-h-64 overflow-y-auto border-t border-zinc-100">
              {filteredClientes.map((cliente) => {
                const label = formatClienteLabel(cliente);

                return (
                  <button
                    key={cliente.id}
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-base text-zinc-700 transition hover:bg-zinc-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setQuery(label);
                      setSelectedId(cliente.id);
                      setIsOpen(false);
                    }}
                  >
                    <span>{label}</span>
                    {selectedId === cliente.id ? (
                      <span className="text-xs text-rose-600">Seleccionado</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : normalizedQuery.length > 0 && !isAllClientesQuery && !canSearchClientes ? (
            <div className="border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">
              Escribe al menos 3 letras para buscar clientes.
            </div>
          ) : normalizedQuery.length > 0 && !isAllClientesQuery ? (
            <div className="border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">
              No hay coincidencias para tu busqueda.
            </div>
          ) : null}
        </div>
      ) : null}

      {query.trim().length > 0 && !selectedId && !isAllClientesQuery ? (
        <p className="mt-2 text-xs text-zinc-500">
          {normalizeSearchValue(query).length < MIN_SEARCH_LENGTH
            ? "Escribe al menos 3 letras para ver coincidencias."
            : "Selecciona una coincidencia para aplicar el filtro."}
        </p>
      ) : null}
    </div>
  );
}
