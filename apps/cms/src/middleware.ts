import { defineMiddleware } from "astro:middleware";
import { loadCurrentUser } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = await loadCurrentUser(context);
  return next();
});
