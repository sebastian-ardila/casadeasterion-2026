import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/auth";
import { getSupabaseServerClient } from "~/lib/supabase-server";

export const POST: APIRoute = async (ctx) => {
  const guard = await requireAdmin(ctx);
  if (guard instanceof Response) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const fd = await ctx.request.formData();
  const file = fd.get("file");
  const bucket = String(fd.get("bucket") ?? "covers");

  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "no_file" }), { status: 400 });
  }
  if (!["covers", "content", "authors"].includes(bucket)) {
    return new Response(JSON.stringify({ error: "invalid_bucket" }), { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "file_too_large" }), { status: 400 });
  }

  const supabase = getSupabaseServerClient(ctx.request, ctx.cookies);

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const safeBase = file.name.replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "image";
  const year = new Date().getFullYear();
  const path = `${year}/${safeBase}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return new Response(JSON.stringify({ url: data.publicUrl, path }), {
    headers: { "content-type": "application/json" },
  });
};
