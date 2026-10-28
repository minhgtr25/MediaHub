import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../services/api";
import { ActionForm, Page, Pagination, State } from "../../components/ui";
import type { CreatorOption } from "../public/creator-profile.types";

type Showcase = {
  id: string;
  slug: string;
  display_name: string;
  title: string;
  bio: string;
  avatar_url?: string;
  cover_url?: string;
  location: string;
  university?: string;
  major?: string;
  experience_level: string;
  tools: string[];
  languages: string[];
  price_from?: number;
  featured: boolean;
  is_demo: boolean;
  published: boolean;
  category_ids: string[];
  skill_ids: string[];
};
const blank: Showcase = {
  id: "",
  slug: "",
  display_name: "",
  title: "",
  bio: "",
  location: "",
  experience_level: "STUDENT",
  tools: [],
  languages: [],
  featured: false,
  is_demo: false,
  published: false,
  category_ids: [],
  skill_ids: [],
};
const fields: [keyof Showcase, string][] = [
  ["display_name", "Tên hiển thị"],
  ["slug", "Đường dẫn (chữ thường, dấu gạch ngang)"],
  ["title", "Chức danh"],
  ["bio", "Giới thiệu"],
  ["avatar_url", "URL ảnh đại diện"],
  ["cover_url", "URL ảnh bìa"],
  ["location", "Khu vực"],
  ["university", "Trường học"],
  ["major", "Chuyên ngành"],
  ["price_from", "Giá tham khảo từ (VNĐ)"],
  ["tools", "Công cụ, cách nhau bằng dấu phẩy"],
  ["languages", "Ngôn ngữ, cách nhau bằng dấu phẩy"],
];
export function CreatorShowcasePage() {
  const [page, setPage] = useState(1),
    [editing, setEditing] = useState<Showcase | null>(null);
  const list = useApi<{ items: Showcase[]; total: number }>(
    `/admin/creator-showcase?page=${page}&search=`,
  );
  const options = useApi<{
    categories: CreatorOption[];
    skills: CreatorOption[];
  }>("/public/creators/filters");
  return (
    <Page title="Creator giới thiệu">
      <p>
        Hồ sơ do Admin biên tập để giới thiệu trên website. Đây không phải tài
        khoản đã ký hợp tác và không thể được chọn để nhận việc.
      </p>
      <div className="toolbar">
        <button
          className="btn btn-primary"
          onClick={() => setEditing({ ...blank })}
        >
          <Plus size={17} /> Thêm Creator
        </button>
      </div>
      {editing && (
        <section className="panel editor-panel">
          <div className="panel-head">
            <h2>{editing.id ? "Sửa hồ sơ" : "Tạo hồ sơ Creator"}</h2>
            <button
              className="icon-btn"
              onClick={() => setEditing(null)}
              aria-label="Đóng"
            >
              <X />
            </button>
          </div>
          <ActionForm
            key={editing.id || "new"}
            onSubmit={async (data) => {
              const get = (n: string) => String(data.get(n) || "");
              const payload = {
                ...editing,
                display_name: get("display_name").trim(),
                slug: get("slug").trim(),
                title: get("title").trim(),
                bio: get("bio"),
                avatar_url: get("avatar_url"),
                cover_url: get("cover_url"),
                location: get("location"),
                university: get("university"),
                major: get("major"),
                experience_level: get("experience_level"),
                price_from: get("price_from") || null,
                tools: get("tools")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                languages: get("languages")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                category_ids: data.getAll("category_ids"),
                skill_ids: data.getAll("skill_ids"),
                featured: data.has("featured"),
                is_demo: data.has("is_demo"),
                published: data.has("published"),
              };
              return api(
                `/admin/creator-showcase${editing.id ? `/${editing.id}` : ""}`,
                {
                  method: editing.id ? "PATCH" : "POST",
                  body: JSON.stringify(payload),
                },
              );
            }}
            onSuccess={() => {
              setEditing(null);
              list.reload();
            }}
          >
            <div className="form-grid">
              {fields.map(([name, label]) => (
                <label className="field" key={name}>
                  {label}
                  <input
                    name={String(name)}
                    defaultValue={editing[name] as string | number | undefined}
                    required={["display_name", "slug", "title"].includes(
                      String(name),
                    )}
                    type={name === "price_from" ? "number" : "text"}
                  />
                </label>
              ))}
              <label className="field">
                Cấp độ
                <select
                  name="experience_level"
                  defaultValue={editing.experience_level}
                >
                  <option value="STUDENT">Sinh viên</option>
                  <option value="JUNIOR">Junior</option>
                  <option value="MID">Middle</option>
                  <option value="SENIOR">Senior</option>
                  <option value="LEAD">Lead</option>
                </select>
              </label>
              {(
                [
                  [
                    "categories",
                    options.data?.categories ?? [],
                    editing.category_ids,
                    "category_ids",
                  ],
                  [
                    "Kỹ năng",
                    options.data?.skills ?? [],
                    editing.skill_ids,
                    "skill_ids",
                  ],
                ] as const
              ).map(([label, items, selected, name]) => (
                <fieldset className="field" key={name}>
                  <legend>{label}</legend>
                  <div className="creator-option-list">
                    {items.map((item) => (
                      <label key={item.id}>
                        <input
                          type="checkbox"
                          name={name}
                          value={item.id}
                          defaultChecked={selected.includes(item.id)}
                        />
                        {item.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={editing.featured}
                />
                Nổi bật
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  name="is_demo"
                  defaultChecked={editing.is_demo}
                />
                Dữ liệu minh họa (hiện nhãn công khai)
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  name="published"
                  defaultChecked={editing.published}
                />
                Công khai
              </label>
            </div>
          </ActionForm>
        </section>
      )}
      <State query={list}>
        <div className="resource-grid">
          {list.data?.items.map((item) => (
            <article className="panel resource-card" key={item.id}>
              {item.avatar_url && <img src={item.avatar_url} alt="" />}
              <span className="eyebrow">
                {item.is_demo ? "DỮ LIỆU MINH HỌA" : "HỒ SƠ GIỚI THIỆU"}
              </span>
              <h2>{item.display_name}</h2>
              <p>
                {item.title} · {item.location}
              </p>
              <p>{item.published ? "Đang công khai" : "Bản nháp"}</p>
              <div className="toolbar">
                <button
                  className="btn btn-ghost"
                  onClick={async () =>
                    setEditing(
                      await api<Showcase>(`/admin/creator-showcase/${item.id}`),
                    )
                  }
                >
                  <Pencil size={15} /> Sửa
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    if (confirm("Xóa hồ sơ Creator này?")) {
                      await api(`/admin/creator-showcase/${item.id}`, {
                        method: "DELETE",
                      });
                      list.reload();
                    }
                  }}
                >
                  <Trash2 size={15} /> Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
        <Pagination
          page={page}
          total={list.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </Page>
  );
}
