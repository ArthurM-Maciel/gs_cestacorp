import { useEffect, useState } from 'react';

/** Quanto a prévia espera depois da última tecla: o bastante para não disparar a cada dígito. */
export const ATRASO_DA_PREVIA_MS = 400;

/**
 * O valor, mas só depois de ficar parado por `atrasoMs`. Serve para não chamar a API a cada
 * tecla de quem digita "12": só o valor em que a pessoa parou chega à consulta.
 */
export function useValorComAtraso<T>(valor: T, atrasoMs: number = ATRASO_DA_PREVIA_MS): T {
  const [atrasado, setAtrasado] = useState(valor);

  useEffect(() => {
    const espera = setTimeout(() => {
      setAtrasado(valor);
    }, atrasoMs);
    return () => {
      clearTimeout(espera);
    };
  }, [valor, atrasoMs]);

  return atrasado;
}
