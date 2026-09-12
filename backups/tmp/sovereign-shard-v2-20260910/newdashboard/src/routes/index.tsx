import { createFileRoute } from "@tanstack/react-router";
import { MissionDashboard } from "@/components/mission/dashboard";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <MissionDashboard />;
}
