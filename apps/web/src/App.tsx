/**
 * Esqueleto da aplicação. As telas chegam a partir da Sprint 1, em
 * `src/features/<recurso>/` — uma pasta por história, para que cinco pessoas trabalhem
 * em paralelo sem disputar arquivo.
 */
export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-4 py-12">
      <p className="text-sm font-medium tracking-wide text-marca-600 uppercase">Cestacorp</p>
      <h1 className="text-4xl font-bold text-balance">
        Gincana Solidária
        <span className="block text-marca-700">sem planilha</span>
      </h1>
      <p className="text-texto-suave max-w-prose">
        Registre suas ações solidárias, envie o comprovante e acompanhe sua equipe. As telas entram
        a partir da Sprint 1.
      </p>
    </main>
  );
}
