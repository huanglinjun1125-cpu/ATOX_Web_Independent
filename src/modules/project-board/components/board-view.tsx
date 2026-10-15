"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header, Footer } from "@/components/site-shell";
import { useLanguage } from "@/components/language-provider";
import type {
  ProjectBoardDto,
  ProjectCard,
  ProjectFilters,
} from "../contracts";
import { fetchProjects } from "../client";
import { normalizeFilters, parseFilters, projectQuery } from "../rules";
import { projectCopy } from "../copy";

function ProjectCover({ project }: { project: ProjectCard }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="pb-cover">
      {project.cover && !failed ? (
        <Image
          unoptimized
          src={project.cover}
          width={800}
          height={500}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="pb-cover-fallback" data-testid="project-cover-fallback">
          <span aria-hidden="true">✳</span>
          <small>ROOM FOR AN IDEA</small>
        </div>
      )}
    </div>
  );
}

function ProjectPreview({
  project,
  categories,
  onClose,
  trigger,
}: {
  project: ProjectCard;
  categories: ProjectBoardDto["options"]["categories"];
  onClose: () => void;
  trigger: HTMLElement | null;
}) {
  const { language } = useLanguage();
  const t = projectCopy[language];
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [trigger]);
  return (
    <dialog
      ref={dialog}
      className="pb-dialog"
      aria-labelledby="pb-preview-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex="0"]',
          ),
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="pb-dialog-top">
        <span>{t.demo}</span>
        <button type="button" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </div>
      <ProjectCover project={project} />
      <div className="pb-dialog-body">
        <span className="pb-category">
          {categories.find((c) => c.id === project.category)?.name[language]}
        </span>
        <h2 id="pb-preview-title">{project.name[language]}</h2>
        <p className="pb-full-intro">{project.introduction[language]}</p>
        <dl>
          <dt>{t.creator}</dt>
          <dd>{project.creator[language]}</dd>
          <dt>{t.event}</dt>
          <dd>
            {project.event ? (
              <Link href={project.event.href}>
                {project.event.name[language]} ↗
              </Link>
            ) : (
              t.independent
            )}
          </dd>
        </dl>
        <p className="pb-field-label">{t.tags}</p>
        <div className="pb-tags">
          {project.tags.map((tag) => (
            <span key={tag.en}>{tag[language]}</span>
          ))}
        </div>
        <p className="pb-preview-note">{t.previewNote}</p>
      </div>
    </dialog>
  );
}

