import { createContext, useContext, type ReactNode } from "react";
import { useApi } from "../hooks/useApi";
type Setting = {
  id: string;
  key: string;
  title: string;
  content: string;
  image: string;
};
const Context = createContext<ReturnType<
  typeof useApi<{ items: Setting[]; total: number }>
> | null>(null);
export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const query = useApi<{ items: Setting[]; total: number }>("/public/settings");
  return <Context.Provider value={query}>{children}</Context.Provider>;
}
export function useSiteSettings() {
  const value = useContext(Context);
  if (!value) throw new Error("SiteSettingsProvider is required");
  return value;
}
export function CompanyContact() {
  const query = useSiteSettings();
  const value = (key: string) =>
    query.data?.items.find((item) => item.key === key)?.content;
  const email = value("company_email"),
    phone = value("company_phone"),
    address = value("company_address"),
    name = value("company_name");
  return (
    <address className="company-contact">
      {name && <p>{name}</p>}
      {email && <p><a href={`mailto:${encodeURIComponent(email)}`}>{email}</a></p>}
      {phone && <p><a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a></p>}
      {address && <p>{address}</p>}
      {query.error && (
        <p role="status">Thông tin liên hệ hiện chưa tải được.</p>
      )}
    </address>
  );
}
