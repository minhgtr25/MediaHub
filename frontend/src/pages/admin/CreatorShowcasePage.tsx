import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../services/api";
import { ActionForm, Page, Pagination, State } from "../../components/ui";
import type { CreatorOption } from "../public/creator-profile.types";
import {
  PortfolioMediaField,
  uploadPortfolioMedia,
} from "../../components/PortfolioMediaField";

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

function ShowcaseField({
  name,
  label,
  profile,
}: {
  name: keyof Showcase;
  label: string;
  profile: Showcase;
}) {
  const value = profile[name];
  const initialValue = Array.isArray(value) ? value.join(", ") : value;
  if (name === "bio") {
    return (
      <label className="field">
        {label}
        <textarea
          name="bio"
          defaultValue={String(value ?? "")}
          maxLength={5000}
          rows={5}
        />
        <small>Ít nhất 30 ký tự để công khai; tối đa 5.000 ký tự.</small>
      </label>
    );
  }
  return (
    <label className="field">
      {label}
      <input
        name={String(name)}
        defaultValue={initialValue as string | number | undefined}
        required={["display_name", "slug", "title"].includes(String(name))}
        type={name === "price_from" ? "number" : "text"}
        min={name === "price_from" ? 0 : undefined}
        max={name === "price_from" ? 1_000_000_000_000 : undefined}
        step={name === "price_from" ? 1 : undefined}
        list={name === "price_from" ? "creator-price-options" : undefined}
        maxLength={
          name === "display_name"
            ? 150
            : name === "title"
              ? 200
              : name === "university" || name === "major"
                ? 200
                : name === "tools"
                  ? 1829
                  : name === "languages"
                    ? 1019
                    : undefined
        }
        minLength={name === "display_name" || name === "title" ? 2 : undefined}
        pattern={name === "slug" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined}
      />
      <small>
        {name === "price_from"
          ? "Đơn vị VNĐ; gợi ý các mức giống bộ lọc công khai."
          : name === "tools" || name === "languages"
            ? "Phân cách bằng dấu phẩy; mỗi mục được kiểm tra riêng."
            : name === "slug"
              ? "Chữ thường không dấu, số và dấu gạch ngang; ví dụ: minh-anh."
              : undefined}
      </small>
    </label>
  );
}

function splitTags(
  value: string,
  label: string,
  maxItems: number,
  maxLength: number,
) {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length > maxItems)
    throw new Error(`${label}: tối đa ${maxItems} mục.`);
  if (items.some((item) => item.length > maxLength))
    throw new Error(`${label}: mỗi mục tối đa ${maxLength} ký tự.`);
  if (
    new Set(items.map((item) => item.toLocaleLowerCase())).size !== items.length
  )
    throw new Error(`${label}: không nhập mục trùng nhau.`);
  return items;
}

function validateShowcaseForm(data: FormData, locations: string[]) {
  const get = (name: string) => String(data.get(name) ?? "").trim();
  const display_name = get("display_name");
  const slug = get("slug");
  const title = get("title");
  const bio = String(data.get("bio") ?? "").trim();
  const location = get("location");
  const university = get("university");
  const major = get("major");
  if (display_name.length < 2 || display_name.length > 150)
    throw new Error("Tên Creator phải từ 2 đến 150 ký tự.");
  if (
    slug.length < 3 ||
    slug.length > 80 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  )
    throw new Error(
      "Đường dẫn phải dài 3–80 ký tự, chỉ gồm chữ thường không dấu, số và dấu gạch ngang.",
    );
  if (title.length < 2 || title.length > 200)
    throw new Error("Chức danh phải từ 2 đến 200 ký tự.");
  if (bio.length > 5000) throw new Error("Giới thiệu tối đa 5.000 ký tự.");
  if (location.length > 100 || university.length > 200 || major.length > 200)
    throw new Error(
      "Khu vực tối đa 100 ký tự; trường học và chuyên ngành tối đa 200 ký tự.",
    );
  if (!locations.includes(location))
    throw new Error(
      "Hãy chọn một tỉnh, thành phố hoặc Remote toàn quốc từ danh sách.",
    );
  const priceText = get("price_from");
  if (
    priceText &&
    (!/^\d+$/.test(priceText) || Number(priceText) > 1_000_000_000_000)
  )
    throw new Error(
      "Giá tham khảo phải là số nguyên từ 0 đến 1.000.000.000.000 VNĐ.",
    );
  const category_ids = data.getAll("category_ids").map(String);
  const skill_ids = data.getAll("skill_ids").map(String);
  if (
    new Set(category_ids).size !== category_ids.length ||
    category_ids.length > 10 ||
    new Set(skill_ids).size !== skill_ids.length ||
    skill_ids.length > 30
  )
    throw new Error("Không chọn trùng; tối đa 10 chuyên môn và 30 kỹ năng.");
  const published = data.has("published");
  const featured = data.has("featured");
  if (
    published &&
    (bio.length < 30 || category_ids.length === 0 || skill_ids.length === 0)
  )
    throw new Error(
      "Để công khai, cần giới thiệu ít nhất 30 ký tự, tối thiểu 1 chuyên môn và 1 kỹ năng.",
    );
  if (featured && !published)
    throw new Error("Chỉ hồ sơ công khai mới có thể đặt nổi bật.");
  const experience_level = get("experience_level");
  if (
    !["STUDENT", "JUNIOR", "MID", "SENIOR", "LEAD"].includes(experience_level)
  )
    throw new Error("Vui lòng chọn cấp độ hợp lệ.");
  return {
    display_name,
    slug,
    title,
    bio,
    location,
    university,
    major,
    experience_level,
    price_from: priceText ? Number(priceText) : null,
    tools: splitTags(get("tools"), "Công cụ", 30, 60),
    languages: splitTags(get("languages"), "Ngôn ngữ", 20, 50),
    category_ids,
    skill_ids,
    featured,
    is_demo: data.has("is_demo"),
    published,
  };
}

