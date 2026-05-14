import {
  forwardedAuthorizationHeaders,
  proxyToBackend,
} from "@/lib/proxy-backend";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return proxyToBackend(`/course-modification-requests${suffix}`, {
    method: "GET",
    headers: forwardedAuthorizationHeaders(request),
  });
}
