import { criarLancamentoSchema, type Gincana, type TipoAcao } from '@gincana/contracts';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { AreaDeTexto } from '../../components/ui/AreaDeTexto.js';
import { AvisoDeErro } from '../../components/ui/Avisos.js';
import { botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import { CampoDeTexto } from '../../components/ui/CampoDeTexto.js';
import { dataDeHoje } from '../../lib/dia-relativo.js';
import { errosDoSchema, focarPrimeiroComErro } from '../../lib/erro-da-api.js';
import { formatarData } from '../../lib/formatar-data.js';
import { formatarQuantidade } from '../../lib/formatar-numero.js';
import { useSessao } from '../../lib/sessao.js';
import { useMinhaEquipe } from '../colaborador/useMinhaEquipe.js';
import { CampoDeComprovante } from '../evidencias/CampoDeComprovante.js';
import { descreverDestinoDaAprovacao } from './destino-da-aprovacao.js';
import { CampoDeQuantidade, lerQuantidade } from './CampoDeQuantidade.js';
import { EnvioParcial, type EtapaDoEnvio } from './enviar-lancamento.js';
import { useRegistrarLancamento } from './lancamentos-api.js';
import { traduzirFalhaDeLancamento } from './mensagens-de-lancamento.js';
import { PreviaDePontos } from './PreviaDePontos.js';
import { useEstadoDaPrevia } from './useEstadoDaPrevia.js';

const CAMPOS = ['quantidade', 'dataAcao', 'observacao', 'comprovante'] as const;
type Campo = (typeof CAMPOS)[number];

const rotuloDaEtapa: Record<EtapaDoEnvio, string> = {
  'enviando-comprovante': 'Enviando o comprovante…',
  registrando: 'Registrando a ação…',
};

interface Props {
  tipo: TipoAcao;
  gincana: Gincana;
}

/**
 * US06 + US07: registrar a ação com a quantidade e o comprovante.
 *
 * O "+120 pts" vem da API (`POST /lancamentos/preview`), com atraso depois da última tecla.
 * O envio é: arquivo ao armazenamento, lançamento criado, comprovante registrado nele.
 */
export function FormularioDeRegistro({ tipo, gincana }: Props) {
  const { usuario } = useSessao();
  const equipe = useMinhaEquipe();
  const navegar = useNavigate();
  const formulario = useRef<HTMLFormElement>(null);

  const [quantidade, setQuantidade] = useState('1');
  // O dia vale desde que a tela abriu: a data máxima não muda debaixo de quem está digitando.
  const [hoje] = useState(() => dataDeHoje());
  const [dataAcao, setDataAcao] = useState(hoje);
  const [observacao, setObservacao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [avisoGeral, setAvisoGeral] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<EtapaDoEnvio | null>(null);

  const registrar = useRegistrarLancamento(setEtapa);

  const { estado: estadoDaPrevia, bloqueada: bloqueadaPelaRegra } = useEstadoDaPrevia({
    tipoAcaoId: tipo.id,
    unidade: tipo.unidade,
    quantidade,
    dataAcao,
  });

  function mostrarErros(novos: Partial<Record<Campo, string>>) {
    setErros(novos);
    focarPrimeiroComErro(formulario.current, CAMPOS, novos);
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (usuario === null) {
      return;
    }
    setAvisoGeral(null);

    const resultado = criarLancamentoSchema.safeParse({
      tipoAcaoId: tipo.id,
      quantidade: lerQuantidade(quantidade),
      dataAcao,
      observacao: observacao.trim() === '' ? null : observacao,
    });
    const novos: Partial<Record<Campo, string>> = resultado.success
      ? {}
      : errosDoSchema(resultado.error.issues, CAMPOS);

    if (tipo.exigeEvidencia && arquivo === null) {
      novos.comprovante =
        'Anexe o comprovante: esta ação exige uma foto ou um arquivo para ser aprovada.';
    }

    if (!resultado.success || novos.comprovante !== undefined) {
      mostrarErros(novos);
      return;
    }
    setErros({});

    registrar.mutate(
      { dados: resultado.data, arquivo },
      {
        onSuccess: (lancamento) => {
          void navegar('/inicio', {
            state: {
              aviso: {
                tipo: 'sucesso',
                texto: `Ação registrada: ${formatarQuantidade(lancamento.quantidade, lancamento.tipoAcao.unidade)} de ${lancamento.tipoAcao.nome}. ${descreverDestinoDaAprovacao(usuario, equipe)}`,
              },
            },
          });
        },
        onError: (erro) => {
          setEtapa(null);
          if (erro instanceof EnvioParcial) {
            const causa = traduzirFalhaDeLancamento(erro.causa, 'registrar').geral;
            void navegar('/inicio', {
              state: {
                aviso: {
                  tipo: 'erro',
                  texto: `Seu lançamento de ${erro.lancamento.tipoAcao.nome} foi registrado, mas o comprovante não chegou. ${causa ?? ''} Toque em “Anexar comprovante” no lançamento para tentar de novo.`,
                },
              },
            });
            return;
          }

          const falha = traduzirFalhaDeLancamento<Campo>(erro, 'registrar', {
            camposDoFormulario: CAMPOS,
            campoDaData: 'dataAcao',
          });
          setAvisoGeral(falha.geral);
          mostrarErros(falha.campos);
        },
      },
    );
  }

  if (usuario === null) {
    return null;
  }

  const enviando = registrar.isPending;
  const periodo = `A gincana vai de ${formatarData(gincana.dataInicio)} a ${formatarData(gincana.dataFim)}.`;

  return (
    <form ref={formulario} onSubmit={aoEnviar} noValidate className="flex flex-col gap-5">
      <CampoDeQuantidade
        unidade={tipo.unidade}
        valor={quantidade}
        aoMudar={setQuantidade}
        erro={erros.quantidade}
      />

      <CampoDeComprovante
        arquivo={arquivo}
        aoEscolher={(novo) => {
          setArquivo(novo);
          setErros((atuais) => ({ ...atuais, comprovante: undefined }));
        }}
        obrigatorio={tipo.exigeEvidencia}
        erro={erros.comprovante}
      />

      <CampoDeTexto
        rotulo="Data da ação"
        name="dataAcao"
        type="date"
        value={dataAcao}
        // Gincana ativa que ainda não começou: sem piso, para a data de hoje continuar escolhável.
        min={gincana.dataInicio <= hoje ? gincana.dataInicio : undefined}
        max={hoje}
        onChange={(evento) => {
          setDataAcao(evento.target.value);
        }}
        erro={erros.dataAcao}
        dica={periodo}
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
        dica="Algo que ajude quem vai aprovar, como o nome da instituição que recebeu."
      />

      <PreviaDePontos
        estado={estadoDaPrevia}
        destino={descreverDestinoDaAprovacao(usuario, equipe)}
      />

      {avisoGeral !== null && <AvisoDeErro>{avisoGeral}</AvisoDeErro>}

      <button type="submit" disabled={enviando || bloqueadaPelaRegra} className={botaoPrimario}>
        {enviando && etapa !== null ? rotuloDaEtapa[etapa] : 'Enviar para aprovação'}
      </button>
    </form>
  );
}
