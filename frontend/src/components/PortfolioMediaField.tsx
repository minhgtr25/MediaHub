import { useEffect, useId, useState } from "react";
import { api } from "../services/api";

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
export function PortfolioMediaField({
  name,
  label,
  value,
  multiple = false,
}: {
  name: string;
  label: string;
  value?: string | string[];
  multiple?: boolean;
}) {
  const id = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [urls, setUrls] = useState(
    Array.isArray(value) ? value.join("\n") : value || "",
  );
  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    setPreviews(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  const displayed = multiple
    ? [...urls.split("\n").filter(Boolean), ...previews]
    : previews.length
      ? previews
      : urls
        ? [urls]
        : [];
  return (
    <div className="field">
      <label htmlFor={id}>{label} · JPG, PNG, WEBP · tối đa 5 MB/ảnh</label>
      <input
        id={id}
        type="file"
        name={`${name}_files`}
        multiple={multiple}
        accept={imageTypes.join(",")}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <small>
        {multiple
          ? "Ảnh được thêm vào thư viện khi lưu dự án. Tối đa 50 ảnh."
          : "Ảnh được tải lên và thay ảnh hiện tại khi lưu."}
      </small>
      <label htmlFor={`${id}-url`}>
        {multiple
          ? "Liên kết ảnh hiện có (mỗi dòng một URL; xóa dòng để gỡ ảnh)"
          : "Liên kết ảnh hiện có (có thể để trống)"}
      </label>
      {multiple ? (
        <textarea
          id={`${id}-url`}
          name={name}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />
      ) : (
        <input
          id={`${id}-url`}
          name={name}
          type="url"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />
      )}
      {!!displayed.length && (
        <div className="portfolio-upload-previews">
          {displayed.map((url, i) => (
            <img
              key={`${url}-${i}`}
              src={url}
              alt={`${label} ${i + 1}`}
              width={120}
              height={90}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export async function uploadPortfolioMedia(form: FormData, names: string[]) {
  const batches = names.map((name) => ({
    name,
    files: form
      .getAll(`${name}_files`)
      .filter(
        (value): value is File => value instanceof File && value.size > 0,
      ),
  }));
  for (const { name, files } of batches) {
    if (name !== "gallery" && files.length > 1)
      throw new Error("Chỉ chọn một ảnh đại diện.");
    if (
      name === "gallery" &&
      files.length +
        String(form.get(name) || "")
          .split("\n")
          .filter((line) => line.trim()).length >
        50
    )
      throw new Error("Thư viện có tối đa 50 ảnh.");
    if (
      files.some(
        (file) =>
          !imageTypes.includes(file.type) || file.size > 5 * 1024 * 1024,
      )
    )
      throw new Error("Chọn ảnh JPG, PNG hoặc WEBP, tối đa 5 MB/ảnh.");
  }
  const uploaded: Record<string, string[]> = {};
  for (const { name, files } of batches) {
    uploaded[name] = [];
    for (const file of files) {
      const body = new FormData();
      body.append("file", file);
      const data = await api<{ url: string }>("/admin/media", {
        method: "POST",
        body,
      });
      uploaded[name].push(data.url);
    }
  }
  return uploaded;
}
