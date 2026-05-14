"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
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
import {
  HELP_FAQ_CATEGORY_LABELS,
  HELP_FAQ_ITEMS,
  HELP_PDF_GUIDES,
  HOSTED_VIDEO_TUTORIALS,
  type HelpFaqCategory,
} from "./help-data";

const FAQ_CATEGORY_ORDER: readonly HelpFaqCategory[] = [
  "timetable-generation",
  "conflicts",
  "reports-exports",
  "entities",
  "access-roles",
  "what-if",
  "saving-publishing",
];

type FaqCategoryFilter = "all" | HelpFaqCategory;

export default function HelpPage() {
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
                    Practical guidance for the Smart University Timetabling System.
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

            <div className="grid gap-8 lg:grid-cols-5">
              <section className="lg:col-span-3" aria-labelledby="faq-heading">
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

              <aside className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">See the full system in action</CardTitle>
                    <CardDescription>
                      A narrated walkthrough of the real platform - from the dashboard and data setup,
                      through AI-powered generation and what-if scenarios.
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
                                {video.tagline}
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
                    <CardTitle className="text-base">PDF guides</CardTitle>
                    <CardDescription>
                      Printable handbooks for the workflows administrators use most.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {HELP_PDF_GUIDES.map((doc) => {
                      const isComingSoon = Boolean(doc.comingSoon || !doc.publicPath);
                      const rowClass =
                        "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors";
                      const inner = (
                        <>
                          <FileText
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              isComingSoon ? "text-muted-foreground" : "text-primary",
                            )}
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium leading-snug">{doc.title}</p>
                              {isComingSoon ? (
                                <Badge variant="secondary" className="text-[10px] font-normal">
                                  Coming soon
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {doc.description}
                            </p>
                          </div>
                        </>
                      );

                      if (isComingSoon || !doc.publicPath) {
                        return (
                          <div
                            key={doc.id}
                            className={cn(rowClass, "cursor-default bg-muted/20 text-muted-foreground")}
                          >
                            {inner}
                          </div>
                        );
                      }

                      return (
                        <a
                          key={doc.id}
                          href={doc.publicPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(rowClass, "hover:bg-muted/40")}
                        >
                          {inner}
                        </a>
                      );
                    })}
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
                Full-screen video: {activeHostedVideo.title}. Use the on-screen play, pause, volume,
                and fullscreen controls provided by your browser.
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
