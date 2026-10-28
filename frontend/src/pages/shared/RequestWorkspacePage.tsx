import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Paperclip } from "lucide-react";
import { ActionForm, Field, Page, State, Status } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { api, post } from "../../services/api";
import { isCustomerRole } from "../../lib/permissions";
import { requestNextAction, requestsHome } from "../../lib/requests";
import type { RequestDetail } from "../../types/requests";
import type { RequestCommerce } from "../../types/commerce";
import type { CreatorTeam } from "./CreatorTeamPanel";
import { RequestConversation } from "./RequestConversation";
import { RequestCommercePanel } from "./RequestCommercePanel";
import { ServiceWorkspaceDocuments } from "./ServiceWorkspaceDocuments";
import { ServiceChatLayout } from "../../components/ServiceChatLayout";
import { formatRequestBudget, formatRequestDate } from "./request-view";
export function RequestWorkspace() {
  const { id = "" } = useParams(),
    { role, profile } = useAuth();
  const query = useApi<RequestDetail>(`/requests/${id}`, true),
    customer = isCustomerRole(role),
    data = query.data;
  const commerce = useApi<RequestCommerce>(`/requests/${id}/commerce`, true);
  const team = useApi<CreatorTeam>(`/requests/${id}/team`, true);
  const changed = () => {
    query.reload();
    commerce.reload();
    team.reload();
  };
  const closed =
    data?.request.status === "CANCELLED" ||
    (data?.request.status === "CONVERTED" &&
      (!data.order ||
        ["COMPLETED", "CANCELLED", "REFUNDED"].includes(data.order.status)));
  const [downloadError, setDownloadError] = useState("");
  return (
    <Page title={data?.request.title || "Workspace yêu cầu dịch vụ"}>
      <Link to={requestsHome(role)}>← Danh sách yêu cầu</Link>
      <State query={query}>
        {data && (
          <>
            <header className="panel request-workspace-header">
              <div>
                <small>
                  {data.request.request_number} · {data.service.name}
                </small>
                <Status value={data.request.status} />
                <p>
                  <strong>
                    Người phụ trách:{" "}
                    {data.assigned_staff?.full_name || "Chờ MediaHub phân công"}
                  </strong>
                  {data.assigned_staff &&
                    !data.assigned_staff.active &&
                    " · Tài khoản tạm ngừng; cần admin phân công lại"}
                </p>
              </div>
              <p className="request-next-action">
                {requestNextAction(
                  data.request.status,
                  customer,
                  !!data.assigned_staff,
                )}
              </p>
            </header>
            <ServiceChatLayout
              key={`layout-${profile?.id}-${id}`}
              requestId={id}
              tools={
                <ServiceWorkspaceDocuments
                  key={`documents-${id}`}
                  requestId={id}
                  orderId={data.order?.id}
                  onChanged={changed}
                  commerce={
                    <RequestCommercePanel
                      key={`commerce-${id}`}
                      id={id}
                      serviceId={data.request.service_id}
                      query={commerce}
                      team={team}
                      onChanged={changed}
                    />
                  }
                  notes={
                    !customer ? (
                      <InternalNotes
                        key={`notes-${id}`}
                        id={id}
                        closed={closed}
                      />
                    ) : undefined
                  }
                  brief={
                    <>
                      <section className="panel">
                        <h2>Brief &amp; phạm vi</h2>
                        <p className="preserve-lines request-brief">
                          {data.request.brief}
                        </p>
                        <dl>
                          <dt>Ngân sách</dt>
                          <dd>{formatRequestBudget(data.request)}</dd>
                          <dt>Ngày mong muốn</dt>
                          <dd>{formatRequestDate(data.request.deadline)}</dd>
                          <dt>Gói dịch vụ</dt>
                          <dd>
                            {data.request.package_snapshot?.name ||
                              "Cần tư vấn"}
                          </dd>
                          <dt>Creator ưu tiên</dt>
                          <dd>
                            {data.preferred_creator ? (
                              <Link
                                to={`/creators/${data.preferred_creator.slug}`}
                              >
                                {data.preferred_creator.display_name}
                              </Link>
                            ) : (
                              "MediaHub tư vấn"
                            )}
                          </dd>
                        </dl>
                        {data.request.package_snapshot?.deliverables?.length ? (
                          <ul>
                            {data.request.package_snapshot.deliverables.map(
                              (item) => (
                                <li key={item}>{item}</li>
                              ),
                            )}
                          </ul>
                        ) : null}
                        {data.request.cancellation_reason && (
                          <p>Lý do hủy: {data.request.cancellation_reason}</p>
                        )}
                      </section>
                      <section className="panel">
                        <h2>Khách hàng</h2>
                        <p>{data.customer.full_name}</p>
                        <p>{data.customer.company_name}</p>
                        <p>{data.customer.email}</p>
                        {data.customer.phone && <p>{data.customer.phone}</p>}
                      </section>
                      <section className="panel">
                        <h2>Tài liệu tham khảo</h2>
                        {data.request.reference_urls.map((url) => (
                          <p key={url}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {url}
                            </a>
                          </p>
                        ))}
                        {data.attachments.map((file) => (
                          <div className="request-attachment" key={file.id}>
                            <span>
                              <Paperclip size={15} /> {file.file_name}
                              <small>
                                {Math.ceil(file.file_size / 1024)} KB
                              </small>
                            </span>
                            <button
                              className="btn btn-ghost"
                              aria-label={`Tải ${file.file_name}`}
                              onClick={async () => {
                                try {
                                  setDownloadError("");
                                  const link = await api<{ signedUrl: string }>(
                                    `/requests/${id}/attachments/${file.id}/download`,
                                  );
                                  window.open(
                                    link.signedUrl,
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                                } catch (e) {
                                  setDownloadError((e as Error).message);
                                }
                              }}
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        ))}
                        {downloadError && (
                          <p className="error" role="alert">
                            {downloadError}
                          </p>
                        )}
                        {!data.attachments.length &&
                          !data.request.reference_urls.length && (
                            <p className="muted">Chưa có tài liệu tham khảo.</p>
                          )}
                        {!closed && (
                          <ActionForm
                            key={data.attachments.length}
                            label="Thêm tệp"
                            onSuccess={query.reload}
                            onSubmit={async (form) => {
                              const file = form.get("file");
                              if (!(file instanceof File) || !file.size)
                                throw new Error("Vui lòng chọn tệp.");
                              if (file.size > 50 * 1024 * 1024)
                                throw new Error("Tệp tối đa 50 MB.");
                              const body = new FormData();
                              body.append("file", file);
                              return api(`/requests/${id}/attachments`, {
                                method: "POST",
                                body,
                              });
                            }}
                          >
                            <div className="field">
                              <label htmlFor="request-file">
                                PDF, ảnh, MP4 hoặc MOV · tối đa 50 MB
                              </label>
                              <input
                                id="request-file"
                                name="file"
                                type="file"
                                required
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.mov"
                              />
                            </div>
                          </ActionForm>
                        )}
                      </section>
                      <RequestActions
                        data={data}
                        id={id}
                        onChanged={query.reload}
                      />
                    </>
                  }
                />
              }
            >
              <RequestConversation
                key={`conversation-${profile?.id}-${id}`}
                id={id}
                title={data.request.title}
                staffName={
                  data.assigned_staff?.full_name || "Chờ Staff tiếp nhận"
                }
                staffAvatar={data.assigned_staff?.avatar_url}
                status={data.request.status}
                conversationId={data.conversation_id}
                onActivity={changed}
                closed={closed}
              />
            </ServiceChatLayout>
          </>
        )}
      </State>
    </Page>
  );
}

function RequestActions({
  data,
  id,
  onChanged,
}: {
  data: RequestDetail;
  id: string;
  onChanged: () => void;
}) {
  const { role } = useAuth(),
    customer = isCustomerRole(role);
  const agents = useApi<{ id: string; full_name: string }[]>(
    customer ? null : "/requests/agents",
  );
  if (["CANCELLED", "CONVERTED"].includes(data.request.status)) return null;
  return (
    <section className="panel request-actions">
      <h2>Thao tác tiếp theo</h2>
      {!customer && (
        <>
          {data.request.status === "UNASSIGNED" && (
            <ActionForm
              label="Nhận yêu cầu này"
              onSubmit={() => post(`/requests/${id}/claim`)}
              onSuccess={onChanged}
            />
          )}
          {data.request.status === "ASSIGNED" && (
            <ActionForm
              label="Bắt đầu tư vấn"
              onSubmit={() =>
                post(`/requests/${id}/status`, { status: "CONSULTING" })
              }
              onSuccess={onChanged}
            />
          )}
          {data.request.status === "CONSULTING" && (
            <ActionForm
              label="Chờ khách bổ sung"
              onSubmit={() =>
                post(`/requests/${id}/status`, { status: "WAITING_CUSTOMER" })
              }
              onSuccess={onChanged}
            />
          )}
          {data.request.status === "WAITING_CUSTOMER" && (
            <ActionForm
              label="Tiếp tục tư vấn"
              onSubmit={() =>
                post(`/requests/${id}/status`, { status: "CONSULTING" })
              }
              onSuccess={onChanged}
            />
          )}
          <details>
            <summary>
              {data.assigned_staff
                ? "Chuyển người phụ trách"
                : "Phân công nhân viên"}
            </summary>
            <State query={agents}>
              <ActionForm
                label="Lưu phân công"
                onSubmit={(form) =>
                  post(`/requests/${id}/assign`, {
                    assigned_to: form.get("assigned_to"),
                    reason: form.get("reason") || "",
                  })
                }
                onSuccess={onChanged}
              >
                <div className="field">
                  <label htmlFor="request-assignee">
                    Nhân viên đang hoạt động
                  </label>
                  <select
                    key={data.request.assigned_to}
                    id="request-assignee"
                    name="assigned_to"
                    required
                    defaultValue=""
                  >
                    <option value="">Chọn nhân viên</option>
                    {agents.data
                      ?.filter((p) => p.id !== data.request.assigned_to)
                      .map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                  </select>
                </div>
                <Field
                  name="reason"
                  label="Lý do phân công/chuyển (nội bộ)"
                  type="textarea"
                  required={!!data.assigned_staff}
                />
              </ActionForm>
            </State>
          </details>
          {data.assigned_staff &&
            ["ASSIGNED", "CONSULTING", "WAITING_CUSTOMER"].includes(
              data.request.status,
            ) && (
              <details>
                <summary>Trả về hàng đợi</summary>
                <ActionForm
                  label="Trả về hàng đợi"
                  onSubmit={(form) =>
                    post(`/requests/${id}/release`, {
                      reason: form.get("release_reason"),
                    })
                  }
                  onSuccess={() => {
                    window.location.assign(`${requestsHome(role)}?scope=queue`);
                  }}
                >
                  <Field
                    name="release_reason"
                    label="Lý do trả về hàng đợi (nội bộ)"
                    type="textarea"
                  />
                </ActionForm>
              </details>
            )}
        </>
      )}
      {(customer || role === "ADMIN") && (
        <details>
          <summary>Hủy yêu cầu</summary>
          <ActionForm
            label="Hủy yêu cầu"
            onSubmit={(form) =>
              post(`/requests/${id}/cancel`, {
                reason: form.get("cancel_reason"),
              })
            }
            onSuccess={onChanged}
          >
            <Field
              name="cancel_reason"
              label="Lý do hủy (hiển thị trong hội thoại)"
              type="textarea"
            />
          </ActionForm>
        </details>
      )}
    </section>
  );
}

function InternalNotes({ id, closed }: { id: string; closed: boolean }) {
  const query = useApi<{
    notes: {
      id: string;
      author_id: string;
      content: string;
      created_at: string;
    }[];
    assignments: {
      id: string;
      staff_id: string;
      assigned_at: string;
      ended_at: string | null;
      reason: string;
      end_reason: string | null;
    }[];
    people: { id: string; full_name: string }[];
  }>(`/requests/${id}/notes`, true);
  const [content, setContent] = useState("");
  return (
    <section className="panel request-internal">
      <h2>Ghi chú nội bộ</h2>
      <p className="muted">
        Chỉ người phụ trách hiện tại và admin được xem. Nội dung không gửi vào
        hội thoại khách hàng.
      </p>
      <State query={query}>
        {query.data?.notes.map((note) => (
          <article key={note.id}>
            <strong>
              {
                query.data?.people.find((p) => p.id === note.author_id)
                  ?.full_name
              }
            </strong>
            <p className="preserve-lines">{note.content}</p>
            <small>{new Date(note.created_at).toLocaleString("vi-VN")}</small>
          </article>
        ))}
        {!query.data?.notes.length && <p>Chưa có ghi chú nội bộ.</p>}
        {!closed && (
          <ActionForm
            label="Lưu ghi chú"
            onSubmit={() => post(`/requests/${id}/note`, { content })}
            onSuccess={() => {
              setContent("");
              query.reload();
            }}
          >
            <div className="field">
              <label htmlFor="internal-note">Ghi chú</label>
              <textarea
                id="internal-note"
                required
                maxLength={5000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </ActionForm>
        )}
        <details>
          <summary>Lịch sử phân công</summary>
          {query.data?.assignments.map((a) => (
            <article key={a.id}>
              <strong>
                {query.data?.people.find((p) => p.id === a.staff_id)?.full_name}
              </strong>
              <p>
                {new Date(a.assigned_at).toLocaleString("vi-VN")} →{" "}
                {a.ended_at
                  ? new Date(a.ended_at).toLocaleString("vi-VN")
                  : "Đang phụ trách"}
              </p>
              <p>{a.reason}</p>
              {a.end_reason && <p>Lý do kết thúc: {a.end_reason}</p>}
            </article>
          ))}
        </details>
      </State>
    </section>
  );
}
