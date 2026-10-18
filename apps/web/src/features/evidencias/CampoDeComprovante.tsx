import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';

import { formatarTamanhoDeArquivo } from '../../lib/formatar-numero.js';
import { tiposAceitosNoCampo, validarComprovante } from './validar-comprovante.js';

/** Miniatura da foto escolhida. O endereço temporário é criado e liberado no próprio efeito. */
function Miniatura({ arquivo }: { arquivo: File }) {
  const imagem = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') {
      return;
    }
    const endereco = URL.createObjectURL(arquivo);
    if (imagem.current !== null) {
      imagem.current.src = endereco;
    }
    return () => {
      URL.revokeObjectURL(endereco);
    };
  }, [arquivo]);

  // Decorativa: o nome do arquivo está escrito ao lado.
  return <img ref={imagem} alt="" className="size-14 shrink-0 rounded-xl object-cover" />;
}

function IconeDeArquivo() {
  return (
    <span
      aria-hidden="true"
      className="grid size-14 shrink-0 place-items-center rounded-xl bg-marca-100 text-marca-600"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-7"
      >
        <path d="M6 3.5h8l4 4V20.5H6Z" />
        <path d="M14 3.5v4h4" />
      </svg>
    </span>
  );
}

function IconeDeCamera() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-8 text-marca-600"
    >
      <path d="M4 8.5h3l1.5-2.5h7L17 8.5h3V19H4Z" />
      <circle cx="12" cy="13.5" r="3.25" />
    </svg>
  );
}

interface Props {
  /** O arquivo escolhido (já aprovado pela validação), ou `null`. */
  arquivo: File | null;
  aoEscolher: (arquivo: File | null) => void;
  /** Quando o tipo da ação exige comprovante, o rótulo avisa antes de a pessoa errar. */
  obrigatorio: boolean;
  /** Erro do formulário (comprovante obrigatório que faltou). */
  erro?: string | undefined;
  /** Mensagem extra sobre o campo, como "já há 2 comprovantes anexados". */
  dica?: string | undefined;
}

/**
 * Área de comprovante: "Tirar foto ou escolher arquivo". No celular, o campo de arquivo
 * oferece a câmera e a galeria; no computador, o seletor de arquivos.
 *
 * Acessibilidade: o `<input type="file">` é o próprio controle, escondido só visualmente
 * (`sr-only`), então continua no foco do teclado. O texto visível da área é o seu rótulo
 * (`<label htmlFor>`), e o contorno de foco aparece nele quando o campo recebe o foco.
 * Tecla Enter ou Espaço no campo abre o seletor, como em qualquer campo de arquivo.
 */
export function CampoDeComprovante({ arquivo, aoEscolher, obrigatorio, erro, dica }: Props) {
  const id = useId();
  const idDoTitulo = `${id}-titulo`;
  const idDoErro = `${id}-erro`;
  const idDaDica = `${id}-dica`;
  const entrada = useRef<HTMLInputElement>(null);
  const [erroDoArquivo, setErroDoArquivo] = useState<string | null>(null);

  const mensagem = erroDoArquivo ?? (erro !== undefined && erro !== '' ? erro : null);
  const temDica = dica !== undefined && dica !== '';
  const descricao = [mensagem === null ? null : idDoErro, temDica ? idDaDica : null]
    .filter((item) => item !== null)
    .join(' ');

  function aoEscolherNoCampo(evento: ChangeEvent<HTMLInputElement>) {
    const escolhido = evento.target.files?.[0];
    if (escolhido === undefined) {
      return;
    }

    const problema = validarComprovante(escolhido);
    // O arquivo recusado não fica no campo: escolher o mesmo arquivo de novo dispararia
    // outra vez o evento, e o anterior (válido) segue valendo.
    evento.target.value = '';
    setErroDoArquivo(problema);
    if (problema === null) {
      aoEscolher(escolhido);
    }
  }

  function remover() {
    if (entrada.current !== null) {
      entrada.current.value = '';
    }
    setErroDoArquivo(null);
    aoEscolher(null);
    entrada.current?.focus();
  }

  return (
    <div role="group" aria-labelledby={idDoTitulo}>
      <p id={idDoTitulo} className="mb-2 text-sm font-semibold">
        Comprovante{' '}
        <span className="font-normal text-texto-suave">
          {obrigatorio ? '(obrigatório para esta ação)' : '(opcional)'}
        </span>
      </p>

      <input
        ref={entrada}
        id={id}
        name="comprovante"
        type="file"
        accept={tiposAceitosNoCampo}
        onChange={aoEscolherNoCampo}
        aria-invalid={mensagem === null ? undefined : true}
        aria-describedby={descricao === '' ? undefined : descricao}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marca-600 ${
          mensagem === null ? 'border-marca-500 bg-marca-50' : 'border-recusado bg-recusado-fundo'
        } ${arquivo === null ? 'flex-col justify-center text-center' : ''}`}
      >
        {arquivo === null ? (
          <>
            <IconeDeCamera />
            <span className="font-semibold">Tirar foto ou escolher arquivo</span>{' '}
            <span className="text-sm text-texto-suave">Foto, PDF ou certificado · até 5 MB</span>
          </>
        ) : (
          <>
            {arquivo.type.startsWith('image/') ? (
              <Miniatura arquivo={arquivo} />
            ) : (
              <IconeDeArquivo />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{arquivo.name}</span>{' '}
              <span className="block text-sm text-texto-suave">
                {formatarTamanhoDeArquivo(arquivo.size)} · toque para trocar o arquivo
              </span>
            </span>
          </>
        )}
      </label>

      {arquivo !== null && (
        <button
          type="button"
          onClick={remover}
          className="mt-2 inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-recusado hover:bg-recusado-fundo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-recusado"
        >
          Remover o comprovante
        </button>
      )}

      {mensagem !== null && (
        <p id={idDoErro} className="mt-2 text-sm font-medium text-recusado">
          {mensagem}
        </p>
      )}
      {temDica && (
        <p id={idDaDica} className="mt-2 text-sm text-texto-suave">
          {dica}
        </p>
      )}
    </div>
  );
}
