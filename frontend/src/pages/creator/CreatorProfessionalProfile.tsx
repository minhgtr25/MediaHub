import { useState } from "react";
import { Link } from "react-router-dom";
import { ActionForm, Field, State } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { post } from "../../services/api";
import { ProfileImageUpload, PortfolioEditor } from "./CreatorPortfolioEditor";
import type { CreatorPortfolioItem } from "./CreatorPortfolioEditor";
type Option = { id: string; name: string };

type Profile = {
  id: string;
  slug: string;
  display_name: string;
  title: string;
  bio: string;
  location: string;
  university: string | null;
  major: string | null;
  experience_level: string;
  availability: string;
  tools: string[];
  languages: string[];
  skill_ids: string[];
  category_ids: string[];
  cover_url: string | null;
};
type Data = {
  profile: Profile;
  portfolio: CreatorPortfolioItem[];
  public: {
    rating: number | null;
    review_count: number;
    completed_projects: number;
    availability: string;
  } | null;
};
const availability: Record<string, string> = {
  AVAILABLE: "Sẵn sàng nhận việc",
  LIMITED: "Cần trao đổi lịch",
  BUSY: "Đang nhận việc hoặc giữ chỗ",
  UNAVAILABLE: "Tạm ngừng nhận việc",
};
const split = (value: FormDataEntryValue | null) =>
  String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
