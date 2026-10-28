import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { CompanyContact } from "../../contexts/SiteSettings";
import { useApi } from "../../hooks/useApi";
import { ActionForm, Field, State } from "../../components/ui";
import { api, post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import type { Collection, Service } from "./service.types";

export function Enquiry({ contact = false }: { contact?: boolean }) {
  const auth = useAuth();
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const query = useApi<Collection<Service>>("/public/services?limit=100");
  if (!contact && auth.loading)
    return (
      <div className="panel" role="status">
        Đang xác thực…
      </div>
    );
  if (!contact && !auth.currentUser)
    return (
      <Navigate
        to="/login"
        state={{ from: `/request-project${params.size ? `?${params}` : ""}` }}
        replace
      />
    );
  if (!contact && isCustomerRole(auth.role))
    return (
      <Navigate
        to={`/customer/requests/new${params.size ? `?${params}` : ""}`}
        replace
      />
    );
  if (!contact)
    return (
      <section className="page section">
        <h1>Yêu cầu dịch vụ</h1>
        <p>Vui lòng sử dụng tài khoản khách hàng để gửi yêu cầu.</p>
        <Link to="/services">Xem dịch vụ</Link>
      </section>
    );
  return (
    <section className="page section enquiry">
      <h1>{contact ? "Liên hệ MediaHub" : "Bắt đầu dự án"}</h1>
      {contact && <CompanyContact />}
      <p>
        Chia sẻ nhu cầu của bạn. MediaHub sẽ liên hệ để làm rõ phạm vi và báo
        giá.
      </p>
      {done ? (
        <div className="panel" role="status">
          <h2>Cảm ơn bạn!</h2>
          <p>Đội ngũ MediaHub sẽ sớm liên hệ với bạn.</p>
          <Link to="/services">Xem dịch vụ</Link>
        </div>
      ) : (
        <State query={query}>
          <ActionForm
            label="Gửi yêu cầu"
            onSuccess={() => setDone(true)}
            onSubmit={(data) => {
              const payload = {
                full_name: data.get("full_name"),
                email: data.get("email"),
                phone: data.get("phone"),
                company: data.get("company"),
                service_id: data.get("service_id") || null,
                project_type: data.get("project_type") || "",
                message: data.get("message"),
                budget_range: data.get("budget_range") || "",
                deadline: data.get("deadline") || null,
                source: contact ? "CONTACT" : "PROJECT_REQUEST",
              };
              const attachment = data.get("attachment");
              if (attachment instanceof File && attachment.size) {
                if (attachment.size > 10 * 1024 * 1024)
                  throw new Error("Tệp không được vượt quá 10 MB.");
                const form = new FormData();
                form.set("payload", JSON.stringify(payload));
                form.set("attachment", attachment);
                return api("/public/leads", { method: "POST", body: form });
              }
              return post("/public/leads", payload);
            }}
          >
            <Field
              name="full_name"
              label="Họ và tên"
              value={auth.profile?.full_name}
            />
            <Field
              name="email"
              label="Email"
              type="email"
              value={auth.profile?.email}
            />
            <Field
              name="phone"
              label="Điện thoại"
              type="tel"
              required={false}
            />
            <Field name="company" label="Công ty" required={false} />
            <div className="field">
              <label htmlFor="service_id">Dịch vụ</label>
              <select
                id="service_id"
                name="service_id"
                defaultValue={params.get("service") ?? ""}
              >
                <option value="">Cần tư vấn lựa chọn</option>
                {query.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {!contact && (
              <>
                <Field name="project_type" label="Loại dự án" />
                <Field
                  name="budget_range"
                  label="Khoảng ngân sách"
                  required={false}
                />
                <Field
                  name="deadline"
                  label="Ngày hoàn thành mong muốn"
                  type="date"
                  required={false}
                />
              </>
            )}
            <div className="field">
              <label htmlFor="attachment">
                Tệp tham khảo (PDF hoặc ảnh, tối đa 10 MB)
              </label>
              <input
                id="attachment"
                name="attachment"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
              />
            </div>
            <Field
              name="message"
              label={contact ? "Nội dung" : "Mô tả yêu cầu dự án"}
              type="textarea"
            />
          </ActionForm>
        </State>
      )}
    </section>
  );
}
