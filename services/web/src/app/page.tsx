import { redirect } from "next/navigation";

import { paths } from "@/config/paths";

export default function Home() {
  redirect(paths.schedule.href);
}
