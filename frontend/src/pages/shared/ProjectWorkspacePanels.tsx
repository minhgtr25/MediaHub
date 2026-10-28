import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import {
  ActionForm,
  Field,
  State,
  Pagination,
  Status,
} from "../../components/ui";
import { post, patch } from "../../services/api";

type Collection<T> = { items: T[]; total: number };
type Message = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
};
type Milestone = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: string;
};

export function ProjectMessages({ projectId }: { projectId?: string }) {
  const { id } = useParams();
  const pid = projectId ?? id;
  const auth = useAuth();
  const [page, setPage] = useState(1);
  const query = useApi<Collection<Message>>(
    `/projects/${pid}/messages?page=${page}`,
  );
  return (
    <section className="panel">
      <h2>Trao đổi dự án</h2>
      <State query={query}>
        {query.data?.items.map((row) => (
          <article className="message" key={row.id}>
            <b>
              {row.sender_id === auth.profile?.id ? "Bạn" : "Thành viên dự án"}
            </b>
            <time dateTime={row.created_at}>
              {" "}
              · {new Date(row.created_at).toLocaleString("vi-VN")}
            </time>
            <p className="preserve-lines">{row.message}</p>
          </article>
        ))}
        {!query.data?.items.length && <p>Chưa có trao đổi.</p>}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
      <ActionForm
        label="Gửi tin nhắn"
        onSubmit={(data) =>
          post(`/projects/${pid}/messages`, { message: data.get("message") })
        }
        onSuccess={query.reload}
      >
        <Field name="message" label="Nội dung trao đổi" type="textarea" />
      </ActionForm>
    </section>
  );
}

export function ProjectMilestones({
  projectId,
  admin = false,
}: {
  projectId: string;
  admin?: boolean;
}) {
  const query = useApi<Collection<Milestone>>(
    `/projects/${projectId}/milestones`,
  );
  return (
    <section className="panel">
      <h2>Mốc tiến độ</h2>
      <State query={query}>
        {query.data?.items.map((row) => (
          <article className="message" key={row.id}>
            <h3>{row.title}</h3>
            <Status value={row.status} />
            <p>{row.description}</p>
            {row.due_date && <p>{row.due_date}</p>}
            {admin && (
              <ActionForm
                onSubmit={(data) =>
                  patch(`/projects/${projectId}/milestones/${row.id}`, {
                    status: data.get("status"),
                  })
                }
                onSuccess={query.reload}
              >
                <label className="field">
                  Trạng thái
                  <select name="status" defaultValue={row.status}>
                    {["PENDING", "IN_PROGRESS", "COMPLETED"].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </ActionForm>
            )}
          </article>
        ))}
        {!query.data?.items.length && <p>Chưa có mốc tiến độ.</p>}
      </State>
      {admin && (
        <ActionForm
          label="Thêm mốc tiến độ"
          onSubmit={(data) =>
            post(`/projects/${projectId}/milestones`, {
              title: data.get("milestone_title"),
              description: data.get("milestone_description"),
              due_date: data.get("due_date") || null,
            })
          }
          onSuccess={query.reload}
        >
          <Field name="milestone_title" label="Tên mốc" />
          <Field name="milestone_description" label="Mô tả" required={false} />
          <Field
            name="due_date"
            label="Hạn hoàn thành"
            type="date"
            required={false}
          />
        </ActionForm>
      )}
    </section>
  );
}
