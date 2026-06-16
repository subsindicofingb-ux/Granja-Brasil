export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export function serviceError(message: string): { data: null; error: string } {
  return { data: null, error: message };
}

export function mapSupabaseError(error: { message: string; code?: string }): string {
  if (error.code === "23505") {
    return "Registro duplicado. Verifique nome/número já cadastrado.";
  }
  if (error.code === "23503") {
    return "Referência inválida. Verifique os dados selecionados.";
  }
  if (error.code === "23P01") {
    return "Conflito de horário com outra reserva.";
  }
  return error.message;
}