export function ProjectBoardView({
  initial,
  signedIn,
}: {
  initial: ProjectBoardDto;
  signedIn: boolean;
}) {
  const { language } = useLanguage();
  const t = projectCopy[language];
  const [data, setData] = useState(initial);
  const [active, setActive] = useState(initial.filters);
  const [search, setSearch] = useState(initial.filters.q);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<{
    project: ProjectCard;
    trigger: HTMLElement;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async (filters: ProjectFilters, history = true) => {
    const next = normalizeFilters(filters);
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setActive(next);
    setPending(true);
    setError(false);
    if (history) {
      const url = `/projects${projectQuery(next)}`;
      if (url !== window.location.pathname + window.location.search)
        window.history.pushState(null, "", url);
    }
    try {
      const result = await fetchProjects(next, request.signal);
      if (!request.signal.aborted) setData(result);
    } catch {
      if (!request.signal.aborted) setError(true);
    } finally {
      if (!request.signal.aborted) setPending(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() !== active.q)
        void load({ ...active, q: search, page: "1" });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, active, load]);
  useEffect(() => {
    function restore() {
      const filters = parseFilters(new URLSearchParams(window.location.search));
      setSearch(filters.q);
      setSelected(null);
      void load(filters, false);
    }
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      controller.current?.abort();
    };
  }, [load]);
  function reset() {
    setSearch("");
    void load({});
  }
  function filter(key: "event" | "category", value: string) {
    void load({ ...active, q: search, [key]: value, page: "1" });
  }
  const hasFilters = Boolean(active.q || active.category || active.event);
  return (
    <div className="site project-board">
      <Header signedIn={signedIn} projectSubmission />
      <main className="pb-main">
        <section className="pb-hero">
          <div>
            <p className="pb-eyebrow">{t.eyebrow}</p>
            <h1>
              {t.title}
              <br />
              <em>{t.accent}</em>
            </h1>
            <p className="pb-lead">{t.intro}</p>
            <div className="pb-hero-links">
              <Link className="pb-primary" href="/projects/submit">
                {t.submit} <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/events">
                {t.events} <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <p className="pb-demo-note">
              <span aria-hidden="true">●</span> {t.demoNote}
            </p>
          </div>
          <div className="pb-hero-art" aria-hidden="true">
            <div className="pb-orbit" />
            <div className="pb-art-window">
              <span>IDEA / 001</span>
              <b>✳</b>
              <small>WHAT IF?</small>
            </div>
            <span className="pb-art-dot" />
            <span className="pb-art-label">BUILD / PLAY / DISCOVER</span>
          </div>
        </section>
        <form
          className="pb-filters"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void load({ ...active, q: search, page: "1" });
          }}
        >
          <label className="pb-search">
            <span>{t.search}</span>
            <input
              type="search"
              value={search}
              placeholder={t.placeholder}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span>{t.category}</span>
            <select
              aria-label={t.category}
              value={active.category}
              onChange={(event) => filter("category", event.target.value)}
            >
              <option value="">{t.allCategories}</option>
              {data.options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name[language]}
                </option>
              ))}
              {active.category &&
                !data.options.categories.some(
                  (c) => c.id === active.category,
                ) && <option value={active.category}>{active.category}</option>}
            </select>
          </label>
          <label>
            <span>{t.event}</span>
            <select
              aria-label={t.event}
              value={active.event}
              onChange={(event) => filter("event", event.target.value)}
            >
              <option value="">{t.allEvents}</option>
              <option value="independent">{t.independent}</option>
              {data.options.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name[language]}
                </option>
              ))}
              {active.event &&
                active.event !== "independent" &&
                !data.options.events.some((e) => e.id === active.event) && (
                  <option value={active.event}>{active.event}</option>
                )}
            </select>
          </label>
        </form>
        <section
          className="pb-results"
          aria-busy={pending}
          aria-label={t.results}
        >
          <div className="pb-results-heading">
            <h2>
              {t.results}
              <span aria-live="polite">
                {pending ? "…" : `${data.total} ${t.count}`}
              </span>
            </h2>
            <div>
              {hasFilters && (
                <button type="button" onClick={reset}>
                  {t.reset} ×
                </button>
              )}
              <span>{t.order}</span>
            </div>
          </div>
          {pending ? (
            <div className="pb-empty" role="status">
              {t.loading}
            </div>
          ) : error ? (
            <div className="pb-empty" role="alert">
              <p>{t.error}</p>
              <button
                className="pb-primary"
                onClick={() => void load(active, false)}
              >
                {t.retry}
              </button>
            </div>
          ) : data.projects.length ? (
            <div className="pb-grid">
              {data.projects.map((project) => (
                <article className="pb-card" key={project.id}>
                  <button
                    type="button"
                    className="pb-card-button"
                    aria-label={`${t.preview}: ${project.name[language]}`}
                    aria-haspopup="dialog"
                    onClick={(event) => {
                      setSelected({ project, trigger: event.currentTarget });
                    }}
                  >
                    <ProjectCover project={project} />
                    <div className="pb-card-body">
                      <div className="pb-card-meta">
                        <span className="pb-category">
                          {
                            data.options.categories.find(
                              (c) => c.id === project.category,
                            )?.name[language]
                          }
                        </span>
                        <span>{t.demo}</span>
                      </div>
                      <h3>{project.name[language]}</h3>
                      <p className="pb-card-intro">
                        {project.introduction[language]}
                      </p>
                      <div className="pb-tags">
                        {project.tags.slice(0, 3).map((tag) => (
                          <span key={tag.en}>{tag[language]}</span>
                        ))}
                      </div>
                      <p className="pb-creator">{project.creator[language]}</p>
                      <div className="pb-card-bottom">
                        <span>
                          {project.event?.name[language] ?? t.independent}
                        </span>
                        <span aria-hidden="true">↗</span>
                      </div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="pb-empty">
              <span aria-hidden="true">✳</span>
              <h3>{data.total > 0 ? t.outOfRange : t.empty}</h3>
              <p>{t.emptyHint}</p>
              <button
                className="pb-primary"
                onClick={
                  data.total > 0
                    ? () => void load({ ...active, page: "1" })
                    : reset
                }
              >
                {data.total > 0 ? t.firstPage : t.reset}
              </button>
            </div>
          )}
          {!pending && !error && data.totalPages > 0 && (
            <nav className="pb-pagination" aria-label={t.pagination}>
              <button
                disabled={data.page <= 1}
                onClick={() =>
                  void load({
                    ...active,
                    page: String(Math.min(data.page - 1, data.totalPages)),
                  })
                }
              >
                ← {t.previous}
              </button>
              <span>
                {data.page} / {data.totalPages}
              </span>
              <button
                disabled={data.page >= data.totalPages}
                onClick={() =>
                  void load({ ...active, page: String(data.page + 1) })
                }
              >
                {t.next} →
              </button>
            </nav>
          )}
        </section>
        <div className="pb-closing">
          <span>YOUR NEXT IDEA STARTS HERE.</span>
          <Link href="/projects/submit">{t.submit} ↗</Link>
        </div>
      </main>
      <Footer />
      {selected && (
        <ProjectPreview
          project={selected.project}
          categories={data.options.categories}
          trigger={selected.trigger}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export function ProjectSubmissionPlaceholder({
  signedIn,
}: {
  signedIn: boolean;
}) {
  const { language } = useLanguage();
  const t = projectCopy[language];
  return (
    <div className="site project-board">
      <Header signedIn={signedIn} projectSubmission />
      <main className="pb-submit">
        <p className="pb-eyebrow">A SPACE FOR YOUR NEXT IDEA</p>
        <div className="pb-submit-art" aria-hidden="true">
          ✳
        </div>
        <h1>{t.submitTitle}</h1>
        <h2>{t.submitIntro}</h2>
        <p>{t.submitBody}</p>
        <p className="pb-demo-note">{t.submitNote}</p>
        <div className="pb-hero-links">
          <Link className="pb-primary" href="/projects">
            {t.back} ↗
          </Link>
          <Link href="/events">{t.events} ↗</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
