import {
  ActionForm,
  Field,
  State,
  Page,
  Pagination,
} from "../../components/ui";
import { patch, api } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useState } from "react";
type Project = {
  id: string;
  title: string;
  description: string;
  scope: string;
  progress: number;
  deadline: string | null;
};
export function EditProject({
  project,
  reload,
}: {
  project: Project;
  reload: () => void;
}) {
  return (
    <section className="panel">
      <h2>Thông tin và phạm vi</h2>
      <ActionForm
        onSubmit={(data) =>
          patch(`/admin/projects/${project.id}`, {
            title: data.get("project_title"),
            description: data.get("project_description"),
            scope: data.get("scope"),
            progress: Number(data.get("progress")),
            deadline: data.get("project_deadline") || null,
          })
        }
        onSuccess={reload}
      >
        <Field name="project_title" label="Tên dự án" value={project.title} />
        <Field
          name="project_description"
          label="Mô tả"
          type="textarea"
          value={project.description}
        />
        <Field
          name="scope"
          label="Phạm vi công việc"
          type="textarea"
          value={project.scope}
          required={false}
        />
        <label className="field">
          Tiến độ (%)
          <input
            name="progress"
            type="number"
            min="0"
            max="100"
            step="1"
            required
            defaultValue={project.progress}
          />
        </label>
        <Field
          name="project_deadline"
          label="Hạn hoàn thành"
          type="date"
          value={project.deadline ?? ""}
          required={false}
        />
      </ActionForm>
    </section>
  );
}
type FileRow = {
  id: string;
  project_id: string;
  file_name?: string;
  name?: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
};
export function AdminFiles() {
  const [kind, setKind] = useState("files");
  const [page, setPage] = useState(1);
  const query = useApi<{ items: FileRow[]; total: number }>(
    `/admin/files?kind=${kind}&page=${page}`,
  );
  return (
    <Page title="Quản lý tệp">
      <select
        aria-label="Loại tệp"
        value={kind}
        onChange={(event) => {
          setKind(event.target.value);
          setPage(1);
        }}
      >
        <option value="files">Tài liệu dự án</option>
        <option value="deliverables">Sản phẩm bàn giao</option>
      </select>
      <State query={query}>
        <div className="resource-grid">
          {query.data?.items.map((file) => (
            <article className="panel" key={file.id}>
              <h2>{file.file_name ?? file.name}</h2>
              <p>{file.file_type}</p>
              {file.file_size && <p>{Math.ceil(file.file_size / 1024)} KB</p>}
              <p>{new Date(file.created_at).toLocaleString("vi-VN")}</p>
              <ActionForm
                label="Tải xuống"
                onSubmit={async () => {
                  const data = await api<{ signedUrl: string }>(
                    `/projects/${file.project_id}/download/${kind}/${file.id}`,
                  );
                  window.location.assign(data.signedUrl);
                }}
              />
            </article>
          ))}
        </div>
        {!query.data?.items.length && <p>Chưa có tệp.</p>}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </Page>
  );
}
