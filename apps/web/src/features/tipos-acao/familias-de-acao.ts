import type { Unidade } from '@gincana/contracts';

/**
 * A família de uma ação define a cor e o ícone dela: o colaborador reconhece o tipo pela
 * cor antes de ler o nome (alimentos laranja, tampinhas verde-água, roupas azul, curso
 * lilás, outra ação amarelo).
 *
 * As atividades extras nascem no meio da gincana, então a família nunca sai do NOME da
 * ação: ela sai de um campo do tipo. Hoje o contrato só tem a unidade de medida, que separa
 * peça (roupas) e certificado (curso). Todo o resto cai na família `outra`, que é o padrão
 * para qualquer tipo que a tela não conheça.
 *
 * Limite conhecido: alimentos e tampinhas são ambos em kg e, por isso, hoje têm a mesma cor.
 * Separá-los exige um campo `familia` no tipo de ação (decisão de contrato e de produto).
 * Quando ele existir, `familiaDoTipo` passa a ler o campo, e nenhum componente muda.
 */
export type FamiliaDeAcao = 'alimentos' | 'tampinhas' | 'roupas' | 'curso' | 'outra';

const familiaPorUnidade: Record<Unidade, FamiliaDeAcao> = {
  KG: 'alimentos',
  PECA: 'roupas',
  CERTIFICADO: 'curso',
  UNIDADE: 'outra',
};

export function familiaDoTipo(tipo: { unidade: Unidade }): FamiliaDeAcao {
  return familiaPorUnidade[tipo.unidade];
}

/**
 * Classes completas, escritas por extenso: o Tailwind só gera o CSS das classes que
 * encontra no código, então `bg-acao-${familia}` não funcionaria.
 */
export const estilosDaFamilia: Record<FamiliaDeAcao, { fundo: string; tinta: string }> = {
  alimentos: { fundo: 'bg-acao-alimentos', tinta: 'text-acao-alimentos-tinta' },
  tampinhas: { fundo: 'bg-acao-tampinhas', tinta: 'text-acao-tampinhas-tinta' },
  roupas: { fundo: 'bg-acao-roupas', tinta: 'text-acao-roupas-tinta' },
  curso: { fundo: 'bg-acao-curso', tinta: 'text-acao-curso-tinta' },
  outra: { fundo: 'bg-acao-outra', tinta: 'text-acao-outra-tinta' },
};
