import { useTranslation } from "react-i18next";

interface SupportContactsCardProps {
  email: string | null;
}

export function SupportContactsCard({ email }: SupportContactsCardProps) {
const { t } = useTranslation();
  return (
    <div className="mt-3 space-y-2">
      <ContactLine label={t("supportContactsCard.emailLabel")} value={email ?? t("supportContactsCard.notConfigured")} />
      <p className="text-xs text-[#8b9db2] mt-4">
        {t("supportContactsCard.message")}
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
