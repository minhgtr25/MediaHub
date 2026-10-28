import { Link, useParams } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import {
  ActionForm,
  Field,
  Page,
  State,
  Status,
  money,
  labels,
} from "../../components/ui";
import { projectService, adminService, reviewService } from "../../services";
import { ProjectMilestones } from "./ProjectWorkspacePanels";
import { FileList, UploadForm } from "./ProjectFilePanels";
import { QuoteForm } from "./ProjectQuoteForm";
import type { ProjectWorkspaceData } from "./project-workspace-types";
import { EditProject } from "../admin/ProjectFileManagementPage";
import { patch, post } from "../../services/api";
import { date } from "./DashboardPages";

export function CustomerProject() {
  return <ProjectWorkspace />;
}
export function AdminProjectDetail() {
  return <ProjectWorkspace admin />;
}
function ProjectWorkspace({ admin = false }: { admin?: boolean }) {
  const { id = "" } = useParams();
  const query = useApi<ProjectWorkspaceData>("/projects/" + id),
    p = query.data;
  const transitions: Record<string, string[]> = {
    SUBMITTED: ["REVIEWING", "CANCELLED"],
    REVIEWING: ["CANCELLED"],
    QUOTATION_SENT: ["CANCELLED"],
    QUOTATION_ACCEPTED: ["IN_PROGRESS"],
    IN_PROGRESS: ["WAITING_REVIEW"],
    REVISION: ["WAITING_REVIEW"],
  };
  return (
    <Page title="Chi tiết dự án">
      <Link
        className="back"
        to={admin ? "/admin/projects" : "/customer/dashboard"}
      >
        ← Quay lại danh sách
      </Link>
      <State query={query}>
        {p && (
          <div className="customer-project">
            <nav className="toolbar" aria-label="Nội dung dự án">
              {[
                ["quotation", "Báo giá"],
                ["deliverables", "Bàn giao"],
                ["files", "Tệp"],
                ["revisions", "Chỉnh sửa"],
                ["timeline", "Lịch sử"],
              ].map(([anchor, title]) => (
                <a className="btn btn-ghost" key={anchor} href={`#${anchor}`}>
                  {title}
                </a>
              ))}
              <Link
                className="btn btn-ghost"
                to={`${admin ? "/admin" : "/customer"}/projects/${id}/messages`}
              >
                Trao đổi
              </Link>
            </nav>
            <ProjectMilestones projectId={id} admin={admin} />
            <section className="panel">
              <div className="project-title">
                <div>
                  <span className="eyebrow">{p.category}</span>
                  <h2>{p.title}</h2>
                </div>
                <Status value={p.status} />
              </div>
              <p className="preserve-lines">{p.description}</p>
              {p.scope && <p className="preserve-lines">Phạm vi: {p.scope}</p>}
              <label>
                Tiến độ: {p.progress ?? 0}%{" "}
                <progress max="100" value={p.progress ?? 0} />
              </label>
              <div className="result-row">
                <div>
                  <span>Ngân sách dự kiến</span>
                  <b>{money(p.budget)}</b>
                </div>
                <div>
                  <span>Hạn bàn giao</span>
                  <b>{date(p.deadline)}</b>
                </div>
                <div>
                  <span>Ngày tạo</span>
                  <b>{date(p.created_at)}</b>
                </div>
              </div>
            </section>
            <div className="split">
              <div className="stack">
                <section className="panel">
                  <h2 id="quotation">Báo giá</h2>
                  {!p.quotations?.length && (
                    <p>MediaHub đang chuẩn bị báo giá cho dự án.</p>
                  )}
                  {p.quotations?.map((q) => (
                    <div className="quotation" key={q.id}>
                      <div className="panel-head">
                        <b>{money(q.total)}</b>
                        <Status value={q.status} />
                      </div>
                      <p>Hiệu lực đến {date(q.valid_until)}</p>
                      {q.quotation_items.map((item) => (
                        <p key={item.id}>
                          {item.description} · {item.quantity} ×{" "}
                          {money(item.unit_price)}
                        </p>
                      ))}
                      <p>Giảm giá: {money(q.discount ?? 0)}</p>
                      <p>
                        Tạm tính: {money(q.subtotal)} · Thuế ({q.tax_rate ?? 0}
                        %): {money(q.tax ?? 0)}
                      </p>
                      {admin && (
                        <Link to={`/admin/quotations/${q.id}`}>
                          Xem và quản lý báo giá
                        </Link>
                      )}
                      <p>{q.notes}</p>
                      {!admin &&
                        p.status === "QUOTATION_SENT" &&
                        q.status === "SENT" && (
                          <div className="toolbar">
                            <ActionForm
                              label="Chấp nhận báo giá"
                              onSubmit={() => {
                                if (
                                  !window.confirm(
                                    "Xác nhận chấp nhận báo giá và phạm vi dự án?",
                                  )
                                )
                                  throw new Error("Chưa xác nhận báo giá.");
                                return projectService.action(
                                  id,
                                  "accept-quotation",
                                );
                              }}
                              onSuccess={query.reload}
                            />
                            <ActionForm
                              label="Từ chối báo giá"
                              onSubmit={() => {
                                if (
                                  !window.confirm(
                                    "Từ chối báo giá sẽ hủy dự án. Bạn muốn tiếp tục?",
                                  )
                                )
                                  throw new Error("Chưa từ chối báo giá.");
                                return projectService.action(
                                  id,
                                  "reject-quotation",
                                );
                              }}
                              onSuccess={query.reload}
                            />
                          </div>
                        )}
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h2 id="deliverables">Sản phẩm bàn giao</h2>
                  <FileList
                    id={id}
                    files={p.deliverables ?? []}
                    kind="deliverables"
                  />
                  {admin && ["IN_PROGRESS", "REVISION"].includes(p.status) && (
                    <UploadForm
                      path={`/admin/projects/${id}/deliverables`}
                      reload={query.reload}
                    />
                  )}
                  {!admin && p.status === "WAITING_REVIEW" && (
                    <>
                      {p.deliverables
                        ?.filter(
                          (deliverable: { status: string }) =>
                            deliverable.status === "PENDING_APPROVAL",
                        )
                        .map((deliverable: { id: string; name: string }) => (
                          <ActionForm
                            key={deliverable.id}
                            label={`Duyệt: ${deliverable.name}`}
                            onSubmit={() => {
                              if (
                                !window.confirm(
                                  "Xác nhận duyệt sản phẩm bàn giao này?",
                                )
                              )
                                throw new Error("Chưa xác nhận.");
                              return projectService.action(
                                id,
                                "approve-deliverable",
                                { deliverable_id: deliverable.id },
                              );
                            }}
                            onSuccess={query.reload}
                          />
                        ))}
                      <ActionForm
                        label="Duyệt & hoàn thành dự án"
                        onSubmit={() => {
                          if (
                            !window.confirm(
                              "Xác nhận nghiệm thu sản phẩm và hoàn thành dự án?",
                            )
                          )
                            throw new Error("Chưa xác nhận nghiệm thu.");
                          return projectService.action(id, "complete");
                        }}
                        onSuccess={query.reload}
                      />
                      <ActionForm
                        label="Gửi yêu cầu chỉnh sửa"
                        onSubmit={(data) =>
                          projectService.action(id, "revisions", {
                            description: String(data.get("description")),
                            ...(data.get("deliverable_id")
                              ? {
                                  deliverable_id: String(
                                    data.get("deliverable_id"),
                                  ),
                                }
                              : {}),
                          })
                        }
                        onSuccess={query.reload}
                      >
                        <Field
                          name="description"
                          label="Nội dung cần chỉnh sửa"
                          type="textarea"
                        />
                        <label className="field">
                          Sản phẩm cần chỉnh sửa
                          <select name="deliverable_id">
                            <option value="">
                              Tất cả sản phẩm đang chờ duyệt
                            </option>
                            {p.deliverables
                              ?.filter(
                                (deliverable: { status: string }) =>
                                  deliverable.status === "PENDING_APPROVAL",
                              )
                              .map(
                                (deliverable: { id: string; name: string }) => (
                                  <option
                                    value={deliverable.id}
                                    key={deliverable.id}
                                  >
                                    {deliverable.name}
                                  </option>
                                ),
                              )}
                          </select>
                        </label>
                      </ActionForm>
                    </>
                  )}
                </section>
                <section className="panel">
                  <h2 id="files">Tài liệu dự án</h2>
                  <FileList
                    id={id}
                    files={p.project_files ?? []}
                    kind="files"
                  />
                  {!["COMPLETED", "CANCELLED"].includes(p.status) && (
                    <UploadForm
                      path={`/projects/${id}/files`}
                      reload={query.reload}
                    />
                  )}
                </section>
              </div>
              <aside className="stack">
                {admin && !["COMPLETED", "CANCELLED"].includes(p.status) && (
                  <EditProject project={p} reload={query.reload} />
                )}
                {admin && transitions[p.status]?.length > 0 && (
                  <section className="panel">
                    <h2>Cập nhật tiến độ</h2>
                    <ActionForm
                      onSubmit={(data) =>
                        adminService.status(id, String(data.get("status")))
                      }
                      onSuccess={query.reload}
                    >
                      <label className="field">
                        Trạng thái tiếp theo
                        <select name="status">
                          {transitions[p.status].map((s) => (
                            <option key={s} value={s}>
                              {labels[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </ActionForm>
                  </section>
                )}
                {admin && p.status === "REVIEWING" && (
                  <QuoteForm
                    id={id}
                    services={p.project_services ?? []}
                    draft={p.quotations?.find(
                      (quote: { status: string }) => quote.status === "DRAFT",
                    )}
                    reload={query.reload}
                  />
                )}
                <section className="panel">
                  <h2 id="timeline">Lịch sử hoạt động</h2>
                  <ol className="activity-list">
                    {[...(p.project_status_history ?? [])]
                      .sort((a, b) => a.created_at.localeCompare(b.created_at))
                      .map((h) => (
                        <li key={h.id}>
                          <Status value={h.status} />
                          <p>{h.note || "Đã cập nhật trạng thái dự án"}</p>
                          <small>{date(h.created_at)}</small>
                        </li>
                      ))}
                  </ol>
                  {!p.project_status_history?.length && (
                    <p>Chưa có hoạt động.</p>
                  )}
                </section>
                <section className="panel">
                  <h2>Thanh toán</h2>
                  {p.invoices?.map((i) => (
                    <div key={i.id}>
                      <p>{i.invoice_number}</p>
                      <h3>{money(i.amount)}</h3>
                      <Status value={i.status} />
                      {admin && i.status === "DRAFT" && (
                        <Link to={`/admin/invoices/${i.id}`}>
                          Xem và phát hành hóa đơn
                        </Link>
                      )}
                      {admin && i.status === "PENDING" && (
                        <ActionForm
                          label="Xác nhận đã thanh toán"
                          onSubmit={() => {
                            if (
                              !window.confirm(
                                "Xác nhận đã nhận khoản thanh toán này?",
                              )
                            )
                              throw new Error("Chưa xác nhận thanh toán.");
                            return post(`/admin/projects/${id}/paid`);
                          }}
                          onSuccess={query.reload}
                        />
                      )}
                    </div>
                  ))}
                  {!p.invoices?.length && <p>Chưa phát sinh hóa đơn.</p>}
                </section>
                {!!p.revision_requests?.length && (
                  <section className="panel">
                    <h2 id="revisions">Yêu cầu chỉnh sửa</h2>
                    {p.revision_requests.map((r) => (
                      <div key={r.id}>
                        <Status value={r.status} />
                        <p>{r.description}</p>
                        {admin &&
                          ["PENDING", "REQUESTED", "IN_PROGRESS"].includes(
                            r.status,
                          ) && (
                            <ActionForm
                              onSubmit={(data) =>
                                patch(
                                  "/admin/projects/" +
                                    id +
                                    "/revisions/" +
                                    r.id,
                                  { status: data.get("revision_status") },
                                )
                              }
                              onSuccess={query.reload}
                            >
                              <label className="field">
                                Trạng thái
                                <select name="revision_status">
                                  <option>IN_PROGRESS</option>
                                  <option>RESOLVED</option>
                                  <option>CANCELLED</option>
                                </select>
                              </label>
                            </ActionForm>
                          )}
                      </div>
                    ))}
                  </section>
                )}
              </aside>
            </div>
            {!admin && p.status === "COMPLETED" && !p.reviews?.length && (
              <section className="panel">
                <h2>Đánh giá trải nghiệm</h2>
                <ActionForm
                  label="Gửi đánh giá"
                  onSubmit={(data) =>
                    reviewService.create(id, {
                      rating: Number(data.get("rating")),
                      quality_rating: Number(data.get("quality_rating")),
                      communication_rating: Number(
                        data.get("communication_rating"),
                      ),
                      value_rating: Number(data.get("value_rating")),
                      comment: String(data.get("comment")),
                    })
                  }
                  onSuccess={query.reload}
                >
                  <div className="form-grid">
                    {[
                      ["rating", "Tổng thể"],
                      ["quality_rating", "Chất lượng"],
                      ["communication_rating", "Trao đổi"],
                      ["value_rating", "Giá trị"],
                    ].map(([name, label]) => (
                      <label className="field" key={name}>
                        {label}
                        <select name={name}>
                          {[5, 4, 3, 2, 1].map((v) => (
                            <option key={v} value={v}>
                              {v} sao
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <Field
                    name="comment"
                    label="Chia sẻ trải nghiệm của bạn"
                    type="textarea"
                  />
                </ActionForm>
              </section>
            )}
          </div>
        )}
      </State>
    </Page>
  );
}
