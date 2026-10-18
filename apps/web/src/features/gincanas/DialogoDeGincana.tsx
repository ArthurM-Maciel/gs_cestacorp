import { criarGincanaSchema, type AtualizarGincana, type Gincana } from '@gincana/contracts';
import { useRef, useState, type FormEvent } from 'react';

import { AvisoDeErro } from '../../components/ui/Avisos.js';
import { CampoDeTexto } from '../../components/ui/CampoDeTexto.js';
import { CorpoDoDialogo, Dialogo, RodapeDoDialogo } from '../../components/ui/Dialogo.js';
import { botaoContorno, botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import {
  errosDoSchema,
  focarPrimeiroComErro,
  traduzirErroDoFormulario,
} from '../../lib/erro-da-api.js';
import { useAtualizarGincana, useCriarGincana } from './gincanas-api.js';

const CAMPOS = ['ano', 'nome', 'dataInicio', 'dataFim'] as const;
type Campo = (typeof CAMPOS)[number];
type Erros = Partial<Record<Campo, string>>;

interface Props {
  /** Presente quando é uma edição; ausente quando é uma gincana nova. */
  gincana?: Gincana;
  aoFechar: () => void;
  /** Recebe o texto de sucesso que a tela mostra depois de fechar o formulário. */
  aoConcluir: (mensagem: string) => void;
}

export function DialogoDeGincana({ gincana, aoFechar, aoConcluir }: Props) {
  const editando = gincana !== undefined;

  const [ano, setAno] = useState(String(gincana?.ano ?? new Date().getFullYear()));
  const [nome, setNome] = useState(gincana?.nome ?? '');
  const [dataInicio, setDataInicio] = useState(gincana?.dataInicio ?? '');
  const [dataFim, setDataFim] = useState(gincana?.dataFim ?? '');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const formulario = useRef<HTMLFormElement>(null);
  const criar = useCriarGincana();
  const atualizar = useAtualizarGincana();
  const pendente = criar.isPending || atualizar.isPending;

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

    // O schema do contrato é o mesmo da API: a mensagem daqui é a que ela devolveria.
    // O ano chega como texto, então "vazio" e "não é número" são tratados antes dele.
    const anoInformado = ano.trim() !== '' && Number.isInteger(Number(ano));
    const resultado = criarGincanaSchema.safeParse({
      ano: anoInformado ? Number(ano) : 0,
      nome,
      dataInicio,
      dataFim,
    });

    if (!resultado.success || !anoInformado) {
      const doSchema = resultado.success ? {} : errosDoSchema(resultado.error.issues, CAMPOS);
      mostrarErros(
        anoInformado ? doSchema : { ...doSchema, ano: 'Informe o ano da gincana, só com números.' },
      );
      return;
    }

    const valores = resultado.data;

    try {
      if (gincana === undefined) {
        await criar.mutateAsync(valores);
        aoConcluir(`Gincana de ${valores.ano} cadastrada.`);
        return;
      }

      // Só o que mudou vai para a API: a auditoria e o PATCH não precisam do resto.
      const dados: AtualizarGincana = {};
      if (valores.nome !== gincana.nome) dados.nome = valores.nome;
      if (valores.dataInicio !== gincana.dataInicio) dados.dataInicio = valores.dataInicio;
      if (valores.dataFim !== gincana.dataFim) dados.dataFim = valores.dataFim;

      if (Object.keys(dados).length === 0) {
        aoFechar();
        return;
      }

      await atualizar.mutateAsync({ id: gincana.id, dados });
      aoConcluir(`Gincana de ${gincana.ano} atualizada.`);
    } catch (erro) {
      const traduzido = traduzirErroDoFormulario(erro, CAMPOS, {
        ANO_JA_CADASTRADO: {
          campo: 'ano',
          orientacao: 'Edite a gincana desse ano na lista ou escolha outro ano.',
        },
      });
      setErroGeral(traduzido.geral);
      mostrarErros(traduzido.campos);
    }
  }

  return (
    <Dialogo
      titulo={editando ? `Editar gincana ${gincana.ano}` : 'Nova gincana'}
      descricao="Defina o ano e o período em que a gincana vale."
      aoFechar={aoFechar}
      ocupado={pendente}
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
            name="ano"
            rotulo="Ano"
            type="number"
            inputMode="numeric"
            min={2020}
            max={2100}
            value={ano}
            disabled={editando}
            onChange={(evento) => {
              setAno(evento.target.value);
              limpar('ano');
            }}
            erro={erros.ano}
            dica={editando ? 'O ano identifica a gincana e não pode ser alterado.' : undefined}
            data-foco-inicial={editando ? undefined : true}
          />
          <CampoDeTexto
            name="nome"
            rotulo="Nome da gincana"
            maxLength={120}
            autoComplete="off"
            placeholder="Gincana Solidária 2026"
            value={nome}
            onChange={(evento) => {
              setNome(evento.target.value);
              limpar('nome');
            }}
            erro={erros.nome}
            data-foco-inicial={editando ? true : undefined}
          />
          <CampoDeTexto
            name="dataInicio"
            rotulo="Data de início"
            type="date"
            value={dataInicio}
            onChange={(evento) => {
              setDataInicio(evento.target.value);
              limpar('dataInicio');
            }}
            erro={erros.dataInicio}
          />
          <CampoDeTexto
            name="dataFim"
            rotulo="Data de término"
            type="date"
            value={dataFim}
            onChange={(evento) => {
              setDataFim(evento.target.value);
              limpar('dataFim');
            }}
            erro={erros.dataFim}
          />
        </CorpoDoDialogo>

        <RodapeDoDialogo>
          <button type="button" disabled={pendente} onClick={aoFechar} className={botaoContorno}>
            Cancelar
          </button>
          <button type="submit" disabled={pendente} className={botaoPrimario}>
            {pendente ? 'Salvando…' : editando ? 'Salvar' : 'Criar gincana'}
          </button>
        </RodapeDoDialogo>
      </form>
    </Dialogo>
  );
}
