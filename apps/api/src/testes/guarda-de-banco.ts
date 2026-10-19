/**
 * Trava de segurança: a suíte só roda contra um banco de teste.
 *
 * As fixtures apagam dados. Se a configuração apontar, por engano, para o banco de
 * desenvolvimento ou para um ambiente hospedado, é melhor a suíte falhar alto aqui do que
 * descobrir depois que a carga de demonstração sumiu na véspera da Sprint Review.
 */
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL não definida para os testes. Rode pelo `npm test`.');
}

const nomeDoBanco = new URL(url).pathname.slice(1);

if (!nomeDoBanco.endsWith('_test')) {
  throw new Error(
    `Os testes apagam dados e só rodam contra um banco cujo nome termina em "_test". ` +
      `A configuração aponta para "${nomeDoBanco}". ` +
      'Veja apps/api/vitest.config.ts e a variável DATABASE_URL_TEST.',
  );
}
