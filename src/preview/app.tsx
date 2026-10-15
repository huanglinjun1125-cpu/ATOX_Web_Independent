import { LanguageProvider } from "@/components/language-provider";
import { Header, Footer } from "@/components/site-shell";
import { HomeView } from "@/modules/homepage/components/home-view";
import { BoardView } from "@/modules/event-board/components/board-view";
import {
  ProjectBoardView,
  ProjectSubmissionPlaceholder,
} from "@/modules/project-board/components/board-view";
import { EventView } from "@/modules/event-experience/components/event-view";
import { EVENT_PATH } from "@/modules/event-experience/config";
import { previewEvents, previewProjects } from "./catalog";

export function PreviewApp({
  pathname = "/",
  query = "",
}: {
  pathname?: string;
  query?: string;
}) {
  const q = new URLSearchParams(query);
  const filters = {
    q: q.get("q") ?? "",
    year: q.get("year") ?? "",
    stage: q.get("stage") ?? "",
  };
  let page: React.ReactNode;
  if (pathname === EVENT_PATH) page = <EventView />;
  else if (pathname === "/events")
    page = <BoardView initial={previewEvents()} filters={filters} />;
  else if (pathname === "/projects")
    page = (
      <ProjectBoardView
        initial={previewProjects({
          q: q.get("q") ?? "",
          category: q.get("category") ?? "all",
          event: q.get("event") ?? "all",
          page: q.get("page") ?? "1",
        })}
        signedIn={false}
      />
    );
  else if (pathname === "/projects/submit")
    page = <ProjectSubmissionPlaceholder signedIn={false} />;
  else if (pathname === "/") page = <HomeView signedIn={false} year={2026} />;
  else
    page = (
      <div className="site">
        <Header />
        <main className="auth-main">
          <div className="auth-card">
            <p className="eyebrow">ATOX / PUBLIC PREVIEW</p>
            <h1>
              Participant services
              <br />
              are being prepared.
            </h1>
            <p className="lead">
              This preview lets you explore the public website. Sign-in, team
              spaces and private submissions need the full application
              deployment.
            </p>
            <p className="lead" style={{ marginTop: 20 }}>
              这是公开页面预览。登录、组队与私有材料功能保留在完整源码中，待正式服务部署后开放。
            </p>
            <a
              className="primary button"
              style={{ marginTop: 32 }}
              href="/events"
            >
              Explore events <span>↗</span>
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  return (
    <LanguageProvider defaultLanguage={pathname === EVENT_PATH ? "en" : "zh"}>
      <div className="atox-preview-note">
        PUBLIC WEBSITE PREVIEW · Explore the design · Registration and
        participant services are not live
      </div>
      {page}
    </LanguageProvider>
  );
}
