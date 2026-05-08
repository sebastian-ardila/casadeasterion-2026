// DEPRECATED — see subscribe-with-auth.
//
// The newsletter subscription flow moved to Google OAuth. This endpoint is
// kept only so any cached client (browser cache, old static HTML in CDN)
// gets a clear response instead of a confusing 404.

Deno.serve((req) => {
  const origin = req.headers.get("origin");
  const allow = origin ?? "https://casadeasterionediciones.com";
  return new Response(
    JSON.stringify({
      error: "endpoint_deprecated",
      message:
        "Esta vía fue reemplazada por suscripción con Google. Recarga la página y vuelve a intentarlo.",
    }),
    {
      status: 410,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": allow,
      },
    },
  );
});
