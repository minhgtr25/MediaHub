export type ResourceField = {
  name: string;
  label: string;
  type?: string;
  options?: string[];
  optional?: boolean;
};

type ResourceValue = string | number | boolean | string[] | null | undefined;

export type ResourceRow = Record<string, ResourceValue> & {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  content?: string;
  category?: string;
  department?: string;
  position?: string;
  email?: string;
  image_url?: string;
  thumbnail_url?: string;
  client?: string;
  starting_price?: number;
  status?: string;
  is_demo?: boolean;
  active?: boolean;
  published?: boolean;
};

export type ResourceListRow = ResourceRow & { id: string };

export function mediaFieldValue(
  value: ResourceValue,
): string | string[] | undefined {
  if (typeof value === "string" || Array.isArray(value)) return value;
  return undefined;
}

export function fieldValue(
  value: ResourceValue,
  separator: string,
): string | number | undefined {
  if (typeof value === "string" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.join(separator);
  return undefined;
}

export const schemas: Record<
  string,
  { title: string; fields: ResourceField[] }
> = {
  services: {
    title: "Quản lý dịch vụ",
    fields: [
      { name: "name", label: "Tên dịch vụ" },
      { name: "slug", label: "Đường dẫn (ví dụ: video-production)" },
      { name: "description", label: "Mô tả", type: "textarea" },
      { name: "category", label: "Danh mục" },
      { name: "starting_price", label: "Giá khởi điểm (VNĐ)", type: "number" },
      { name: "estimated_days", label: "Số ngày dự kiến", type: "number" },
      { name: "thumbnail_url", label: "URL ảnh", type: "url", optional: true },
      { name: "active", label: "Hiển thị dịch vụ", type: "checkbox" },
      { name: "featured", label: "Nổi bật", type: "checkbox" },
      { name: "display_order", label: "Thứ tự", type: "number" },
      {
        name: "features",
        label: "Đặc điểm (phân cách bằng dấu phẩy)",
        optional: true,
      },
      {
        name: "deliverables",
        label: "Sản phẩm bàn giao (phân cách bằng dấu phẩy)",
        optional: true,
      },
      { name: "seo_title", label: "Tiêu đề SEO", optional: true },
      { name: "seo_description", label: "Mô tả SEO", optional: true },
    ],
  },
  employees: {
    title: "Quản lý nhân viên",
    fields: [
      { name: "name", label: "Họ và tên" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Điện thoại", optional: true },
      { name: "position", label: "Vị trí" },
      { name: "department", label: "Bộ phận" },
      {
        name: "skills",
        label: "Kỹ năng (phân cách bằng dấu phẩy)",
        optional: true,
      },
      { name: "joined_at", label: "Ngày tham gia", type: "date" },
      { name: "status", label: "Trạng thái", options: ["ACTIVE", "INACTIVE"] },
    ],
  },
  portfolio: {
    title: "Hồ sơ dự án",
    fields: [
      { name: "title", label: "Tên dự án" },
      { name: "client", label: "Khách hàng" },
      { name: "description", label: "Mô tả", type: "textarea" },
      { name: "category", label: "Danh mục" },
      { name: "image_url", label: "URL ảnh", type: "url", optional: true },
      {
        name: "video_url",
        label: "YouTube / Shorts URL",
        type: "url",
        optional: true,
      },
      { name: "published", label: "Công khai", type: "checkbox" },
      { name: "featured", label: "Dự án nổi bật", type: "checkbox" },
      { name: "slug", label: "Đường dẫn (để trống sẽ tự tạo)", optional: true },
      { name: "industry", label: "Lĩnh vực", optional: true },
      { name: "year", label: "Năm", type: "number", optional: true },
      { name: "duration", label: "Thời lượng", optional: true },
      {
        name: "challenge",
        label: "Thách thức",
        type: "textarea",
        optional: true,
      },
      {
        name: "solution",
        label: "Giải pháp",
        type: "textarea",
        optional: true,
      },
      { name: "result", label: "Kết quả", type: "textarea", optional: true },
      {
        name: "gallery",
        label: "URL gallery (mỗi dòng một URL)",
        type: "textarea",
        optional: true,
      },
      {
        name: "deliverables",
        label: "Sản phẩm bàn giao (phân cách bằng dấu phẩy)",
        optional: true,
      },
      { name: "seo_title", label: "Tiêu đề SEO", optional: true },
      { name: "seo_description", label: "Mô tả SEO", optional: true },
    ],
  },
  testimonials: {
    title: "Quản lý đánh giá",
    fields: [
      { name: "review_id", label: "Mã đánh giá gốc (UUID)" },
      { name: "content", label: "Nội dung", type: "textarea" },
      {
        name: "status",
        label: "Trạng thái",
        options: ["PENDING", "APPROVED", "REJECTED"],
      },
    ],
  },
  partners: {
    title: "Đối tác",
    fields: [
      { name: "name", label: "Tên đối tác" },
      { name: "logo", label: "URL logo", type: "url", optional: true },
      { name: "website", label: "Website", type: "url", optional: true },
      { name: "description", label: "Mô tả", type: "textarea", optional: true },
      { name: "industry", label: "Lĩnh vực", optional: true },
      { name: "display_order", label: "Thứ tự hiển thị", type: "number" },
      { name: "active", label: "Công khai", type: "checkbox" },
    ],
  },
  work_processes: {
    title: "Quy trình",
    fields: [
      { name: "title", label: "Tiêu đề" },
      { name: "description", label: "Mô tả", type: "textarea" },
      { name: "step", label: "Bước", type: "number" },
      { name: "display_order", label: "Thứ tự hiển thị", type: "number" },
      { name: "icon", label: "Biểu tượng", optional: true },
      { name: "image", label: "URL ảnh", type: "url", optional: true },
      { name: "active", label: "Công khai", type: "checkbox" },
    ],
  },
  website_settings: {
    title: "Nội dung & cấu hình website",
    fields: [
      {
        name: "key",
        label:
          "Khóa nội dung (hero, about, privacy, terms, company_email, company_phone)",
      },
      { name: "title", label: "Tiêu đề" },
      { name: "content", label: "Nội dung", type: "textarea" },
      { name: "image", label: "URL ảnh", type: "url", optional: true },
      { name: "published", label: "Công khai", type: "checkbox" },
    ],
  },
};
