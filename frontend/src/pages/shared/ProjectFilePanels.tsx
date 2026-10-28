import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { ActionForm } from "../../components/ui";
import { uploadService } from "../../services";
import { date } from "./DashboardPages";
import type { ProjectFileRow } from "./project-workspace-types";

export function FileList({
  id,
  files,
  kind,
}: {
  id: string;
  files: ProjectFileRow[];
  kind: string;
}) {
  const [error, setError] = useState("");
  return (
    <>
      {!files.length && <p>Chưa có tệp được tải lên.</p>}
      {files.map((f) => (
        <div className="file" key={f.id}>
          <FileText />
          <div>
            <b>{f.file_name || f.name}</b>
            <small>
              {f.version ? `Phiên bản ${f.version}` : date(f.created_at)}
            </small>
          </div>
          <button
            className="icon-btn"
            aria-label={`Tải ${f.file_name || f.name}`}
            onClick={async () => {
              try {
                setError("");
                const result = await uploadService.download(id, kind, f.id);
                window.location.assign(result.signedUrl);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Download size={17} />
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
export function UploadForm({
  path,
  reload,
}: {
  path: string;
  reload: () => void;
}) {
  return (
    <ActionForm
      label="Tải tệp lên"
      onSubmit={(data) => {
        const file = data.get("file") as File;
        if (!file?.size) throw new Error("Vui lòng chọn tệp.");
        return uploadService.upload(path, file);
      }}
      onSuccess={reload}
    >
      <label className="upload">
        Ảnh, video hoặc PDF · Tối đa 50 MB
        <input
          aria-label="Chọn tệp tải lên"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf"
          required
        />
      </label>
    </ActionForm>
  );
}