export function CreatorShowcasePage() {
  const [page, setPage] = useState(1),
    [editing, setEditing] = useState<Showcase | null>(null);
  const list = useApi<{ items: Showcase[]; total: number }>(
    `/admin/creator-showcase?page=${page}&search=`,
  );
  const options = useApi<{
    categories: CreatorOption[];
    skills: CreatorOption[];
    locations: string[];
    price_options: { value: number; label: string }[];
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
              const validated = validateShowcaseForm(
                data,
                options.data?.locations ?? [],
              );
              const uploaded = await uploadPortfolioMedia(data, [
                "avatar_url",
                "cover_url",
              ]);
              const payload = {
                ...validated,
                avatar_url: data.has("avatar_url_remove")
                  ? ""
                  : uploaded.avatar_url[0] || editing.avatar_url || "",
                cover_url: data.has("cover_url_remove")
                  ? ""
                  : uploaded.cover_url[0] || editing.cover_url || "",
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
            <div className="creator-showcase-form">
              <section className="creator-showcase-section">
                <h3>Thông tin cơ bản</h3>
                <div className="creator-showcase-fields">
                  {fields
                    .filter(([name]) =>
                      ["display_name", "slug", "title", "bio"].includes(
                        String(name),
                      ),
                    )
                    .map(([name, label]) => (
                      <ShowcaseField
                        key={name}
                        name={name}
                        label={label}
                        profile={editing}
                      />
                    ))}
                </div>
              </section>
              <section className="creator-showcase-section">
                <h3>Địa điểm và cấp độ</h3>
                <div className="creator-showcase-fields">
                  <label className="field">
                    Tỉnh / thành phố
                    <select
                      name="location"
                      defaultValue={editing.location}
                      required
                      disabled={!options.data?.locations.length}
                    >
                      <option value="">Chọn tỉnh / thành phố</option>
                      {options.data?.locations.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <small>
                      Dùng cùng danh sách với bộ lọc Creator công khai.
                    </small>
                  </label>
                  <label className="field">
                    Cấp độ
                    <select
                      name="experience_level"
                      defaultValue={editing.experience_level}
                      required
                    >
                      <option value="STUDENT">Sinh viên</option>
                      <option value="JUNIOR">Junior</option>
                      <option value="MID">Middle</option>
                      <option value="SENIOR">Senior</option>
                      <option value="LEAD">Lead</option>
                    </select>
                  </label>
                  {fields
                    .filter(([name]) =>
                      ["university", "major"].includes(String(name)),
                    )
                    .map(([name, label]) => (
                      <ShowcaseField
                        key={name}
                        name={name}
                        label={label}
                        profile={editing}
                      />
                    ))}
                </div>
              </section>
              <section className="creator-showcase-section">
                <h3>Ảnh hồ sơ</h3>
                <div className="creator-showcase-fields">
                  <PortfolioMediaField
                    name="avatar_url"
                    label="Ảnh đại diện"
                    value={editing.avatar_url}
                    hideUrl
                    allowClear
                  />
                  <PortfolioMediaField
                    name="cover_url"
                    label="Ảnh bìa"
                    value={editing.cover_url}
                    hideUrl
                    allowClear
                  />
                </div>
              </section>
              <section className="creator-showcase-section">
                <h3>Giá và năng lực</h3>
                <div className="creator-showcase-fields">
                  {fields
                    .filter(([name]) =>
                      ["price_from", "tools", "languages"].includes(
                        String(name),
                      ),
                    )
                    .map(([name, label]) => (
                      <ShowcaseField
                        key={name}
                        name={name}
                        label={label}
                        profile={editing}
                      />
                    ))}
                  <datalist id="creator-price-options">
                    {options.data?.price_options.map((item) => (
                      <option
                        key={item.value}
                        value={item.value}
                        label={item.label}
                      />
                    ))}
                  </datalist>
                </div>
              </section>
              <section className="creator-showcase-section">
                <h3>Chuyên môn và kỹ năng</h3>
                <div className="creator-showcase-picks">
                  {(
                    [
                      [
                        "Chuyên môn",
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
                    <fieldset className="creator-showcase-pick" key={name}>
                      <legend>{label}</legend>
                      {items.length ? (
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
                      ) : (
                        <p className="muted">Chưa có lựa chọn khả dụng.</p>
                      )}
                    </fieldset>
                  ))}
                </div>
              </section>
              <section className="creator-showcase-section">
                <h3>Trạng thái hồ sơ</h3>
                <div className="creator-showcase-status">
                  <label className="creator-showcase-check">
                    <input
                      type="checkbox"
                      name="published"
                      defaultChecked={editing.published}
                    />
                    Công khai
                  </label>
                  <label className="creator-showcase-check">
                    <input
                      type="checkbox"
                      name="featured"
                      defaultChecked={editing.featured}
                    />
                    Nổi bật
                  </label>
                  <label className="creator-showcase-check">
                    <input
                      type="checkbox"
                      name="is_demo"
                      defaultChecked={editing.is_demo}
                    />
                    Dữ liệu minh họa
                  </label>
                </div>
                <small>
                  Hồ sơ công khai cần có giới thiệu đủ dài, chuyên môn và ít
                  nhất một kỹ năng.
                </small>
              </section>
            </div>{" "}
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
