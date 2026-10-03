import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { db, result, ApiError } from "./db.js";
import { fileType } from "./file-validation.js";

export const profileRoutes = Router();
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
profileRoutes.post("/avatar", avatarUpload.single("file"), async (req, res) => {
 if (!req.file || !["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) throw new ApiError(422, "AVATAR_REQUIRED", "Chọn ảnh JPG, PNG hoặc WEBP, tối đa 5 MB.");
 const extension = fileType(req.file), path = `${req.identity.id}/${randomUUID()}.${extension}`;
 await result(db.storage.from("profile-avatars").upload(path, req.file.buffer, { contentType: req.file.mimetype, cacheControl: "3600" }));
 const { data: { publicUrl } } = db.storage.from("profile-avatars").getPublicUrl(path);
 try {
  await result(db.rpc("save_profile_avatar", { actor_id: req.identity.id, image_url: publicUrl }));
 } catch (error) {
  await db.storage.from("profile-avatars").remove([path]);
  throw error;
 }
 res.status(201).json({ success: true, data: { avatar_url: publicUrl } });
});
