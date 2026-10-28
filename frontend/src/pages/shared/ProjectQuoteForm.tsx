import { ActionForm, Field } from "../../components/ui";
import { post } from "../../services/api";
import type {
  ProjectQuotation,
  ProjectServiceRow,
} from "./project-workspace-types";

export function QuoteForm({
  id,
  services,
  reload,
  draft,
}: {
  id: string;
  services: ProjectServiceRow[];
  reload: () => void;
  draft?: Pick<
    ProjectQuotation,
    "quotation_items" | "discount" | "valid_until" | "notes" | "tax_rate"
  >;
}) {
  return (
    <section className="panel">
      <h2>Soạn báo giá</h2>
      <ActionForm
        label="Lưu báo giá"
        onSubmit={(data) =>
          post(
            `/admin/projects/${id}/${data.get("mode") === "DRAFT" ? "quotation-draft" : "quotation"}`,
            {
              items: services.map((s, i) => ({
                service_id: s.service_id,
                description: String(data.get(`desc-${i}`)),
                quantity: Number(data.get(`quantity-${i}`)),
                unit_price: Number(data.get(`price-${i}`)),
              })),
              discount: Number(data.get("discount")),
              tax_rate: Number(data.get("tax_rate")),
              valid_until: String(data.get("valid_until")),
              notes: String(data.get("notes")),
            },
          )
        }
        onSuccess={reload}
      >
        {services.map((s, i) => (
          <div key={s.service_id}>
            <Field
              name={`desc-${i}`}
              label={`Hạng mục ${i + 1}`}
              value={
                draft?.quotation_items.find(
                  (item) => item.service_id === s.service_id,
                )?.description
              }
            />
            <label className="field">
              Số lượng
              <input
                type="number"
                name={`quantity-${i}`}
                min="1"
                max="10000"
                step="1"
                required
                defaultValue={
                  draft?.quotation_items.find(
                    (item) => item.service_id === s.service_id,
                  )?.quantity ?? 1
                }
              />
            </label>
            <Field
              name={`price-${i}`}
              label="Đơn giá (VNĐ)"
              type="number"
              value={
                draft?.quotation_items.find(
                  (item) => item.service_id === s.service_id,
                )?.unit_price
              }
            />
          </div>
        ))}
        <Field
          name="discount"
          label="Giảm giá (VNĐ)"
          type="number"
          value={draft?.discount ?? 0}
        />
        <Field
          name="tax_rate"
          label="Thuế (%)"
          type="number"
          value={draft?.tax_rate ?? 0}
        />
        <Field
          name="valid_until"
          label="Hiệu lực đến"
          type="date"
          value={draft?.valid_until}
        />
        <Field
          name="notes"
          label="Điều khoản và ghi chú"
          type="textarea"
          required={false}
          value={draft?.notes ?? ""}
        />
        <label className="field">
          Thao tác
          <select name="mode" defaultValue="DRAFT">
            <option value="DRAFT">Lưu bản nháp để xem trước</option>
            <option value="SENT">Lưu và gửi cho khách hàng</option>
          </select>
        </label>
      </ActionForm>
    </section>
  );
}
