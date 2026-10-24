import { enforceProductOrigin, handleProductRequest, productCorsHeaders } from "../../sites/product-api.js";

const PREFLIGHT = {
  "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,x-gaigs-request,x-gaigs-client",
  "access-control-max-age": "86400",
};

function json(request, env, value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: productCorsHeaders(request, env),
  });
}

export default {
  async fetch(request, env) {
    const denied = enforceProductOrigin(request, env);
    if (denied) return denied;
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/api/health") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: productCorsHeaders(request, env, PREFLIGHT) });
      }
      if (request.method === "GET") {
        const body = url.pathname === "/api/health"
          ? { ok: true, service: "gaigs-api" }
          : { ok: true, service: "gaigs-api", health: "/api/health" };
        return json(request, env, body);
      }
    }
    const productResponse = await handleProductRequest(request, env);
    if (productResponse) return productResponse;
    return json(request, env, { error: "Not found." }, 404);
  },
};
