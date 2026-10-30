import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "http://127.0.0.1:59999";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-real-key";

const { app } = await import("../dist/app.mjs");
const { db } = await import("../dist/db.js");
const adminId = "11111111-1111-4111-8111-111111111111";
const headers = { Authorization: "Bearer admin-test" };
let server;
let base;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

test("Admin uploads a cover and saves a public project with YouTube video", async () => {
  const original = {
    from: db.from,
    getUser: db.auth.getUser,
    storageFrom: db.storage.from,
  };
  let saved;
  db.auth.getUser = async () => ({
    data: { user: { id: adminId } },
    error: null,
  });
  db.from = (table) => ({
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({
      data:
        table === "profiles"
          ? {
              id: adminId,
              auth_user_id: adminId,
              role: "ADMIN",
              active: true,
              full_name: "Admin",
            }
          : null,
      error: null,
    }),
    insert(value) {
      saved = value;
      return this;
    },
    single: async () => ({ data: { id: adminId, ...saved }, error: null }),
  });
  db.storage.from = () => ({
    upload: async () => ({ data: { path: "cover.png" }, error: null }),
    getPublicUrl: () => ({
      data: { publicUrl: "https://example.invalid/cover.png" },
    }),
  });
  try {
    const form = new FormData();
    form.append(
      "file",
      new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], {
        type: "image/png",
      }),
      "cover.png",
    );
    const upload = await fetch(`${base}/api/admin/media`, {
      method: "POST",
      headers,
      body: form,
    });
    assert.equal(upload.status, 200);
    const image = (await upload.json()).data.url;
    assert.equal(image, "https://example.invalid/cover.png");

    const project = {
      title: "Video giới thiệu sản phẩm",
      client: "Khách hàng mẫu",
      description: "Dự án giới thiệu sản phẩm.",
      category: "Video & TVC",
      image_url: image,
      video_url: "https://youtu.be/dQw4w9WgXcQ",
      published: true,
      featured: false,
      slug: "video-gioi-thieu-san-pham",
    };
    const create = await fetch(`${base}/api/admin/portfolio`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    assert.equal(create.status, 200);
    assert.equal(saved.slug, project.slug);
    assert.equal(saved.video_url, project.video_url);
    assert.equal(saved.image_url, image);

    const invalid = await fetch(`${base}/api/admin/portfolio`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...project,
        video_url: "https://example.com/not-youtube",
      }),
    });
    assert.equal(invalid.status, 422);
    const failure = await invalid.json();
    assert.equal(failure.error.code, "INVALID_PORTFOLIO");
    assert.match(failure.error.message, /video_url/);
  } finally {
    db.from = original.from;
    db.auth.getUser = original.getUser;
    db.storage.from = original.storageFrom;
  }
});
