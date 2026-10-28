import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../services";
import { patch } from "../../services/api";
import {
  ActionForm,
  Field,
  Page,
  Pagination,
  State,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { loginDestination } from "../../lib/permissions";
import { authErrorMessage } from "../../lib/auth";
import { AvatarUpload } from "../../components/AvatarUpload";

const CreatorProfessionalProfile = lazy(() =>
  import("../creator/CreatorProfessionalProfile").then((module) => ({
    default: module.CreatorProfessionalProfile,
  })),
);

export function Profile() {
  const auth = useAuth();
  return (
    <Page title="Hồ sơ người dùng & Bảo mật">
      <p>Quản lý thông tin cá nhân và bảo vệ tài khoản của bạn.</p>
      <div className="split">
        <section className="panel">
          <h2>Thông tin tài khoản</h2>
          <p>{auth.profile?.email}</p>
          <AvatarUpload />
          <ActionForm
            onSubmit={async (data) => {
              await patch("/auth/me", {
                full_name: String(data.get("full_name")),
                phone: String(data.get("phone")),
                company_name: String(data.get("company_name")),
                notification_preferences: {
                  email: auth.profile?.notification_preferences?.email ?? true,
                  in_app: data.has("in_app"),
                },
              });
              await auth.refresh();
            }}
          >
            <Field
              name="full_name"
              label="Họ và tên"
              value={auth.profile?.full_name}
            />
            <Field
              name="phone"
              label="Số điện thoại"
              type="tel"
              required={false}
              value={(auth.profile as { phone?: string } | null)?.phone}
            />
            <Field
              name="company_name"
              label="Công ty"
              value={auth.profile?.company_name ?? ""}
              required={false}
            />
            <label className="checkbox-field">
              <input
                name="in_app"
                type="checkbox"
                defaultChecked={
                  auth.profile?.notification_preferences?.in_app ?? true
                }
              />
              Nhận thông báo trong ứng dụng
            </label>
          </ActionForm>
        </section>
        <section className="panel">
          <h2>Đổi mật khẩu</h2>
          <p>Sử dụng mật khẩu có ít nhất 8 ký tự.</p>
          <ActionForm
            label="Đổi mật khẩu"
            onSubmit={async (data) => {
              if (data.get("password") !== data.get("confirm"))
                throw new Error("Mật khẩu xác nhận chưa khớp.");
              const result = await authService.reset(
                String(data.get("password")),
              );
              if (result.error) throw new Error(authErrorMessage(result.error));
            }}
          >
            <Field name="password" label="Mật khẩu mới" type="password" />
            <Field name="confirm" label="Xác nhận mật khẩu" type="password" />
          </ActionForm>
        </section>
      </div>
      {["CREATOR", "STUDENT_CREATOR"].includes(auth.role || "") && (
        <Suspense
          fallback={
            <section className="panel">
              <h2>Hồ sơ nghề nghiệp Creator</h2>
              <p>Đang tải công cụ hồ sơ…</p>
            </section>
          }
        >
          <CreatorProfessionalProfile />
        </Suspense>
      )}
    </Page>
  );
}

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  target_path: string | null;
};

export function Notifications() {
  const { role } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("ALL");
  const query = useApi<{ items: NotificationRow[]; total: number }>(
    "/notifications?" +
      new URLSearchParams({
        page: String(page),
        limit: "10",
        search: term,
        status,
      }),
  );

  return (
    <Page title="Thông báo">
      <p>Cập nhật mới nhất về dự án và tài khoản của bạn.</p>
      <div className="notification-toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setTerm(search.trim());
            setPage(1);
          }}
        >
          <input
            aria-label="Tìm kiếm thông báo"
            placeholder="Tìm nội dung thông báo…"
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Trạng thái thông báo"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tất cả thông báo</option>
            <option value="UNREAD">Chưa đọc</option>
            <option value="READ">Đã đọc</option>
          </select>
          <button className="btn btn-primary">Tìm kiếm</button>
        </form>
        <ActionForm
          label="Đánh dấu tất cả đã đọc"
          onSubmit={() => patch("/notifications/read-all", {})}
          onSuccess={query.reload}
        />
      </div>
      <State query={query}>
        <div className="notification-list">
          {query.data?.items.map((notification) => (
            <article
              className={`panel notification-card ${notification.read_at ? "is-read" : "is-unread"}`}
              key={notification.id}
            >
              <span className="eyebrow">
                {notification.read_at ? "ĐÃ ĐỌC" : "CHƯA ĐỌC"}
              </span>
              <h2>{notification.title}</h2>
              <p>{notification.message}</p>
              <small>
                {new Date(notification.created_at).toLocaleString("vi-VN")}
              </small>
              {notification.target_path && (
                <p>
                  <Link
                    to={loginDestination(role || "", notification.target_path)}
                  >
                    Mở nội dung liên quan →
                  </Link>
                </p>
              )}
              {!notification.read_at && (
                <ActionForm
                  label="Đánh dấu đã đọc"
                  onSubmit={() =>
                    patch("/notifications/" + notification.id, {})
                  }
                  onSuccess={query.reload}
                />
              )}
            </article>
          ))}
        </div>
        {!query.data?.items.length && (
          <div className="empty-state">
            {term || status !== "ALL"
              ? "Không có thông báo phù hợp với bộ lọc."
              : "Bạn chưa có thông báo."}
          </div>
        )}
        <Pagination
          limit={10}
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </Page>
  );
}
