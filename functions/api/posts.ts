import { withNewContentId } from "../utils/ids";
// (add this import at the top of the file, alongside the existing imports)

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) {
      return json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        500
      );
    }

    const body = await request.json().catch(() => ({} as any));

    const content = safeString(body.content).trim();

    // old single-media compatibility
    const media_url = body.media_url ?? null;
    const media_type = body.media_type ?? null;

    // new multi-media support
    const media_urls_arr = normalizeStringArray(body.media_urls);
    const media_types_arr = normalizeStringArray(body.media_types);
    const media_meta_arr = normalizeMediaMetaArray(body.media_meta);

    // Allow guest posts: user_id can be null
    const user_id = body.user_id ?? null;

    const filtered_urls = media_urls_arr
      .filter((u) => !String(u).startsWith("data:"))
      .filter((u) => isHttpUrl(u));

    const filtered_types: string[] = [];
    for (let i = 0; i < filtered_urls.length; i++) {
      const t = String(media_types_arr[i] || "").trim();
      filtered_types.push(t || "");
    }

    const mediaMetaFeedUrls = media_meta_arr
      .map((item: any) =>
        String(
          item?.feed ||
            item?.feed_url ||
            item?.url ||
            item?.full ||
            item?.full_url ||
            item?.thumb ||
            ""
        ).trim()
      )
      .filter((u: string) => isHttpUrl(u));

    const mediaMetaTypes = media_meta_arr.map((item: any) =>
      String(
        item?.type || inferTypeFromUrl(item?.full || item?.feed || item?.thumb || "")
      ).trim()
    );

    const final_multi_urls =
      filtered_urls.length > 0 ? filtered_urls : mediaMetaFeedUrls;

    const final_multi_types =
      filtered_types.length > 0 ? filtered_types : mediaMetaTypes;

    const final_media_url =
      typeof media_url === "string" && media_url.trim().length > 0
        ? media_url
        : final_multi_urls[0] ?? null;

    const final_media_type =
      typeof media_type === "string" && media_type.trim().length > 0
        ? media_type
        : final_multi_types[0] ?? null;

    const hasSingle =
      typeof final_media_url === "string" && final_media_url.trim().length > 0;
    const hasMulti = final_multi_urls.length > 0;
    const hasMeta = media_meta_arr.length > 0;

    if (!content && !hasSingle && !hasMulti && !hasMeta) {
      return json(
        { error: "content or media_url or media_urls is required" },
        400
      );
    }

    if (
      typeof final_media_url === "string" &&
      final_media_url.startsWith("data:")
    ) {
      return json(
        {
          error: "Media upload not supported in base64.",
          message:
            "Upload to R2/Cloudflare Images and store a normal https URL in media_url/media_urls.",
        },
        413
      );
    }

    if (
      typeof final_media_url === "string" &&
      final_media_url.length > 0 &&
      !isHttpUrl(final_media_url)
    ) {
      return json({ error: "media_url must be a valid http/https URL" }, 400);
    }

    const media_urls_json = final_multi_urls.length
      ? JSON.stringify(final_multi_urls)
      : null;
    const media_types_json = final_multi_types.length
      ? JSON.stringify(final_multi_types)
      : null;
    const media_meta_json = media_meta_arr.length
      ? JSON.stringify(media_meta_arr)
      : null;

    // ---- Allocate a hard, globally-unique content ID and insert ----
    let insertedWithMediaMeta = true;
    let post_id: number;

    try {
      const { id, result } = await withNewContentId(async (id) => {
        return await env.DB.prepare(
          `INSERT INTO posts
             (id, user_id, content, media_url, media_type,
              media_urls, media_types, media_meta)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            user_id,
            content || null,
            final_media_url,
            final_media_type,
            media_urls_json,
            media_types_json,
            media_meta_json
          )
          .run();
      });
      post_id = id;
    } catch (e: any) {
      // Fallback: older schema without media_meta (kept for safety)
      const msg = String(e?.message || "");
      const looksLikeMissingColumn =
        msg.includes("no such column") || msg.includes("media_meta");
      if (!looksLikeMissingColumn) throw e;

      insertedWithMediaMeta = false;
      const { id } = await withNewContentId(async (id) => {
        return await env.DB.prepare(
          `INSERT INTO posts
             (id, user_id, content, media_url, media_type,
              media_urls, media_types)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            user_id,
            content || null,
            final_media_url,
            final_media_type,
            media_urls_json,
            media_types_json
          )
          .run();
      });
      post_id = id;
    }

    const media = insertedWithMediaMeta
      ? normalizePostMedia({
          media_url: final_media_url,
          media_type: final_media_type,
          media_urls: media_urls_json,
          media_types: media_types_json,
          media_meta: media_meta_json,
        })
      : normalizePostMedia({
          media_url: final_media_url,
          media_type: final_media_type,
          media_urls: media_urls_json,
          media_types: media_types_json,
        });

    return json(
      {
        success: true,
        post_id,
        post: {
          id: post_id,
          user_id,
          content: content || "",
          media_url: final_media_url,
          media_type: final_media_type,
          media_urls: media_urls_json,
          media_types: media_types_json,
          media_meta: insertedWithMediaMeta ? media_meta_json : null,
          media,
          thumb_url: media[0]?.thumb || null,
          feed_url: media[0]?.feed || null,
          full_url: media[0]?.full || null,
          created_at: new Date().toISOString(),
        },
      },
      201
    );
  } catch (err: any) {
    return json(
      { error: "Backend crash", message: String(err?.message ?? err) },
      500
    );
  }
};
