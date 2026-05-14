"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ExternalLink,
  FileText,
  Play,
  Search,
} from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  HELP_FAQ_CATEGORY_LABELS,
  HELP_FAQ_ITEMS,
  HELP_PDF_GUIDES,
  HOSTED_VIDEO_TUTORIALS,
  QUICK_START_AREAS,
  type AppRole,
  type HelpFaqCategory,
} from "./help-data";

const FAQ_CATEGORY_ORDER: readonly HelpFaqCategory[] = [
  "timetable-generation",
  "conflicts",
  "reports-exports",
  "entities",
  "access-roles",
  "what-if",
  "schedule-viewer",
];

type FaqCategoryFilter = "all" | HelpFaqCategory;

function isAppRole(role: string | undefined): role is AppRole {
  return role === "ADMIN" || role === "LECTURER";
}

function visibleQuickStarts(userRole: string | undefined) {
  if (!isAppRole(userRole)) {
    return [...QUICK_START_AREAS];
  }
  return QUICK_START_AREAS.filter((area) =>
    area.roles.length === 0 ? true : area.roles.includes(userRole),
  );
}

export default function HelpPage() {
  const { user } = useAuth();
  const [faqSearch, setFaqSearch] = useState("");
  const [faqCategory, setFaqCategory] = useState<FaqCategoryFilter>("all");
  const [activeHostedVideoId, setActiveHostedVideoId] = useState<string | null>(null);
  const hostedVideoRef = useRef<HTMLVideoElement | null>(null);

  const filteredFaqs = useMemo(() => {
    const query = faqSearch.trim().toLowerCase();
    return HELP_FAQ_ITEMS.filter((item) => {
      const matchesCategory = faqCategory === "all" || item.category === faqCategory;
      const haystack = `${item.question} ${item.answer}`.toLowerCase();
      const matchesSearch = query.length === 0 || haystack.includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [faqCategory, faqSearch]);

  const quickStarts = useMemo(() => visibleQuickStarts(user?.role), [user?.role]);

  const activeHostedVideo = useMemo(
    () => HOSTED_VIDEO_TUTORIALS.find((v) => v.id === activeHostedVideoId) ?? null,
    [activeHostedVideoId],
  );

  useEffect(() => {
    if (!activeHostedVideoId) return;
    const el = hostedVideoRef.current;
    if (!el) return;
    void el.play().catch(() => {
      // Autoplay may be blocked; native controls still work.
    });
  }, [activeHostedVideoId]);

  const handleHostedDialogChange = (open: boolean) => {
    if (!open) {
      const el = hostedVideoRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
      setActiveHostedVideoId(null);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-b from-background to-muted/20">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <header className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-balance text-2xl font-semibold tracking-tight lg:text-3xl">
                    Help &amp; Support
                  </h1>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Practical guidance for the Smart University Timetabling System: generate drafts,
                    resolve conflicts, publish schedules, and evidence decisions with exports.
                  </p>
                </div>
              </div>
            </header>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Search the knowledge base</CardTitle>
                <CardDescription>
                  Combine search with a topic filter. Results update as you type—no network calls.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={faqSearch}
                    onChange={(e) => setFaqSearch(e.target.value)}
                    placeholder="Search questions and answers…"
                    className="pl-9"
                    aria-label="Search help articles"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={faqCategory === "all" ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setFaqCategory("all")}
                  >
                    All topics
                  </Button>
                  {FAQ_CATEGORY_ORDER.map((category) => (
                    <Button
                      key={category}
                      type="button"
                      size="sm"
                      variant={faqCategory === category ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => setFaqCategory(category)}
                    >
                      {HELP_FAQ_CATEGORY_LABELS[category]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <section aria-labelledby="quick-start-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 id="quick-start-heading" className="text-sm font-semibold tracking-tight">
                  Quick start
                </h2>
                <p className="text-xs text-muted-foreground">
                  Jump to the area that matches your task—links respect your role after sign-in.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {quickStarts.map((area) => (
                  <Link key={area.id} href={area.href} className="group block h-full">
                    <Card className="h-full border-border/70 transition-colors hover:border-primary/35 hover:bg-muted/30">
                      <CardHeader className="space-y-2 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-semibold leading-snug">
                            {area.title}
                          </CardTitle>
                          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </div>
                        <CardDescription className="text-xs leading-relaxed">
                          {area.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-1.5">
                          {area.roles.length === 0 ? (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              All roles
                            </Badge>
                          ) : (
                            area.roles.map((role) => (
                              <Badge key={role} variant="outline" className="text-[10px] font-normal">
                                {role === "ADMIN" ? "Administrators" : "Lecturers"}
                              </Badge>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>

            <div className="grid gap-8 lg:grid-cols-3">
              <section className="lg:col-span-2" aria-labelledby="faq-heading">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle id="faq-heading" className="text-base">
                          Frequently asked questions
                        </CardTitle>
                        <CardDescription>
                          Showing {filteredFaqs.length} of {HELP_FAQ_ITEMS.length} articles
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Accordion
                      key={`${faqCategory}-${faqSearch.trim()}`}
                      type="single"
                      collapsible
                      className="w-full"
                    >
                      {filteredFaqs.map((item) => (
                        <AccordionItem key={item.id} value={item.id}>
                          <AccordionTrigger className="text-left text-sm hover:no-underline">
                            <span className="flex w-full flex-col gap-1 pr-2">
                              <span className="font-medium leading-snug">{item.question}</span>
                              <span className="text-[11px] font-normal text-muted-foreground">
                                {HELP_FAQ_CATEGORY_LABELS[item.category]}
                              </span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>

                    {filteredFaqs.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        No articles match this combination. Try clearing the search or switching the
                        topic filter.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </section>

              <aside className="space-y-6 lg:col-span-1">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Hosted video tutorial</CardTitle>
                    <CardDescription>
                      Official orientation for the Smart University Timetabling System—opens in a
                      fullscreen player with native controls.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {HOSTED_VIDEO_TUTORIALS.map((video) => (
                      <div key={video.id} className="space-y-2">
                        <button
                          type="button"
                          className={cn(
                            "group relative w-full overflow-hidden rounded-lg border bg-muted text-left shadow-sm",
                            "outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                          )}
                          onClick={() => setActiveHostedVideoId(video.id)}
                          aria-haspopup="dialog"
                          aria-label={`Play video: ${video.title}`}
                        >
                          <div className="relative aspect-video w-full">
                            <img
                              src={video.posterUrl}
                              alt=""
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md ring-1 ring-border transition group-hover:scale-105">
                                <Play className="ml-0.5 h-6 w-6" aria-hidden />
                              </span>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 space-y-1 p-3">
                              <p className="text-sm font-semibold text-white drop-shadow-sm">
                                {video.title}
                              </p>
                              <p className="text-xs text-white/85 drop-shadow-sm">
                                {video.durationLabel}
                              </p>
                            </div>
                          </div>
                        </button>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {video.description}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Printable guides</CardTitle>
                    <CardDescription>
                      Short PDFs you can circulate in committee packs. Hosted alongside the app in{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/public/help</code>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {HELP_PDF_GUIDES.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.publicPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 rounded-lg border px-3 py-2.5 transition hover:bg-muted/40"
                      >
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium leading-snug">{doc.title}</p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {doc.description}
                          </p>
                        </div>
                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={Boolean(activeHostedVideo)} onOpenChange={handleHostedDialogChange}>
        <DialogContent
          showCloseButton
          className={cn(
            "fixed inset-0 left-0 top-0 z-[110] flex h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-black p-0 shadow-none sm:max-w-none",
            "[&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/10",
          )}
        >
          {activeHostedVideo ? (
            <>
              <DialogTitle className="sr-only">{activeHostedVideo.title}</DialogTitle>
              <DialogDescription className="sr-only">
                Fullscreen video with native playback controls.
              </DialogDescription>
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <p className="truncate text-sm font-medium text-white">{activeHostedVideo.title}</p>
              </div>
              <div className="flex flex-1 items-center justify-center px-3 pb-6 sm:px-8">
                <video
                  ref={hostedVideoRef}
                  className="max-h-[calc(100dvh-4.5rem)] w-full max-w-6xl rounded-md bg-black shadow-2xl outline-none ring-1 ring-white/10"
                  controls
                  playsInline
                  preload="metadata"
                  poster={activeHostedVideo.posterUrl}
                >
                  <source src={activeHostedVideo.mp4Url} type="video/mp4" />
                  <track
                    kind="captions"
                    srcLang="en"
                    label="English"
                    src="/help/quick-start-captions.vtt"
                    default
                  />
                  Your browser does not support embedded video playback.
                </video>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
