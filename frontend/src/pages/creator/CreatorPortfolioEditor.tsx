import { useState } from "react";
import { useIdempotencyKey } from "../../hooks/useIdempotencyKey";
import { ActionForm, Field } from "../../components/ui";
import { api, post } from "../../services/api";

export type CreatorPortfolioItem = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  category: string;
  client: string;
  project_year: number | null;
  project_url: string | null;
};

export function ProfileImageUpload({
  kind,
  onUploaded,
}: {
  kind: "cover" | "portfolio";
  onUploaded: (url: string) => void;
}) {
  return (
    <ActionForm
      label={kind === "cover" ? "Tải ảnh bìa" : "Tải ảnh portfolio"}
      onSubmit={async (f) => {
        const file = f.get("file");
        if (!(file instanceof File) || !file.size)
          throw new Error("Chọn ảnh cần tải lên.");
        if (file.size > 5 * 1024 * 1024) throw new Error("Ảnh tối đa 5 MB.");
        const body = new FormData();
        body.append("file", file);
        body.append("kind", kind);
        body.append(
          "rights_confirmed",
          f.get("rights_confirmed") === "on" ? "true" : "false",
        );
        const result = await api<{ image_url: string }>(
          "/creator/profile/images",
          { method: "POST", body },
        );
        onUploaded(result.image_url);
      }}
    >
      <label className="field">
        Ảnh JPG, PNG hoặc WEBP, tối đa 5 MB
        <input
          required
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
        />
      </label>
      <label className="checkbox-field">
        <input required type="checkbox" name="rights_confirmed" />
        Ảnh được lưu công khai. Tôi có quyền đăng ảnh và đã kiểm tra thông tin
        cá nhân trong ảnh.
      </label>
    </ActionForm>
  );
}
export function PortfolioEditor({
  item,
  onChanged,
}: {
  item?: CreatorPortfolioItem;
  onChanged: () => void;
}) {
  const [image, setImage] = useState(""),
    intent = useIdempotencyKey();
  return (
    <div>
      <ProfileImageUpload kind="portfolio" onUploaded={setImage} />
      {image && (
        <img
          className="profile-portfolio-preview"
          src={image}
          alt="Ảnh portfolio vừa tải"
        />
      )}
      <ActionForm
        label={item ? "Lưu portfolio" : "Đăng portfolio"}
        onSubmit={(f) => {
          const input = {
            ...(item ? { id: item.id } : {}),
            title: f.get("title"),
            description: f.get("description"),
            category: f.get("category"),
            client: f.get("client"),
            ...(f.get("project_year")
              ? { project_year: Number(f.get("project_year")) }
              : {}),
            ...(f.get("project_url")
              ? { project_url: f.get("project_url") }
              : {}),
            ...(image ? { image_url: image } : {}),
            rights_confirmed: f.get("rights_confirmed") === "on",
          };
          return post("/creator/profile/portfolio_save", {
            ...input,
            idempotency_key: intent(input),
          });
        }}
        onSuccess={onChanged}
      >
        <Field
          name="title"
          label="Tên sản phẩm"
          maxLength={200}
          value={item?.title}
        />
        <Field
          name="description"
          label="Vai trò của bạn và kết quả (công khai)"
          type="textarea"
          required={false}
          value={item?.description}
        />
        <Field
          name="category"
          label="Loại sản phẩm"
          required={false}
          maxLength={100}
          value={item?.category}
        />
        <Field
          name="client"
          label="Tên khách hàng (chỉ khi được phép, có thể bỏ trống)"
          required={false}
          maxLength={200}
          value={item?.client}
        />
        <label className="field">
          Năm thực hiện
          <input
            name="project_year"
            type="number"
            min={1900}
            max={2100}
            step={1}
            defaultValue={item?.project_year || undefined}
          />
        </label>
        <Field
          name="project_url"
          label="Liên kết sản phẩm công khai HTTPS (không bắt buộc)"
          type="url"
          required={false}
          value={item?.project_url || ""}
        />
        <label className="checkbox-field">
          <input required type="checkbox" name="rights_confirmed" />
          Tôi xác nhận có quyền công khai nội dung, tên khách hàng và ảnh của
          portfolio này.
        </label>
      </ActionForm>
    </div>
  );
}
