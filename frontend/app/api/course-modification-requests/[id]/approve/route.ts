import {
  forwardedAuthorizationHeaders,
  proxyToBackend,
} from "@/lib/proxy-backend";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToBackend(
    `/course-modification-requests/${encodeURIComponent(id)}/approve`,
    {
      method: "PATCH",
      headers: forwardedAuthorizationHeaders(request),
    },
  );
}
