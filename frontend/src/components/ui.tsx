import { useId, useRef, useState, type ReactNode, type FormEvent } from "react";
import { useApi } from "../hooks/useApi";
export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    value ?? 0,
  );
export const labels: Record<string, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã gửi",
  REVIEWING: "Đang xem xét",
  QUOTATION_SENT: "Đã gửi báo giá",
  QUOTATION_ACCEPTED: "Đã chấp nhận báo giá",
  IN_PROGRESS: "Đang thực hiện",
  WAITING_REVIEW: "Chờ duyệt",
  REVISION: "Đang chỉnh sửa",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  SENT: "Đã gửi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Từ chối",
  DECLINED: "Creator từ chối nhận việc",
  RELEASED: "Đã thu hồi phân công",
  EXPIRED: "Hết hạn",
  PENDING: "Đang chờ",
  PAID: "Đã thanh toán",
  APPROVED: "Đã duyệt",
  PENDING_APPROVAL: "Chờ duyệt",
  REVISION_REQUIRED: "Cần chỉnh sửa",
  ACTIVE: "Hoạt động",
  INACTIVE: "Ngừng hoạt động",
  RESOLVED: "Đã giải quyết",
  OPEN: "Chờ tiếp nhận",
  CLOSED: "Đã đóng",
  REPORTED: "Chờ xác minh thanh toán",
  ISSUED: "Đã phát hành",
  OVERDUE: "Quá hạn thanh toán",
  REQUESTED: "Đã yêu cầu chỉnh sửa",
  UPLOADED: "Đã tải lên",
  UNASSIGNED: "Chờ tiếp nhận",
  ASSIGNED: "Đã có người phụ trách",
  CONSULTING: "Đang tư vấn",
  WAITING_CUSTOMER: "Chờ bạn bổ sung thông tin",
  CREATOR_SELECTION: "Đang chọn creator",
  QUOTE_PREPARING: "Đang chuẩn bị báo giá",
  QUOTE_SENT: "Báo giá chờ phản hồi",
  QUOTE_REVISION: "Đang chỉnh báo giá",
  READY_TO_ORDER: "Sẵn sàng đặt dịch vụ",
  CONVERTED: "Đã chuyển thành đơn dịch vụ",
  PROPOSED: "Đã đề xuất", SHORTLISTED: "Đang cân nhắc", SELECTED: "Đã chọn", WITHDRAWN: "Đã thu hồi",
  VIEWED: "Đã xem", REVISION_REQUESTED: "Khách yêu cầu chỉnh", WAITING_CONTRACT: "Chờ hợp đồng",
  ACKNOWLEDGED: "Đã xác nhận điều khoản",
  AWAITING_VERIFICATION: "Chờ Admin đối soát",
  PLANNING: "Đang lập kế hoạch", READY: "Sẵn sàng thực hiện", ON_HOLD: "Tạm dừng",
  READY_TO_DELIVER: "Đã nghiệm thu · chờ bàn giao", DELIVERED: "Đã bàn giao",
  WAITING_PAYMENT: "Chờ thanh toán", CONFIRMED: "Đã xác nhận", WAITING_ACCEPTANCE: "Chờ thu đủ và bàn giao", REFUNDED: "Đã hoàn tiền",
};
export const Status = ({ value }: { value: string }) => (
  <span className="status">{labels[value] ?? value}</span>
);
export function State({
  query,
  children,
}: {
  query: ReturnType<typeof useApi>;
  children: ReactNode;
}) {
  if (query.loading && query.data === null)
    return (
      <div className="panel skeleton" role="status">
        Đang tải dữ liệu…
      </div>
    );
  return <>
    {query.error && <div className="panel error" role="alert">
      {query.error}
      <button className="btn btn-ghost" onClick={query.reload}>Thử lại</button>
    </div>}
    {(!query.error || query.data !== null) && children}
  </>;
}
export function Page({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="dash-page">
      <div className="dash-header">
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function ActionForm({
  onSubmit,
  children,
  label = "Lưu",
  onSuccess,
  showSubmit = true,
  showSuccess = true,
}: {
  onSubmit: (data: FormData) => Promise<unknown>;
  children?: ReactNode;
  label?: string;
  onSuccess?: () => void;
  showSubmit?: boolean;
  showSuccess?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  const lock = useRef(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    const data = new FormData(e.currentTarget);
    lock.current = true;
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      await onSubmit(data);
      setSuccess(true);
      onSuccess?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        {children}
        {showSubmit && (
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Đang xử lý…" : label}
          </button>
        )}
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {success && showSuccess && <p role="status">Thao tác thành công.</p>}
    </form>
  );
}
export function Field({
  name,
  label,
  type = "text",
  value,
  required = true,
  maxLength = 5000,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  maxLength?: number;
}) {
  const fieldId = useId();
  return (
    <div className="field">
        <label htmlFor={fieldId}>{label}</label>
      {type === "textarea" ? (
        <textarea
            id={fieldId}
          name={name}
          defaultValue={value}
          required={required}
          maxLength={maxLength}
        />
      ) : (
        <input
            id={fieldId}
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          min={type === "number" ? 0 : undefined}
          maxLength={type === "password" ? undefined : maxLength}
          minLength={type === "password" ? 8 : undefined}
          step={type === "number" ? "0.01" : undefined}
        />
      )}
    </div>
  );
}
export function Pagination({
  page,
  total,
  limit = 20,
  onChange,
}: {
  page: number;
  total: number;
  limit?: number;
  onChange: (p: number) => void;
}) {
  if (!total || total <= limit) return null;
  return (
    <nav className="toolbar pagination" aria-label="Phân trang danh sách">
      <button
        className="btn btn-ghost"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Trước
      </button>
      <span>
        Trang {page} / {Math.ceil(total / limit)} · {total} kết quả
      </span>
      <button
        className="btn btn-ghost"
        disabled={page * limit >= (total ?? 0)}
        onClick={() => onChange(page + 1)}
      >
        Sau
      </button>
    </nav>
  );
}
