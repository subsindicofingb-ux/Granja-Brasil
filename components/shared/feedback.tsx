interface ErrorAlertProps {
  message: string;
  title?: string;
}

export function ErrorAlert({ message, title = "Erro ao carregar dados" }: ErrorAlertProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-red-700">{message}</p>
    </div>
  );
}

interface SuccessAlertProps {
  message: string;
}

export function SuccessAlert({ message }: SuccessAlertProps) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
      {message}
    </div>
  );
}

interface FormAlertProps {
  error?: string;
  success?: string;
}

export function FormAlert({ error, success }: FormAlertProps) {
  if (error) {
    return <ErrorAlert message={error} title="Não foi possível salvar" />;
  }
  if (success) {
    return <SuccessAlert message={success} />;
  }
  return null;
}
