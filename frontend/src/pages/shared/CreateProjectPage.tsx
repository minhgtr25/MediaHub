import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { ActionForm, Field, Page, State, money } from "../../components/ui";
import { projectService } from "../../services";

export function CreateProject() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = useApi<{
    items: {
      id: string;
      name: string;
      description: string;
      category?: string;
      starting_price: number;
    }[];
  }>("/public/services?limit=100");
  const [selected, setSelected] = useState<string[]>(() =>
      params.get("service") ? [params.get("service")!] : [],
    ),
    [step, setStep] = useState(0);
  return (
    <Page title="Bắt đầu dự án mới">
      <p>Chia sẻ ý tưởng của bạn. MediaHub sẽ tư vấn giải pháp phù hợp.</p>
      <div className="wizard">
        <div className="wizard-steps create-steps">
          {["Chọn dịch vụ", "Thông tin & gửi yêu cầu"].map((label, i) => (
            <div key={label} className={i <= step ? "active" : ""}>
              <span>{i + 1}</span>
              {label}
            </div>
          ))}
        </div>
        <State query={query}>
          <div className="form-panel">
            <ActionForm
              showSubmit={step > 0}
              label="Gửi yêu cầu dự án"
              onSubmit={async (data) => {
                if (!selected.length)
                  throw new Error("Vui lòng chọn ít nhất một dịch vụ.");
                const firstService = query.data?.items.find(
                  (s) => s.id === selected[0],
                );
                if (!firstService)
                  throw new Error(
                    "Dịch vụ đã chọn không còn khả dụng. Vui lòng chọn lại.",
                  );
                const result = await projectService.create({
                  title: String(data.get("title")),
                  description: String(data.get("description")),
                  category: firstService.category || firstService.name,
                  budget: Number(data.get("budget")),
                  deadline: String(data.get("deadline")),
                  service_ids: selected,
                  status: "SUBMITTED",
                });
                navigate("/customer/projects/" + result.id);
              }}
            >
              <section hidden={step !== 0}>
                <h2>Bạn đang cần dịch vụ gì?</h2>
                <p>Có thể chọn nhiều dịch vụ cho cùng một dự án.</p>
                <div className="choice-grid">
                  {query.data?.items.map((s) => (
                    <button
                      type="button"
                      aria-pressed={selected.includes(s.id)}
                      className={`choice ${selected.includes(s.id) ? "chosen" : ""}`}
                      key={s.id}
                      onClick={() =>
                        setSelected((prev) =>
                          prev.includes(s.id)
                            ? prev.filter((id) => id !== s.id)
                            : [...prev, s.id],
                        )
                      }
                    >
                      <span>
                        {selected.includes(s.id) ? "✓ Đã chọn" : "＋ Lựa chọn"}
                      </span>
                      <b>{s.name}</b>
                      <small>{s.description}</small>
                      <small>Từ {money(s.starting_price)}</small>
                    </button>
                  ))}
                </div>
                {!query.data?.items.length && <p>Chưa có dịch vụ khả dụng.</p>}
                <div className="wizard-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!selected.length}
                    onClick={() => setStep(1)}
                  >
                    Tiếp tục <ArrowRight size={16} />
                  </button>
                </div>
              </section>
              <section hidden={step === 0}>
                <h2>Thông tin & ngân sách</h2>
                <Field name="title" label="Tên dự án" />
                <Field
                  name="description"
                  label="Mục tiêu, đối tượng và yêu cầu sản phẩm"
                  type="textarea"
                />
                <div className="form-grid">
                  <Field
                    name="budget"
                    label="Ngân sách dự kiến (VNĐ)"
                    type="number"
                  />
                  <Field
                    name="deadline"
                    label="Ngày bàn giao mong muốn"
                    type="date"
                  />
                </div>
                <div className="summary">
                  <b>Dịch vụ đã chọn</b>
                  <p>
                    {query.data?.items
                      .filter((s) => selected.includes(s.id))
                      .map((s) => s.name)
                      .join(" · ")}
                  </p>
                  <p>
                    MediaHub sẽ xem xét yêu cầu và gửi báo giá trước khi triển
                    khai.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setStep(0)}
                >
                  Quay lại chọn dịch vụ
                </button>
              </section>
            </ActionForm>
          </div>
        </State>
      </div>
    </Page>
  );
}