export function CreatorProfessionalProfile() {
  const q = useApi<Data>("/creator/profile"),
    [editOpened, setEditOpened] = useState(false),
    options = useApi<{ skills: Option[]; categories: Option[] }>(
      editOpened ? "/public/creators/filters" : null,
    ),
    [newVersion, setNewVersion] = useState(0);
  return (
    <section className="panel">
      <header>
        <h2>Hồ sơ nghề nghiệp Creator</h2>
        <button
          className="btn btn-ghost"
          disabled={q.loading}
          onClick={q.reload}
        >
          Làm mới hồ sơ
        </button>
      </header>
      <State query={q}>
        {q.data && (
          <>
            {q.data.public ? (
              <Link
                to={`/creators/${q.data.profile.slug}`}
                className="btn btn-ghost"
              >
                Xem hồ sơ công khai
              </Link>
            ) : (
              <p>
                Hồ sơ này chưa được công khai. Liên hệ Admin để kiểm tra thông
                tin thật và trạng thái hồ sơ.
              </p>
            )}
            <p>
              Trạng thái nhận việc:{" "}
              {
                availability[
                  q.data.public?.availability || q.data.profile.availability
                ]
              }
              . Lịch phân công và giữ chỗ do hệ thống kiểm tra; bạn có thể tạm
              ngừng nhận việc mới.
            </p>
            <p>
              {q.data.public?.review_count
                ? `${q.data.public?.rating}/5 từ ${q.data.public?.review_count} đánh giá đã xác minh`
                : "Chưa có đánh giá đã xác minh"}{" "}
              · {q.data.public?.completed_projects ?? 0} dự án đã bàn giao trên
              hệ thống.
            </p>
            <details
              onToggle={(e) => {
                if (e.currentTarget.open) setEditOpened(true);
              }}
            >
              <summary>Chỉnh giới thiệu và chuyên môn</summary>
              <State query={options}>
                {options.data && (
                  <ActionForm
                    label="Lưu hồ sơ nghề nghiệp"
                    onSubmit={(f) =>
                      post("/creator/profile/save", {
                        display_name: f.get("display_name"),
                        title: f.get("title"),
                        bio: f.get("bio"),
                        location: f.get("location"),
                        university: f.get("university"),
                        major: f.get("major"),
                        experience_level: f.get("experience_level"),
                        availability: f.get("availability"),
                        tools: split(f.get("tools")),
                        languages: split(f.get("languages")),
                        skill_ids: f.getAll("skill_ids"),
                        category_ids: f.getAll("category_ids"),
                      })
                    }
                    onSuccess={q.reload}
                  >
                    <Field
                      name="display_name"
                      label="Tên hiển thị công khai"
                      maxLength={150}
                      value={q.data.profile.display_name}
                    />
                    <Field
                      name="title"
                      label="Chức danh/chuyên môn chính"
                      maxLength={200}
                      value={q.data.profile.title}
                    />
                    <Field
                      name="bio"
                      label="Giới thiệu năng lực (công khai)"
                      type="textarea"
                      required={false}
                      value={q.data.profile.bio}
                    />
                    <Field
                      name="location"
                      label="Khu vực làm việc"
                      maxLength={100}
                      required={false}
                      value={q.data.profile.location}
                    />
                    <label className="field">
                      Cấp độ kinh nghiệm
                      <select
                        required
                        name="experience_level"
                        defaultValue={q.data.profile.experience_level}
                      >
                        {["STUDENT", "JUNIOR", "MID", "SENIOR", "LEAD"].map(
                          (v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="field">
                      Lựa chọn nhận việc mới
                      <select
                        name="availability"
                        defaultValue={
                          q.data.profile.availability === "BUSY"
                            ? "AVAILABLE"
                            : q.data.profile.availability
                        }
                      >
                        {["AVAILABLE", "LIMITED", "UNAVAILABLE"].map((v) => (
                          <option key={v} value={v}>
                            {availability[v]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      name="tools"
                      label="Công cụ sử dụng (ngăn cách bằng dấu phẩy, tối đa 20)"
                      required={false}
                      value={q.data.profile.tools.join(", ")}
                    />
                    <Field
                      name="languages"
                      label="Ngôn ngữ (ngăn cách bằng dấu phẩy, tối đa 10)"
                      value={q.data.profile.languages.join(", ")}
                    />
                    <Field
                      name="university"
                      label="Trường học (không bắt buộc)"
                      maxLength={200}
                      required={false}
                      value={q.data.profile.university || ""}
                    />
                    <Field
                      name="major"
                      label="Ngành học (không bắt buộc)"
                      maxLength={200}
                      required={false}
                      value={q.data.profile.major || ""}
                    />
                    <fieldset>
                      <legend>Nhóm chuyên môn (tối đa 10)</legend>
                      <div className="skill-chips">
                        {options.data.categories.map((o) => (
                          <label className="checkbox-field" key={o.id}>
                            <input
                              type="checkbox"
                              name="category_ids"
                              value={o.id}
                              defaultChecked={q.data!.profile.category_ids.includes(
                                o.id,
                              )}
                            />
                            {o.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend>Kỹ năng (tối đa 30)</legend>
                      <div className="skill-chips">
                        {options.data.skills.map((o) => (
                          <label className="checkbox-field" key={o.id}>
                            <input
                              type="checkbox"
                              name="skill_ids"
                              value={o.id}
                              defaultChecked={q.data!.profile.skill_ids.includes(
                                o.id,
                              )}
                            />
                            {o.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <p className="muted">
                      Xác minh, đề xuất nổi bật và chi phí tham khảo do công ty
                      quản lý. Đánh giá được tính từ dự án đã hoàn thành.
                    </p>
                  </ActionForm>
                )}
              </State>
            </details>
            <details>
              <summary>Cập nhật ảnh bìa</summary>
              {q.data.profile.cover_url && (
                <img
                  src={q.data.profile.cover_url}
                  alt="Ảnh bìa hiện tại"
                  className="profile-cover-preview"
                />
              )}
              <ProfileImageUpload kind="cover" onUploaded={q.reload} />
            </details>
            <h3>Portfolio công khai của bạn</h3>
            <p>
              Chỉ đăng sản phẩm bạn có quyền công khai. File nghiệm thu/bàn giao
              của Customer không được tự động đưa lên đây.
            </p>
            <details>
              <summary>Thêm portfolio</summary>
              <PortfolioEditor
                key={newVersion}
                onChanged={() => {
                  setNewVersion((v) => v + 1);
                  q.reload();
                }}
              />
            </details>
            {q.data.portfolio.map((item) => (
              <article className="quote-version" key={item.id}>
                {item.thumbnail_url && (
                  <img
                    className="profile-portfolio-preview"
                    src={item.thumbnail_url}
                    alt={item.title}
                    loading="lazy"
                  />
                )}
                <h4>{item.title}</h4>
                <p>{item.description}</p>
                <details>
                  <summary>Chỉnh portfolio</summary>
                  <PortfolioEditor item={item} onChanged={q.reload} />
                </details>
                <details>
                  <summary>Xóa khỏi hồ sơ công khai</summary>
                  <ActionForm
                    label="Xóa portfolio này"
                    onSubmit={(f) => {
                      if (f.get("confirmed") !== "on")
                        throw new Error(
                          "Cần xác nhận xóa khỏi hồ sơ công khai.",
                        );
                      return post("/creator/profile/portfolio_delete", {
                        id: item.id,
                      });
                    }}
                    onSuccess={q.reload}
                  >
                    <label className="checkbox-field">
                      <input required name="confirmed" type="checkbox" />
                      Tôi xác nhận xóa portfolio này khỏi hồ sơ công khai.
                    </label>
                  </ActionForm>
                </details>
              </article>
            ))}
            {!q.data.portfolio.length && (
              <p>
                Chưa có portfolio. Bạn có thể thêm sản phẩm và ảnh minh họa tại
                đây.
              </p>
            )}
          </>
        )}
      </State>
    </section>
  );
}
