import { IconeMaos } from './Icones.js';

/**
 * Painel verde da tela dividida do computador (`05-acesso-web.png`). No celular ele não
 * existe: a identidade aparece no topo de cada tela.
 */
export function PainelDaMarca({ className }: { className: string }) {
  return (
    <div className={`relative overflow-hidden bg-marca-600 text-superficie ${className}`}>
      <span
        aria-hidden="true"
        className="absolute -top-32 right-0 size-[28rem] rounded-full bg-superficie/10"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-16 -left-24 size-80 rounded-full bg-superficie/10"
      />
      <div className="relative mt-auto flex flex-col gap-5 p-12 xl:p-16">
        <span className="grid size-16 place-items-center rounded-2xl bg-superficie/15">
          <IconeMaos className="size-10 text-superficie" />
        </span>
        <p className="text-5xl font-bold tracking-tight text-balance">Gincana Solidária</p>
        <p className="text-2xl font-medium text-marca-300">Faça o bem e some pontos!</p>
        <p className="max-w-md text-base">
          Registre suas ações solidárias, envie o comprovante e acompanhe sua equipe.
        </p>
      </div>
    </div>
  );
}
