export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = typeof query.url === "string" ? query.url.trim() : "";

  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: "GitHub URL is required",
    });
  }

  const authHeader = getHeader(event, "authorization");
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : "";

  try {
    return await new ChangelogGenerator(token).getRefs(url);
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Could not load refs",
    });
  }
});
