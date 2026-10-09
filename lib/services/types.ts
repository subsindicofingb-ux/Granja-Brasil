export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function serviceError(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

export function serviceOk<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function mapSupabaseError(error: { message: string; code?: string }): string {
  if (error.code === "23505") {
    if (error.message.includes("reservations_class_attendee_slot_key")) {
      return "Este nome já está na lista desta aula para a unidade.";
    }
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
