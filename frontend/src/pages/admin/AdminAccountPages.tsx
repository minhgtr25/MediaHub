import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import {
  ActionForm,
  Field,
  Page,
  Pagination,
  State,
} from "../../components/ui";
import { post, patch } from "../../services/api";
import { roles } from "../../lib/permissions";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";
const roleLabels: Record<string, string> = {
  ADMIN: "Quản trị viên",
  STAFF: "Nhân viên",
  CUSTOMER: "Khách hàng",
  BUSINESS: "Khách hàng doanh nghiệp",
  CREATOR: "Creator",
  STUDENT_CREATOR: "Creator sinh viên",
};
type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
};
export function AdminUsers() {
  const auth = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const query = useApi<{
    items: User[];
    total: number;
    summary: {
      total: number;
      active: number;
      inactive: number;
      by_role: {
        role: string;
        total: number;
        active: number;
        inactive: number;
      }[];
    };
  }>(
    `/admin/users?page=${page}&search=${encodeURIComponent(search)}${role ? `&role=${role}` : ""}${active ? `&active=${active}` : ""}`,
  );
  return (
    <Page title="Quản lý tài khoản">
      <p>
        Theo dõi tài khoản đã đăng ký, phân quyền và cho phép hoặc tạm ngừng
        truy cập. Số liệu tổng quan bao gồm mọi tài khoản, kể cả tài khoản thử
        nghiệm.
      </p>
      <State query={query}>
        <div className="kpi-grid">
          {(
            [
              ["Tổng tài khoản", query.data?.summary.total],
              ["Được phép truy cập", query.data?.summary.active],
              ["Đã vô hiệu hóa", query.data?.summary.inactive],
            ] as const
          ).map(([label, count]) => (
            <div className="kpi" key={label}>
              <div>
                <small>{label}</small>
                <b>{count ?? 0}</b>
              </div>
            </div>
          ))}
        </div>
        <section className="panel table-wrap">
          <h2>Tài khoản theo vai trò</h2>
          <table>
            <thead>
              <tr>
                <th>Vai trò</th>
                <th>Tổng</th>
                <th>Được truy cập</th>
                <th>Vô hiệu hóa</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.summary.by_role.map((row) => (
                <tr key={row.role}>
                  <td>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setRole(row.role);
                        setPage(1);
                      }}
                    >
                      {roleLabels[row.role]}
                    </button>
                  </td>
                  <td>{row.total}</td>
                  <td>{row.active}</td>
                  <td>{row.inactive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </State>
      <section className="panel">
        <h2>Mời tài khoản</h2>
        <p>
          Gửi email kích hoạt tài khoản. Staff tư vấn và quản lý công việc được
          phân công; Creator được cấp sau khi có hợp đồng hợp tác với công ty.
        </p>
        <ActionForm
          label="Gửi lời mời"
          onSubmit={(data) => {
            if (!window.confirm("Gửi email mời khách hàng này?"))
              throw new Error("Chưa gửi lời mời.");
            return post("/admin/customers/invite", {
              full_name: data.get("full_name"),
              email: data.get("email"),
              role: data.get("role"),
            });
          }}
          onSuccess={query.reload}
        >
          <Field name="full_name" label="Họ và tên" />
          <Field name="email" label="Email" type="email" />
          <label className="field">
            Vai trò
            <select name="role" defaultValue="CUSTOMER">
              <option value="CUSTOMER">Khách hàng</option>
              <option value="STAFF">Nhân viên hỗ trợ</option>
            </select>
          </label>
        </ActionForm>
      </section>
      <div className="toolbar">
        <input
          aria-label="Tìm tên hoặc email tài khoản"
          placeholder="Tìm tên hoặc email"
          maxLength={100}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Lọc vai trò"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả vai trò</option>
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc quyền truy cập"
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Được phép truy cập</option>
          <option value="false">Đã vô hiệu hóa</option>
        </select>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setSearch("");
            setRole("");
            setActive("");
            setPage(1);
          }}
        >
          Xóa bộ lọc
        </button>
      </div>
      <State query={query}>
        <p>
          {query.data?.total ?? 0} tài khoản phù hợp bộ lọc. Được phép truy cập
          không đồng nghĩa với đang trực tuyến.
        </p>
        <div className="resource-grid">
          {query.data?.items.map((user) => (
            <article className="panel" key={user.id}>
              <h2>{user.full_name}</h2>
              <p>{user.email}</p>
              <p>{user.active ? "Đang hoạt động" : "Đã vô hiệu hóa"}</p>
              <p>
                Vai trò: {roleLabels[user.role]} · Tham gia:{" "}
                {new Date(user.created_at).toLocaleDateString("vi-VN")}
              </p>
              <ActionForm
                key={`${user.id}-${user.role}-${user.active}`}
                onSubmit={(data) => {
                  if (
                    !window.confirm(
                      "Xác nhận thay đổi quyền truy cập tài khoản?",
                    )
                  )
                    throw new Error("Chưa lưu thay đổi.");
                  return patch(`/admin/users/${user.id}`, {
                    role: data.get("role"),
                    active: data.has("active"),
                  });
                }}
                onSuccess={query.reload}
              >
                <label className="field">
                  Vai trò
                  <select
                    name="role"
                    defaultValue={user.role}
                    disabled={user.id === auth.profile?.id}
                  >
                    {!roles.some((role) => role === user.role) && (
                      <option value={user.role}>
                        {roleLabels[user.role]} · vai trò cũ đang chuyển đổi
                      </option>
                    )}
                    {roles.map((role) => (
                      <option
                        key={role}
                        value={role}
                        disabled={
                          role === "CREATOR" &&
                          !["CREATOR", "STUDENT_CREATOR"].includes(user.role)
                        }
                      >
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                  {user.id === auth.profile?.id && (
                    <input type="hidden" name="role" value={user.role} />
                  )}
                </label>
                <label className="checkbox-field">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={user.active}
                    disabled={user.id === auth.profile?.id}
                  />
                  {user.id === auth.profile?.id && (
                    <input type="hidden" name="active" value="on" />
                  )}
                  Cho phép truy cập
                </label>
                {user.id === auth.profile?.id && (
                  <p>
                    Bạn đang dùng tài khoản này. Quyền quản trị của chính bạn
                    được bảo vệ.
                  </p>
                )}
                {!["CREATOR", "STUDENT_CREATOR"].includes(user.role) && (
                  <p>
                    Cấp quyền Creator qua{" "}
                    <Link to="/admin/creators">hồ sơ hợp tác đã ký</Link>.
                  </p>
                )}
              </ActionForm>
            </article>
          ))}
        </div>
        {!query.data?.items.length && <p>Không có tài khoản phù hợp.</p>}
        <Pagination
          page={page}
          total={query.data?.total ?? 0}
          onChange={setPage}
        />
      </State>
    </Page>
  );
}
