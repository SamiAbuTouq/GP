import { redirect } from "next/navigation";

export default function LegacyWhatIfRedirectPage() {
  redirect("/dashboard/what-if");
}

