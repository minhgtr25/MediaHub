import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import { ActionForm, Field, Page, Pagination, State } from "../../components/ui";
import { post, patch } from "../../services/api";
import { roles } from "../../lib/permissions";
const roleLabels: Record<string, string> = { ADMIN: "Quản trị viên", STAFF: "Nhân viên", CUSTOMER: "Khách hàng", BUSINESS: "Khách hàng doanh nghiệp", CREATOR: "Creator", STUDENT_CREATOR: "Creator sinh viên" };
type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
};
export function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useApi<{ items: User[]; total: number }>(
    `/admin/users?page=${page}&search=${encodeURIComponent(search)}`,
  );
  return (
    <Page title="Quản lý tài khoản">
      <section className="panel">
        <h2>Mời tài khoản</h2>
        <p>Gửi email kích hoạt tài khoản. Staff tư vấn và quản lý công việc được phân công; Creator được cấp sau khi có hợp đồng hợp tác với công ty.</p>
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
          aria-label="Tìm tên tài khoản"
          placeholder="Tìm tên tài khoản"
          maxLength={100}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>
      <State query={query}>
        <div className="resource-grid">
          {query.data?.items.map((user) => (
            <article className="panel" key={user.id}>
              <h2>{user.full_name}</h2>
              <p>{user.email}</p>
              <p>{user.active ? "Đang hoạt động" : "Đã vô hiệu hóa"}</p>
              <ActionForm
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
                  <select name="role" defaultValue={user.role}>
                    {!roles.some(role => role === user.role) && <option value={user.role}>{roleLabels[user.role]} · vai trò cũ đang chuyển đổi</option>}
                    {roles.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </select>
                </label>
                <label className="checkbox-field">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={user.active}
                  />
                  Cho phép truy cập
                </label>
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
