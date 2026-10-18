import { z } from 'zod';

import { idSchema, papelSchema } from './comum.js';

/** US01 — entrar com perfil de colaborador, líder de equipe ou administradora. */
export const loginSchema = z.object({
  email: z.email({ message: 'Informe um e-mail válido.' }),
  senha: z.string().min(1, 'Informe a senha.'),
});
export type Login = z.infer<typeof loginSchema>;

export const usuarioAutenticadoSchema = z.object({
  id: idSchema,
  nome: z.string(),
  email: z.email(),
  papel: papelSchema,
  equipeId: idSchema.nullable(),
  /** Preenchido quando a pessoa lidera uma equipe; é o que autoriza aprovar. */
  equipeLideradaId: idSchema.nullable(),
});
export type UsuarioAutenticado = z.infer<typeof usuarioAutenticadoSchema>;

export const respostaLoginSchema = z.object({
  token: z.string(),
  usuario: usuarioAutenticadoSchema,
});
export type RespostaLogin = z.infer<typeof respostaLoginSchema>;

/**
 * Regra de senha mostrada na tela de cadastro do protótipo: mínimo de 8 caracteres,
 * com pelo menos um número.
 */
export const senhaSchema = z
  .string()
  .min(8, 'A senha precisa de pelo menos 8 caracteres.')
  .regex(/[0-9]/, 'A senha precisa de pelo menos um número.');
