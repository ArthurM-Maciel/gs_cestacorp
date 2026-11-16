import { novaRegraSchema, type TipoAcao } from '@gincana/contracts';
import { calcularPontos } from '@gincana/scoring';
import { useRef, useState, type FormEvent } from 'react';

import { AreaDeTexto } from '../../components/ui/AreaDeTexto.js';
import { AvisoDeErro } from '../../components/ui/Avisos.js';
import { CampoDeTexto } from '../../components/ui/CampoDeTexto.js';
import { CorpoDoDialogo, Dialogo, RodapeDoDialogo } from '../../components/ui/Dialogo.js';
import { botaoContorno, botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import {
  formatarPontos,
  formatarPontosPorUnidade,
  formatarQuantidade,
} from '../../lib/formatar-numero.js';
import {
  errosDoSchema,
  focarPrimeiroComErro,
  traduzirErroDoFormulario,
} from '../../lib/erro-da-api.js';
import { useNovaRegra } from './tipos-acao-api.js';

const CAMPOS = ['pontosPorUnidade', 'motivo'] as const;
type Campo = (typeof CAMPOS)[number];
type Erros = Partial<Record<Campo, string>>;

/** Quantidade do exemplo ao vivo, igual à do protótipo ("3 kg de tampinhas = 30 pts"). */
const QUANTIDADE_DO_EXEMPLO = 3;

interface Props {
  tipo: TipoAcao;
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}

/**
 * Troca a pontuação de um tipo já cadastrado.
 *
 * Isto nunca edita a regra atual: abre uma vigência nova a partir de agora. Por isso não
 * há campo de data — "ausente" já significa "a partir de agora", que é o caso normal — e o
 * conflito de uma vigência anterior à regra que está valendo vira aviso geral, não erro de
 * campo: não é um campo que a pessoa preencheu errado, é uma decisão de negócio.
 */
export function DialogoDeNovaRegra({ tipo, aoFechar, aoConcluir }: Props) {
  const [pontosTexto, setPontosTexto] = useState(
    tipo.regraVigente?.pontosPorUnidade.toString() ?? '',
  );
  const [motivo, setMotivo] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const formulario = useRef<HTMLFormElement>(null);
  const novaRegra = useNovaRegra(tipo.id);

  const pontosNumero = pontosTexto.trim() === '' ? Number.NaN : Number(pontosTexto);
  const exemploValido = Number.isFinite(pontosNumero) && pontosNumero >= 0;

  function limpar(campo: Campo) {
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  function mostrarErros(novos: Erros) {
    setErros(novos);
    focarPrimeiroComErro(formulario.current, CAMPOS, novos);
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);

    const resultado = novaRegraSchema.safeParse({
      pontosPorUnidade: pontosTexto.trim() === '' ? Number.NaN : Number(pontosTexto),
      motivo: motivo.trim() === '' ? undefined : motivo,
    });

    if (!resultado.success) {
      mostrarErros(errosDoSchema(resultado.error.issues, CAMPOS));
      return;
    }

    try {
      await novaRegra.mutateAsync(resultado.data);
      aoConcluir(
        `Nova pontuação de "${tipo.nome}": ${formatarPontosPorUnidade(resultado.data.pontosPorUnidade, tipo.unidade)}.`,
      );
    } catch (erro) {
      // Um conflito de vigência não aponta um campo: é a decisão de negócio que não vale
      // (a pontuação já apurada não é recalculada), então a mensagem fica geral.
      const traduzido = traduzirErroDoFormulario(erro, CAMPOS);
      setErroGeral(traduzido.geral);
      mostrarErros(traduzido.campos);
    }
  }

  return (
    <Dialogo
      titulo={`Nova pontuação de ${tipo.nome}`}
      descricao="Defina como essa ação vira pontos a partir de agora. O que já foi lançado continua valendo o preço anterior."
      aoFechar={aoFechar}
      ocupado={novaRegra.isPending}
    >
      <form
        ref={formulario}
        noValidate
        onSubmit={(evento) => {
          void enviar(evento);
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <CorpoDoDialogo>
          {erroGeral !== null && <AvisoDeErro>{erroGeral}</AvisoDeErro>}

          <CampoDeTexto
            name="pontosPorUnidade"
            rotulo="Pontos por unidade"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={pontosTexto}
            onChange={(evento) => {
              setPontosTexto(evento.target.value);
              limpar('pontosPorUnidade');
            }}
            erro={erros.pontosPorUnidade}
            data-foco-inicial
          />

          <AreaDeTexto
            name="motivo"
            rotulo="Motivo da mudança (opcional)"
            maxLength={240}
            dica="Vai para o histórico, para explicar a decisão mais tarde."
            value={motivo}
            onChange={(evento) => {
              setMotivo(evento.target.value);
              limpar('motivo');
            }}
            erro={erros.motivo}
          />

          <div className="rounded-xl bg-fundo p-4">
            <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">
              Exemplo
            </p>
            <p className="mt-1 font-bold text-balance">
              {exemploValido
                ? `${formatarQuantidade(QUANTIDADE_DO_EXEMPLO, tipo.unidade)} de ${tipo.nome} = ${formatarPontos(calcularPontos(QUANTIDADE_DO_EXEMPLO, pontosNumero))}`
                : 'Informe os pontos por unidade para ver o exemplo.'}
            </p>
          </div>
        </CorpoDoDialogo>

        <RodapeDoDialogo>
          <button
            type="button"
            disabled={novaRegra.isPending}
            onClick={aoFechar}
            className={botaoContorno}
          >
            Cancelar
          </button>
          <button type="submit" disabled={novaRegra.isPending} className={botaoPrimario}>
            {novaRegra.isPending ? 'Salvando…' : 'Salvar nova pontuação'}
          </button>
        </RodapeDoDialogo>
      </form>
    </Dialogo>
  );
}
