import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, X } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import {
  ActionForm,
  Field,
  Page,
  State,
  Pagination,
  Status,
  money,
} from "../../components/ui";
import { adminService } from "../../services";
import {
  PortfolioMediaField,
  uploadPortfolioMedia,
} from "../../components/PortfolioMediaField";
import {
  fieldValue,
  mediaFieldValue,
  schemas,
  type ResourceListRow,
  type ResourceRow,
} from "./admin-resource-schemas";

function projectSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)
    .replace(/-+$/g, "");
}

function validYouTubeUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    let id = "";
    if (["youtu.be", "www.youtu.be"].includes(host)) {
      id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
      ].includes(host)
    ) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
      else {
        const [, kind, videoId] = url.pathname.split("/");
        if (["shorts", "embed", "live"].includes(kind)) id = videoId ?? "";
      }
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id);
  } catch {
    return false;
  }
}

export function AdminContent({ resource }: { resource: string }) {
  return <ResourcePage resource={resource} />;
}
export function AdminEmployees() {
  return <ResourcePage resource="employees" />;
}
export function AdminServices() {
  return <ResourcePage resource="services" />;
}
export function AdminPortfolio() {
  return <ResourcePage resource="portfolio" />;
}
export function AdminTestimonials() {
  return <ResourcePage resource="testimonials" />;
}
function ResourcePage({ resource }: { resource: string }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNew = location.pathname.endsWith("/new");
  const schema = schemas[resource],
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<ResourceRow | null>(isNew ? {} : null);
  const detail = useApi<ResourceRow>(id ? `/admin/${resource}/${id}` : null);
  useEffect(() => {
    if (detail.data) setEditing(detail.data);
  }, [detail.data]);
  const query = useApi<{ items: ResourceListRow[]; total: number }>(
    `/admin/${resource}?page=${page}&search=${encodeURIComponent(search)}`,
  );
  return (
    <Page title={schema.title}>
      <p>Quản lý nội dung và thông tin trên nền tảng MediaHub.</p>
      {id && (
        <State query={detail}>
          <span />
        </State>
      )}
      <div className="toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Tìm kiếm"
            maxLength={100}
            placeholder="Tìm kiếm…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          <Plus size={17} /> Thêm mới
        </button>
      </div>
      {editing && (
        <section className="panel editor-panel">
          <div className="panel-head">
            <h2>{editing.id ? "Chỉnh sửa thông tin" : "Thêm mới"}</h2>
            <button
              className="icon-btn"
              aria-label="Đóng biểu mẫu"
              onClick={() => setEditing(null)}
            >
              <X />
            </button>
          </div>
          <ActionForm
            key={editing.id ?? "new"}
            onSubmit={async (data) => {
              const body: Record<string, unknown> = {};
              for (const f of schema.fields)
                body[f.name] =
                  f.type === "checkbox"
                    ? data.has(f.name)
                    : f.type === "number"
                      ? f.optional && !data.get(f.name)
                        ? null
                        : Number(data.get(f.name))
                      : [
                            "skills",
                            "features",
                            "deliverables",
                            "gallery",
                          ].includes(f.name)
                        ? String(data.get(f.name))
                            .split(f.name === "gallery" ? "\n" : ",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : String(data.get(f.name) ?? "");
              if (
                resource === "services" &&
                (!Number.isInteger(body.estimated_days) ||
                  Number(body.estimated_days) < 1)
              )
                throw new Error(
                  "Số ngày dự kiến phải là số nguyên từ 1 trở lên.",
                );
              if (resource === "portfolio") {
                body.slug = projectSlug(String(body.slug || body.title || ""));
                if (!validYouTubeUrl(String(body.video_url || "")))
                  throw new Error(
                    "Video phải là liên kết YouTube hoặc Shorts hợp lệ.",
                  );
                if (!body.slug)
                  throw new Error(
                    "Hãy nhập tên dự án để tạo đường dẫn hợp lệ.",
                  );
                if (editing.is_demo && body.published)
                  throw new Error(
                    "Đây là dữ liệu mẫu đã ẩn. Hãy tạo dự án mới bằng nội dung và ảnh thật.",
                  );
                const uploaded = await uploadPortfolioMedia(data, [
                  "image_url",
                  "gallery",
                ]);
                if (uploaded.image_url.length)
                  body.image_url = uploaded.image_url[0];
                body.gallery = [
                  ...(body.gallery as string[]),
                  ...uploaded.gallery,
                ];
              }
              return adminService.save(resource, editing.id, body);
            }}
            onSuccess={() => {
              setEditing(null);
              query.reload();
              if (id || isNew) navigate(`/admin/${resource}`);
            }}
          >
            {resource === "portfolio" && (
              <p>
                {editing.is_demo
                  ? "Dự án mẫu đã được ẩn khỏi website. Bạn có thể xem lại hoặc xóa; hãy tạo dự án mới cho nội dung thật."
                  : "Thêm ảnh bìa và thư viện từ máy tính, điền thông tin thật rồi chọn Công khai khi sẵn sàng."}
              </p>
            )}
            <div className="form-grid">
              {schema.fields.map((f) =>
                resource === "portfolio" &&
                ["image_url", "gallery"].includes(f.name) ? (
                  <PortfolioMediaField
                    key={f.name}
                    name={f.name}
                    label={
                      f.name === "image_url" ? "Ảnh bìa dự án" : "Thư viện ảnh"
                    }
                    value={mediaFieldValue(editing[f.name])}
                    multiple={f.name === "gallery"}
                  />
                ) : f.type === "checkbox" ? (
                  <label className="checkbox-field" key={f.name}>
                    <input
                      type="checkbox"
                      name={f.name}
                      defaultChecked={Boolean(
                        editing[f.name] ?? f.name === "active",
                      )}
                    />
                    {f.label}
                  </label>
                ) : f.options ? (
                  <label className="field" key={f.name}>
                    {f.label}
                    <select
                      name={f.name}
                      defaultValue={String(editing[f.name] ?? f.options[0])}
                    >
                      {f.options.map((v) => (
                        <option key={v} value={v}>
                          {
                            (
                              {
                                ACTIVE: "Hoạt động",
                                INACTIVE: "Ngừng hoạt động",
                                PENDING: "Chờ duyệt",
                                APPROVED: "Đã duyệt",
                                REJECTED: "Từ chối",
                              } as Record<string, string>
                            )[v]
                          }
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <Field
                    key={f.name}
                    name={f.name}
                    label={f.label}
                    type={f.type}
                    required={!f.optional}
                    value={fieldValue(
                      editing[f.name],
                      f.name === "gallery" ? "\n" : ", ",
                    )}
                  />
                ),
              )}
            </div>
          </ActionForm>
        </section>
      )}
      <State query={query}>
        <div className="resource-grid">
          {query.data?.items.map((row) => (
            <article className="panel resource-card" key={row.id}>
              {(row.image_url || row.thumbnail_url) && (
                <img
                  src={row.image_url || row.thumbnail_url}
                  alt={row.title || row.name}
                  loading="lazy"
                />
              )}
              <span className="eyebrow">
                {row.category || row.department || "MEDIAHUB"}
              </span>
              <h2>{row.name || row.title || "Đánh giá khách hàng"}</h2>
              <p>{row.description || row.content || row.position}</p>
              {row.email && <p>{row.email}</p>}
              {row.starting_price !== undefined && (
                <h3>
                  {money(row.starting_price)} <small>/ từ</small>
                </h3>
              )}
              {row.client && <p>Khách hàng: {row.client}</p>}
              <Status
                value={
                  row.status ||
                  (row.is_demo ? "Dữ liệu mẫu · Đã ẩn" : "") ||
                  (row.active !== undefined
                    ? row.active
                      ? "ACTIVE"
                      : "INACTIVE"
                    : row.published
                      ? "Đã công khai"
                      : "Bản nháp")
                }
              />
              <div className="toolbar">
                <button
                  className="btn btn-ghost"
                  onClick={() => setEditing(row)}
                >
                  <Pencil size={15} /> Chỉnh sửa
                </button>
                <ActionForm
                  label="Xóa"
                  onSubmit={() => {
                    if (
                      !window.confirm(
                        "Xóa mục này? Thao tác không thể hoàn tác.",
                      )
                    )
                      throw new Error("Chưa xóa mục này.");
                    return adminService.remove(resource, row.id);
                  }}
                  onSuccess={query.reload}
                />
              </div>
            </article>
          ))}
        </div>
        {!query.data?.items.length && (
          <div className="empty-state">
            Chưa có dữ liệu phù hợp. Bạn có thể thêm mới hoặc thay đổi từ khóa.
          </div>
        )}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </Page>
  );
}
