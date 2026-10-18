import {
  respostaLoginSchema,
  usuarioAutenticadoSchema,
  type Login,
  type RespostaLogin,
  type UsuarioAutenticado,
} from '@gincana/contracts';

import { api, ROTA_DE_LOGIN } from './api.js';

/**
 * As respostas passam pelo schema do contrato: se a API mudar de forma, a falha aparece
 * aqui, e não como um `undefined` perdido numa tela. O `papel` em especial decide o que a
 * pessoa vê, então precisa ser um dos três valores conhecidos.
 */
export async function postarLogin(login: Login): Promise<RespostaLogin> {
  const { data } = await api.post<unknown>(ROTA_DE_LOGIN, login);
  return respostaLoginSchema.parse(data);
}

/** Quem é a pessoa do token. O papel pode ter mudado desde a emissão, então vem do servidor. */
export async function buscarUsuarioAtual(): Promise<UsuarioAutenticado> {
  const { data } = await api.get<unknown>('/auth/me');
  return usuarioAutenticadoSchema.parse(data);
}
