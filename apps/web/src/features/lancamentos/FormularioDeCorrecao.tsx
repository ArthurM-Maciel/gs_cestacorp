import { atualizarLancamentoSchema, type Evidencia, type Lancamento } from '@gincana/contracts';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { AreaDeTexto } from '../../components/ui/AreaDeTexto.js';
import { AvisoDeErro } from '../../components/ui/Avisos.js';
import { CampoDeTexto } from '../../components/ui/CampoDeTexto.js';
import { botaoDeLinha, botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import { dataDeHoje } from '../../lib/dia-relativo.js';
import { errosDoSchema, focarPrimeiroComErro } from '../../lib/erro-da-api.js';
import { formatarTamanhoDeArquivo } from '../../lib/formatar-numero.js';
import { CampoDeComprovante } from '../evidencias/CampoDeComprovante.js';
import { enderecoSeguroDoComprovante } from '../evidencias/evidencias-api.js';
import { CampoDeQuantidade, lerQuantidade } from './CampoDeQuantidade.js';
import { EnvioParcial, type EtapaDoEnvio } from './enviar-lancamento.js';
import { useCorrigirLancamento } from './lancamentos-api.js';
import { traduzirFalhaDeLancamento } from './mensagens-de-lancamento.js';
import { PreviaDePontos } from './PreviaDePontos.js';
import { useEstadoDaPrevia } from './useEstadoDaPrevia.js';

const CAMPOS = ['quantidade', 'dataAcao', 'observacao', 'comprovante'] as const;
type Campo = (typeof CAMPOS)[number];

const rotuloDaEtapa: Record<EtapaDoEnvio, string> = {
  'enviando-comprovante': 'Enviando o comprovante…',
  registrando: 'Reenviando para aprovação…',
};

function ComprovanteAnexado({
  evidencia,
  removido,
  aoAlternar,
}: {
  evidencia: Evidencia;
  removido: boolean;
  aoAlternar: () => void;
}) {
  const endereco = enderecoSeguroDoComprovante(evidencia.url);

  return (
    <li className="flex flex-col gap-2 rounded-xl bg-fundo p-3">
      <div className={removido ? 'opacity-60' : undefined}>
        <p className={`truncate font-semibold ${removido ? 'line-through' : ''}`}>
          {evidencia.nomeArquivo}
        </p>
        <p className="text-sm text-texto-suave">
          {removido
            ? 'Será removido ao reenviar'
            : formatarTamanhoDeArquivo(evidencia.tamanhoBytes)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {endereco !== null && !removido ? (
          <a
            href={endereco}
            target="_blank"
            rel="noopener noreferrer"
            className={`${botaoDeLinha} w-full`}
          >
            Abrir
            <span className="sr-only"> {evidencia.nomeArquivo} em uma nova aba</span>
          </a>
        ) : (
          <span />
        )}
        <button
          type="button"
          aria-pressed={removido}
          aria-label={`${removido ? 'Manter' : 'Remover'} o comprovante ${evidencia.nomeArquivo}`}
          onClick={aoAlternar}
          className={`${botaoDeLinha} w-full`}
        >
          {removido ? 'Manter' : 'Remover'}
        </button>
      </div>
    </li>
  );
}

/**
 * US06 — corrigir e reenviar. Serve ao lançamento recusado (volta para a fila do líder) e
 * ao pendente que a pessoa quer ajustar, inclusive para anexar o comprovante que faltou.
 *
 * O tipo da ação não muda: quem lançou a ação errada recusa-se e registra outra.
 */
export function FormularioDeCorrecao({ lancamento }: { lancamento: Lancamento }) {
  const navegar = useNavigate();
  const formulario = useRef<HTMLFormElement>(null);
  const tipo = lancamento.tipoAcao;

  const [hoje] = useState(() => dataDeHoje());
  const [quantidade, setQuantidade] = useState(() =>
    String(lancamento.quantidade).replace('.', ','),
  );
  const [dataAcao, setDataAcao] = useState(lancamento.dataAcao);
  const [observacao, setObservacao] = useState(lancamento.observacao ?? '');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [removidas, setRemovidas] = useState<readonly string[]>([]);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [avisoGeral, setAvisoGeral] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<EtapaDoEnvio | null>(null);

  const corrigir = useCorrigirLancamento(lancamento.id, setEtapa);

  const { estado: estadoDaPrevia, bloqueada } = useEstadoDaPrevia({
    tipoAcaoId: lancamento.tipoAcaoId,
    unidade: tipo.unidade,
    quantidade,
    dataAcao,
    precoCongelado: {
      pontosPorUnidade: lancamento.pontosPorUnidadeAplicado,
      dataAcao: lancamento.dataAcao,
    },
  });

  const mantidas = lancamento.evidencias.filter((evidencia) => !removidas.includes(evidencia.id));
  const ficaSemComprovante = tipo.exigeEvidencia && mantidas.length === 0 && arquivo === null;

  function mostrarErros(novos: Partial<Record<Campo, string>>) {
    setErros(novos);
    focarPrimeiroComErro(formulario.current, CAMPOS, novos);
  }

  function alternarRemocao(id: string) {
    setRemovidas((atuais) =>
      atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id],
    );
    setErros((atuais) => ({ ...atuais, comprovante: undefined }));
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setAvisoGeral(null);

    const resultado = atualizarLancamentoSchema.safeParse({
      quantidade: lerQuantidade(quantidade),
      dataAcao,
      observacao: observacao.trim() === '' ? null : observacao,
    });
    const novos: Partial<Record<Campo, string>> = resultado.success
      ? {}
      : errosDoSchema(resultado.error.issues, CAMPOS);

    if (ficaSemComprovante) {
      novos.comprovante =
        'Esta ação exige comprovante. Mantenha um dos anexados ou escolha um arquivo novo.';
    }

    if (!resultado.success || novos.comprovante !== undefined) {
      mostrarErros(novos);
      return;
    }
    setErros({});

    corrigir.mutate(
      { dados: resultado.data, evidenciasARemover: removidas, arquivo },
      {
        onSuccess: () => {
          void navegar('/inicio', {
            state: {
              aviso: {
                tipo: 'sucesso',
                texto:
                  lancamento.status === 'RECUSADO'
                    ? `Lançamento de ${tipo.nome} reenviado. Ele voltou para a fila de aprovação com as suas correções.`
                    : `Lançamento de ${tipo.nome} atualizado. Ele continua na fila de aprovação.`,
              },
            },
          });
        },
        onError: (erro) => {
          setEtapa(null);
          if (erro instanceof EnvioParcial) {
            const causa = traduzirFalhaDeLancamento(erro.causa, 'corrigir').geral;
            setAvisoGeral(
              `As suas correções foram salvas e o lançamento voltou para a fila, mas o comprovante não foi atualizado. ${causa ?? ''} Toque em “Reenviar para aprovação” para tentar de novo.`,
            );
            return;
          }

          const falha = traduzirFalhaDeLancamento<Campo>(erro, 'corrigir', {
            camposDoFormulario: CAMPOS,
            campoDaData: 'dataAcao',
          });
          setAvisoGeral(falha.geral);
          mostrarErros(falha.campos);
        },
      },
    );
  }

  const enviando = corrigir.isPending;

  return (
    <form ref={formulario} onSubmit={aoEnviar} noValidate className="flex flex-col gap-5">
      <CampoDeQuantidade
        unidade={tipo.unidade}
        valor={quantidade}
        aoMudar={setQuantidade}
        erro={erros.quantidade}
      />

      {lancamento.evidencias.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Comprovantes anexados</p>
          <ul className="flex flex-col gap-2">
            {lancamento.evidencias.map((evidencia) => (
              <ComprovanteAnexado
                key={evidencia.id}
                evidencia={evidencia}
                removido={removidas.includes(evidencia.id)}
                aoAlternar={() => {
                  alternarRemocao(evidencia.id);
                }}
              />
            ))}
          </ul>
        </div>
      )}

      <CampoDeComprovante
        arquivo={arquivo}
        aoEscolher={(novo) => {
          setArquivo(novo);
          setErros((atuais) => ({ ...atuais, comprovante: undefined }));
        }}
        obrigatorio={tipo.exigeEvidencia && mantidas.length === 0}
        erro={erros.comprovante}
        dica={
          lancamento.evidencias.length > 0
            ? 'O arquivo novo é anexado junto dos que você mantiver.'
            : undefined
        }
      />

      <CampoDeTexto
        rotulo="Data da ação"
        name="dataAcao"
        type="date"
        value={dataAcao}
        max={hoje}
        onChange={(evento) => {
          setDataAcao(evento.target.value);
        }}
        erro={erros.dataAcao}
      />

      <AreaDeTexto
        rotulo="Observação (opcional)"
        name="observacao"
        value={observacao}
        maxLength={500}
        onChange={(evento) => {
          setObservacao(evento.target.value);
        }}
        erro={erros.observacao}
      />

      <PreviaDePontos
        estado={estadoDaPrevia}
        destino="Ao reenviar, o lançamento volta para a fila de quem aprova."
      />

      {avisoGeral !== null && <AvisoDeErro>{avisoGeral}</AvisoDeErro>}

      <button type="submit" disabled={enviando || bloqueada} className={botaoPrimario}>
        {enviando && etapa !== null ? rotuloDaEtapa[etapa] : 'Reenviar para aprovação'}
      </button>
    </form>
  );
}
