import type { MudancaAuditada, ValorJson } from '@gincana/contracts';

/**
 * US09 — transforma `valoresAntes`/`valoresDepois` em "o que mudou".
 *
 * Função pura, sem Prisma e sem HTTP: entra o par de retratos gravados na auditoria, sai
 * a lista que a tela renderiza como "Quantidade: 12 → 15" e "Situação: Pendente →
 * Aprovado".
 *
 * A comparação mora no servidor, e não no front, por dois motivos: o formato de cada
 * retrato é decidido aqui (quem grava a auditoria é a API) e o front não deve reimplementar
 * tradução de enum nem decidir quais campos fazem sentido para quem lê. Os valores crus
 * continuam viajando na resposta para quem precisar deles.
 */

/**
 * Campos técnicos: identificadores que não dizem nada a quem lê a tela.
 *
 * "tipoAcaoId mudou de 3f2a… para 9b1c…" é ruído. Eles seguem presentes em
 * `valoresAntes`/`valoresDepois` para a conferência do PQCRS, mas ficam fora da lista de
 * mudanças legível.
 */
const CAMPOS_TECNICOS = new Set([
  'colaboradorId',
  'equipeId',
  'tipoAcaoId',
  'regraPontuacaoId',
  'gincanaId',
  'regraId',
]);

/** Rótulo em português de cada campo que aparece nos retratos gravados até hoje. */
const ROTULOS: Record<string, string> = {
  quantidade: 'Quantidade',
  dataAcao: 'Data da ação',
  pontosPorUnidadeAplicado: 'Pontos por unidade',
  pontosPorUnidade: 'Pontos por unidade',
  pontosCalculados: 'Pontos',
  status: 'Situação',
  observacao: 'Observação',
  motivoRecusa: 'Motivo da recusa',
  nome: 'Nome',
  descricao: 'Descrição',
  unidade: 'Unidade',
  exigeEvidencia: 'Exige comprovante',
  ativo: 'Ativo',
  vigenciaInicio: 'Início da vigência',
  vigenciaFim: 'Fim da vigência',
  papel: 'Perfil',
  email: 'E-mail',
  liderId: 'Liderança',
};

/**
 * A ordem em que os campos aparecem na tela.
 *
 * Quem lê a linha do tempo quer ver primeiro o que mexe no placar — situação, quantidade
 * e pontos — e só depois o resto. Campo fora desta lista vai para o fim, em ordem
 * alfabética, para a saída ser estável entre dois carregamentos.
 */
const ORDEM = [
  'status',
  'quantidade',
  'pontosCalculados',
  'pontosPorUnidadeAplicado',
  'pontosPorUnidade',
  'dataAcao',
  'motivoRecusa',
  'observacao',
];

/** Enums do domínio em texto de gente. */
const TEXTOS: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
  COLABORADOR: 'Colaborador',
  LIDER: 'Líder de equipe',
  ADMIN: 'Administradora',
  PLANEJADA: 'Planejada',
  ATIVA: 'Ativa',
  ENCERRADA: 'Encerrada',
  KG: 'kg',
  UNIDADE: 'unidade',
  PECA: 'peça',
  CERTIFICADO: 'certificado',
};

/**
 * Traz o `Json` do Prisma para o tipo do contrato.
 *
 * O tipo gerado pelo Prisma admite `undefined` dentro de objeto, o que o contrato não
 * aceita — e `any` é erro de lint aqui, com razão. Esta conversão derruba `undefined`,
 * preserva `null` explícito e devolve algo que o front consegue serializar.
 */
export function normalizarJson(valor: unknown): ValorJson | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return valor;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => normalizarJson(item));
  }
  if (typeof valor === 'object') {
    const saida: { [campo: string]: ValorJson } = {};
    for (const [chave, item] of Object.entries(valor)) {
      if (item !== undefined) {
        saida[chave] = normalizarJson(item);
      }
    }
    return saida;
  }
  return null;
}

const ehObjeto = (valor: ValorJson | null | undefined): valor is { [campo: string]: ValorJson } =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/**
 * Converte um valor do retrato em texto exibível.
 *
 * `null` continua `null` — a tela decide se escreve "—" ou esconde a linha. Objeto e
 * lista viram JSON: não há retrato assim hoje, mas se um surgir, é melhor a tela mostrar
 * algo legível do que `[object Object]`.
 */
export function formatarValor(valor: ValorJson | undefined): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sim' : 'Não';
  }
  if (typeof valor === 'number') {
    return String(valor);
  }
  if (typeof valor === 'string') {
    return TEXTOS[valor] ?? valor;
  }
  return JSON.stringify(valor);
}

function rotuloDe(campo: string): string {
  return ROTULOS[campo] ?? campo;
}

function ordenar(campos: string[]): string[] {
  return [...campos].sort((a, b) => {
    const posicaoA = ORDEM.indexOf(a);
    const posicaoB = ORDEM.indexOf(b);
    if (posicaoA !== -1 || posicaoB !== -1) {
      return (
        (posicaoA === -1 ? ORDEM.length : posicaoA) - (posicaoB === -1 ? ORDEM.length : posicaoB)
      );
    }
    return a.localeCompare(b, 'pt-BR');
  });
}

/**
 * Compara os dois retratos.
 *
 * Numa criação só existe `valoresDepois`: a saída traz cada campo com `de: null`, que é
 * como a tela escreve "Criado com 24 kg". Numa alteração, só os campos que realmente
 * mudaram entram. Se não há nada comparável (nenhum dos dois é objeto), a lista sai
 * vazia e a tela cai na `descricao`, que toda entrada tem.
 */
export function calcularMudancas(
  antes: ValorJson | null | undefined,
  depois: ValorJson | null | undefined,
): MudancaAuditada[] {
  const objetoAntes = ehObjeto(antes) ? antes : null;
  const objetoDepois = ehObjeto(depois) ? depois : null;

  if (!objetoAntes && !objetoDepois) {
    return [];
  }

  const campos = new Set([...Object.keys(objetoAntes ?? {}), ...Object.keys(objetoDepois ?? {})]);

  const mudancas: MudancaAuditada[] = [];

  for (const campo of ordenar([...campos])) {
    if (CAMPOS_TECNICOS.has(campo)) {
      continue;
    }

    const de = formatarValor(objetoAntes?.[campo]);
    const para = formatarValor(objetoDepois?.[campo]);

    // Campo que não mudou não vira linha. Numa criação, `de` é sempre nulo, então um
    // campo que já nasceu vazio também não aparece — não há o que contar sobre ele.
    if (de === para) {
      continue;
    }

    mudancas.push({ campo, rotulo: rotuloDe(campo), de, para });
  }

  return mudancas;
}
