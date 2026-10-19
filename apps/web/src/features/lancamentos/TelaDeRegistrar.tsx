import type { Gincana, TipoAcao } from '@gincana/contracts';
import { Link, useParams } from 'react-router-dom';

import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { mensagemDeErro } from '../../lib/api.js';
import { formatarPontosPorUnidade } from '../../lib/formatar-numero.js';
import { useGincanaAtiva } from '../colaborador/useGincanaAtiva.js';
import { familiaDoTipo } from '../tipos-acao/familias-de-acao.js';
import { IconeDaFamilia } from '../tipos-acao/IconeDaFamilia.js';
import { useTiposDeAcao } from '../tipos-acao/tipos-acao-api.js';
import { FormularioDeRegistro } from './FormularioDeRegistro.js';
import { GradeDeAcoes } from './GradeDeAcoes.js';

const voltar =
  'inline-flex min-h-11 items-center gap-1 rounded-xl pr-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-300 lg:hidden';

function PainelDoFormulario({ tipo, gincana }: { tipo: TipoAcao; gincana: Gincana }) {
  const familia = familiaDoTipo(tipo);
  const subtitulo = [
    tipo.regraVigente === null
      ? null
      : formatarPontosPorUnidade(tipo.regraVigente.pontosPorUnidade, tipo.unidade),
    tipo.exigeEvidencia ? 'precisa de comprovante' : 'comprovante opcional',
  ]
    .filter((parte) => parte !== null)
    .join(' · ');

  return (
    <section
      aria-labelledby="titulo-do-formulario"
      className="flex flex-col gap-5 lg:rounded-cartao lg:bg-superficie lg:p-6 lg:shadow-sm"
    >
      {/* No celular é o cabeçalho escuro da tela; no computador, o topo do painel. */}
      <header className="rounded-cartao bg-marca-900 p-5 text-superficie lg:rounded-none lg:bg-transparent lg:p-0 lg:text-texto">
        <Link to="/registrar" className={`${voltar} -ml-1 pl-1 text-superficie`}>
          <span aria-hidden="true">‹</span> Escolher ação
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 lg:mt-0">
          <div className="min-w-0">
            <h2 id="titulo-do-formulario" className="text-2xl font-bold text-balance">
              {tipo.nome}
            </h2>
            <p className="mt-1 text-sm text-marca-300 lg:text-texto-suave">{subtitulo}</p>
          </div>
          <span className="lg:hidden">
            <IconeDaFamilia familia={familia} tamanho="cabecalho" />
          </span>
        </div>
      </header>

      <div className="rounded-cartao bg-superficie p-5 shadow-sm lg:rounded-none lg:p-0 lg:shadow-none">
        <FormularioDeRegistro tipo={tipo} gincana={gincana} />
      </div>
    </section>
  );
}

/**
 * US06 — escolher a ação e registrá-la.
 *
 * Celular: dois passos, a grade em `/registrar` e o formulário em `/registrar/:id`, como no
 * protótipo. Computador: uma tela só, com a grade à esquerda e o formulário ao lado, como
 * em `06-colaborador-web.png`. É a mesma árvore de elementos; o CSS esconde um dos dois no
 * celular quando já há uma ação escolhida.
 */
export function TelaDeRegistrar() {
  const { tipoAcaoId } = useParams();
  const { consulta: gincanas, ativa } = useGincanaAtiva();
  const tipos = useTiposDeAcao(ativa?.id ?? null);

  if (gincanas.isPending) {
    return <EstadoCarregando mensagem="Carregando a gincana…" />;
  }

  if (gincanas.isError) {
    return (
      <EstadoDeErro
        mensagem={mensagemDeErro(gincanas.error)}
        aoTentarDeNovo={() => {
          void gincanas.refetch();
        }}
      />
    );
  }

  if (ativa === null) {
    return (
      <EstadoVazio
        titulo="Nenhuma gincana ativa agora"
        descricao="Assim que a administradora ativar a gincana, você poderá registrar as suas ações por aqui."
      />
    );
  }

  if (tipos.isPending) {
    return <EstadoCarregando mensagem="Carregando as ações…" />;
  }

  if (tipos.isError) {
    return (
      <EstadoDeErro
        mensagem={mensagemDeErro(tipos.error)}
        aoTentarDeNovo={() => {
          void tipos.refetch();
        }}
      />
    );
  }

  if (tipos.data.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma ação cadastrada ainda"
        descricao="A administradora ainda não cadastrou as ações desta gincana. Volte em breve para registrar a sua."
      />
    );
  }

  const escolhido = tipos.data.find((tipo) => tipo.id === tipoAcaoId) ?? null;
  const escolhaInvalida = tipoAcaoId !== undefined && escolhido === null;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start lg:gap-8">
      <div className={escolhido === null ? 'flex flex-col gap-5' : 'hidden flex-col gap-5 lg:flex'}>
        <header className="rounded-cartao bg-marca-600 p-5 text-superficie lg:rounded-none lg:bg-transparent lg:p-0 lg:text-texto">
          <Link to="/inicio" className={voltar}>
            <span aria-hidden="true">‹</span> Início
          </Link>
          <p className="mt-2 text-xs font-semibold tracking-wide uppercase lg:mt-0 lg:text-marca-600">
            Registrar ação
          </p>
          <h1 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-balance">
            Qual ação você fez?
          </h1>
          <p className="mt-1 text-sm text-marca-100 lg:text-texto-suave">
            Escolha o tipo e os pontos são calculados sozinhos.
          </p>
        </header>
        <GradeDeAcoes tipos={tipos.data} />
      </div>

      {escolhido !== null && <PainelDoFormulario tipo={escolhido} gincana={ativa} />}

      {escolhaInvalida && (
        <EstadoVazio
          titulo="Esta ação não está disponível"
          descricao="Ela pode ter sido pausada pela administradora. Escolha outra ação na lista."
        />
      )}

      {tipoAcaoId === undefined && (
        <p className="hidden rounded-cartao border-2 border-dashed border-marca-300 p-6 text-center text-texto-suave lg:block">
          Escolha uma ação ao lado para registrar.
        </p>
      )}
    </div>
  );
}
