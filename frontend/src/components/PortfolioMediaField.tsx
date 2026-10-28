import { useEffect, useId, useState } from "react";
import { api } from "../services/api";

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
export function PortfolioMediaField({
  name,
  label,
  value,
  multiple = false,
  hideUrl = false,
  allowClear = false,
}: {
  name: string;
  label: string;
  value?: string | string[];
  multiple?: boolean;
  hideUrl?: boolean;
  allowClear?: boolean;
}) {
  const id = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [urls, setUrls] = useState(
    Array.isArray(value) ? value.join("\n") : value || "",
  );
  const [cleared, setCleared] = useState(false);
  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    setPreviews(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  const displayed = multiple
    ? [...urls.split("\n").filter(Boolean), ...previews]
    : previews.length
      ? previews
      : urls && !cleared
        ? [urls]
        : [];
  return (
    <div className="field">
      <label htmlFor={id}>{label} · JPG, PNG hoặc WEBP · tối đa 5 MB/ảnh</label>
      <input
        id={id}
        type="file"
        name={`${name}_files`}
        multiple={multiple}
        accept={imageTypes.join(",")}
        onChange={(event) => {
          setFiles(Array.from(event.target.files ?? []));
          setCleared(false);
        }}
      />
      <small>
        {multiple
          ? "Ảnh sẽ được thêm vào thư viện khi lưu. Tối đa 50 ảnh."
          : "Chọn ảnh từ thiết bị. Ảnh mới sẽ thay ảnh hiện tại khi lưu."}
      </small>
      {!hideUrl && (
        <>
          <label htmlFor={`${id}-url`}>
            {multiple
              ? "URL thư viện ảnh (mỗi dòng một URL)"
              : "URL ảnh hiện tại (không bắt buộc)"}
          </label>
          {multiple ? (
            <textarea
              id={`${id}-url`}
              name={name}
              value={urls}
              onChange={(event) => setUrls(event.target.value)}
            />
          ) : (
            <input
              id={`${id}-url`}
              name={name}
              type="url"
              value={urls}
              onChange={(event) => setUrls(event.target.value)}
            />
          )}
        </>
      )}
      {allowClear && urls && !cleared && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setCleared(true)}
        >
          Gỡ ảnh hiện tại
        </button>
      )}
      {allowClear && cleared && (
        <input type="hidden" name={`${name}_remove`} value="true" />
      )}
      {!!displayed.length && (
        <div className="portfolio-upload-previews">
          {displayed.map((url, index) => (
            <img
              key={`${url}-${index}`}
              src={url}
              alt={`${label} ${index + 1}`}
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
      throw new Error("Chỉ chọn một ảnh cho mỗi mục.");
    if (
      name === "gallery" &&
      files.length +
        String(form.get(name) || "")
          .split("\n")
          .filter((line) => line.trim()).length >
        50
    ) {
      throw new Error("Thư viện có tối đa 50 ảnh.");
    }
    if (
      files.some(
        (file) =>
          !imageTypes.includes(file.type) || file.size > 5 * 1024 * 1024,
      )
    ) {
      throw new Error("Chọn ảnh JPG, PNG hoặc WEBP, tối đa 5 MB mỗi ảnh.");
    }
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
