import type { ReactNode } from "react";

interface SupportContactsCardProps {
  email: string | null;
  phone: string | null;
}

export function SupportContactsCard({ email, phone }: SupportContactsCardProps) {
  return (
    <div className="rounded-xl border border-[#d8e0ea] bg-white/80 p-3 text-xs text-[#4f6887]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b849e]">
        Contato
      </p>

      <div className="mt-3 space-y-2">
        <ContactLine
          label="Email"
          value={
            email ? (
              <a className="font-semibold text-[#34485d] underline-offset-2 hover:underline" href={`mailto:${email}`}>
                {email}
              </a>
            ) : (
              "Não configurado"
            )
          }
        />
        <ContactLine
          label="Telefone"
          value={
            phone ? (
              <a className="font-semibold text-[#34485d] underline-offset-2 hover:underline" href={`tel:${phone}`}>
                {phone}
              </a>
            ) : (
              "Não configurado"
            )
          }
        />
      </div>
    </div>
  );
}

function ContactLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-semibold text-[#34485d]">{label}</span>
      <span className="text-[#4f6887]">{value}</span>
    </div>
  );
}