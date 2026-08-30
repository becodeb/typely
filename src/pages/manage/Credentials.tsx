/* Credenciales recién emitidas.
 *
 * Este es el momento más delicado de toda la gestión: las contraseñas
 * temporales se muestran UNA sola vez y no se guardan en claro en ningún
 * lado. Si el admin cierra esto sin anotarlas, la única salida es resetear
 * cuenta por cuenta.
 *
 * Por eso el panel:
 *  - avisa, arriba y en primer plano, que no se van a volver a ver;
 *  - ofrece copiar e imprimir antes que cerrar;
 *  - pide una confirmación explícita para cerrarse, en vez de una "x"
 *    chiquita que se toca sin querer.
 *
 * Se usa tanto al crear un alumno suelto como al importar un curso entero.
 */

import { useState } from "react";
import type { IssuedCredentials } from "../../types";
import { Button, Card } from "./ui";

export function CredentialsPanel({
  title,
  credentials,
  onClose,
}: {
  title: string;
  credentials: IssuedCredentials[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const asText = [
    title,
    "",
    ...credentials.map((c) => `${c.fullName}\t${c.username}\t${c.temporaryPassword}`),
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* Sin permiso de portapapeles: queda el imprimir y el texto en
         pantalla, que es lo que de verdad hace falta. */
    }
  }

  return (
    <Card className="mb-4 border-[#f5c86b] bg-[#fffbf2] p-5 print:border-0 print:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#101828]">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-[#93601a]">
            Anotá o imprimí estas contraseñas ahora. No se vuelven a mostrar.
          </p>
          <p className="mt-0.5 text-xs text-[#667085]">
            Cada persona la cambia la primera vez que entra. Si se pierde, se puede volver a
            generar desde la lista, una por una.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="secondary" onClick={() => void copy()}>
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[#eadfc4] bg-white">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#eadfc4] bg-[#fffdf8] text-left">
              <th scope="col" className="px-4 py-2.5 font-semibold text-[#475069]">Nombre</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-[#475069]">Usuario</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-[#475069]">Contraseña</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2ece0]">
            {credentials.map((c) => (
              <tr key={c.username}>
                <td className="px-4 py-2.5 text-[#101828]">{c.fullName}</td>
                <td className="px-4 py-2.5 font-mono text-[13px] text-[#101828]">{c.username}</td>
                <td className="px-4 py-2.5 font-mono text-[13px] font-semibold text-[#101828]">
                  {c.temporaryPassword}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 print:hidden">
        {confirmingClose ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-[#93601a]">
              ¿Ya las anotaste? Al cerrar no se pueden recuperar.
            </p>
            <Button variant="danger" onClick={onClose}>
              Sí, cerrar
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingClose(false)}>
              Volver
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmingClose(true)}>
            Cerrar
          </Button>
        )}
      </div>
    </Card>
  );
}
