import { useState } from "react";
import { ActionForm, Field } from "./ui";
import {
  PortfolioMediaField,
  uploadPortfolioMedia,
} from "./PortfolioMediaField";
import { post } from "../services/api";

export function CreateCreatorProfile({ onCreated }: { onCreated: () => void }) {
  const [version, setVersion] = useState(0);
  return (
    <section className="panel">
      <h2>Thêm hồ sơ Creator thật</h2>
      <p>
        Nhập thông tin và ảnh thật. Sau khi tạo, dùng mã hồ sơ bên dưới để liên
        kết tài khoản và hợp đồng hợp tác. Hồ sơ chỉ xuất hiện công khai khi tài
        khoản Creator hoạt động và đã có hợp đồng.
      </p>
      <ActionForm
        key={version}
        label="Tạo hồ sơ Creator"
        onSubmit={async (form) => {
          if (!form.has("content_confirmed"))
            throw new Error("Cần xác nhận thông tin và quyền sử dụng ảnh.");
          const uploaded = await uploadPortfolioMedia(form, [
            "avatar_url",
            "cover_url",
          ]);
          return post("/admin/creators/profile", {
            slug: form.get("slug"),
            display_name: form.get("display_name"),
            title: form.get("title"),
            bio: form.get("bio"),
            location: form.get("location"),
            avatar_url: uploaded.avatar_url[0] || form.get("avatar_url") || "",
            cover_url: uploaded.cover_url[0] || form.get("cover_url") || "",
            content_confirmed: true,
          });
        }}
        onSuccess={() => {
          setVersion((v) => v + 1);
          onCreated();
        }}
      >
        <div className="form-grid">
          <Field name="display_name" label="Tên Creator" maxLength={150} />
          <Field name="title" label="Chuyên môn / chức danh" maxLength={200} />
          <label className="field">
            Đường dẫn hồ sơ (chữ thường không dấu, ví dụ: nguyen-minh-an)
            <input
              name="slug"
              required
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </label>
          <Field
            name="location"
            label="Khu vực làm việc"
            required={false}
            maxLength={100}
          />
          <Field
            name="bio"
            label="Giới thiệu năng lực thật"
            type="textarea"
            required={false}
          />
          <PortfolioMediaField name="avatar_url" label="Ảnh đại diện" />
          <PortfolioMediaField name="cover_url" label="Ảnh bìa" />
        </div>
        <label className="checkbox-field">
          <input type="checkbox" name="content_confirmed" required />
          Tôi đã kiểm tra thông tin Creator thật và có quyền công khai nội dung,
          hình ảnh này.
        </label>
      </ActionForm>
    </section>
  );
}
