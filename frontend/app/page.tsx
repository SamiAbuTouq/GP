import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirect to login page - middleware will handle redirecting to dashboard if authenticated
  redirect("/login");
}
