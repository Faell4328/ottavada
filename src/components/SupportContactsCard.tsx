interface SupportContactsCardProps {
  email: string | null;
}

export function SupportContactsCard({ email }: SupportContactsCardProps) {
  return (
    <div className="mt-3 space-y-2">
      <ContactLine label="Email" value={email ?? "Não configurado"} />
      <p className="text-xs text-[#8b9db2] mt-4">
        Caso tenha alguma: sugestão, problema ou dúvida, entre em contato com o
        desenvolvedor pelo email acima.
      </p>
    </div>
  );
}

function ContactLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <span className="text-base font-semibold text-[#34485d]">{label}: </span>
      <span className="text-base font-semibold text-[#34485d]">{value}</span>
    </div>
  );
}
