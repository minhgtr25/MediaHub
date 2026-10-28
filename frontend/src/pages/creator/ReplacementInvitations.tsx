import { useState } from "react";
import { Link } from "react-router-dom";
import { ActionForm, Field, Pagination, State } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { statuses } from "../shared/execution-shared";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";

export function ReplacementInvitations({
  onChanged,
}: {
  onChanged: () => void;
}) {
  const [page, setPage] = useState(1),
    [now, setNow] = useState(Date.now()),
    q = useApi<{
      items: {
        id: string;
        request_title: string;
        staff_name: string;
        work_scope: string;
        deadline: string;
        expires_at: string;
        effective_status: string;
        active: boolean;
        new_assignment_id: string | null;
      }[];
      total: number;
      page: number;
    }>(`/execution/invitations?page=${page}`);
  useAutoRefresh(
    () => {
      setNow(Date.now());
      q.reload();
    },
    { intervalMs: 15000 },
  );
  const changed = () => {
    q.reload();
    onChanged();
  };
  return (
    <section className="panel">
      <h2>Lời mời nhận phần việc thay thế</h2>
      <p>
        Staff có thể trao đổi ngoài hệ thống. Bạn cần tự xác nhận lời mời tại
        đây trong 5–15 phút để được thêm vào hội thoại dự án.
      </p>
      <State query={q}>
        {q.data?.items.map((i) => {
          const available = i.active && new Date(i.expires_at).getTime() > now;
          return (
            <article className="quote-version" key={i.id}>
              <h3>{i.request_title}</h3>
              <p>Staff: {i.staff_name}</p>
              <p className="preserve-lines">{i.work_scope}</p>
              <p>Hạn bàn giao: {i.deadline}</p>
              <span className="status">{statuses[i.effective_status]}</span>
              <p>
                Giữ chỗ đến {new Date(i.expires_at).toLocaleString("vi-VN")}
              </p>
              {available && (
                <>
                  <ActionForm
                    label="Xác nhận nhận việc"
                    onSubmit={() =>
                      post(`/execution/invitations/${i.id}/accept`, {})
                    }
                    onSuccess={changed}
                  />
                  <details>
                    <summary>Từ chối lời mời</summary>
                    <ActionForm
                      label="Gửi lý do từ chối"
                      onSubmit={(f) =>
                        post(`/execution/invitations/${i.id}/decline`, {
                          reason: f.get("reason"),
                        })
                      }
                      onSuccess={changed}
                    >
                      <Field
                        name="reason"
                        label="Lý do"
                        type="textarea"
                        maxLength={2000}
                      />
                    </ActionForm>
                  </details>
                </>
              )}
              {i.effective_status === "ACCEPTED" && i.new_assignment_id && (
                <Link
                  className="btn btn-primary"
                  to={`/creator/assignments/${i.new_assignment_id}`}
                >
                  Mở phần việc
                </Link>
              )}
            </article>
          );
        })}
        {q.data && !q.data.items.length && <p>Chưa có lời mời thay thế.</p>}
        {q.data && (
          <Pagination
            page={page}
            total={q.data.total}
            limit={10}
            onChange={setPage}
          />
        )}
      </State>
    </section>
  );
}
