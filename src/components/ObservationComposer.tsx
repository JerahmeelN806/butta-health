import { ArrowRight, ImagePlus, Plus, X } from "lucide-react";
import gsap from "gsap";
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ApiError, buttaApi } from "../services/api";
import type { Attachment } from "../types";

const SPRING_EASE = "cubic-bezier(0.175, 0.885, 0.32, 1.275)";

type LocalAttachment = Attachment & { previewUrl: string; file: File };

function ThumbRemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <span
      role="button"
      tabIndex={0}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }
      }}
      className="absolute right-1 top-1 z-10 grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-black/60 text-white opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 hover:bg-black/80"
      aria-label={label}
    >
      <X size={11} />
    </span>
  );
}

function AttachmentThumb({
  attachment,
  onRemove,
  onOpen,
  registerRef,
}: {
  attachment: LocalAttachment;
  onRemove: () => void;
  onOpen: (rect: DOMRect) => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);

  return (
    <button
      ref={(el) => {
        btnRef.current = el;
        registerRef(el);
      }}
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        if (btnRef.current) onOpen(btnRef.current.getBoundingClientRect());
      }}
      className="group relative size-12 shrink-0 overflow-hidden rounded-xl border border-white/30 bg-white/10 outline-none transition-transform duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:scale-[1.05] active:scale-95"
      aria-label={`Open preview of ${attachment.originalName}`}
    >
      <img src={attachment.previewUrl} alt={attachment.originalName} className="size-full object-cover" draggable={false} />
      <ThumbRemoveButton onClick={onRemove} label={`Remove ${attachment.originalName}`} />
    </button>
  );
}

function AttachmentGalleryModal({
  attachment,
  originRect,
  onClose,
}: {
  attachment: LocalAttachment;
  originRect: DOMRect;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const [targetRect, setTargetRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const width = Math.min(window.innerWidth * 0.7, 900);
    const height = Math.min(window.innerHeight * 0.7, 720);
    setTargetRect({
      top: (window.innerHeight - height) / 2,
      left: (window.innerWidth - width) / 2,
      width,
      height,
    });
    const raf = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setPhase("closing");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isOpen = phase === "open";
  const geometry = isOpen && targetRect
    ? { ...targetRect, radius: 20 }
    : { top: originRect.top, left: originRect.left, width: originRect.width, height: originRect.height, radius: 12 };
  const duration = phase === "closing" ? "0.28s" : "0.42s";
  const easing = phase === "closing" ? "ease-out" : SPRING_EASE;
  const transition = `top ${duration} ${easing}, left ${duration} ${easing}, width ${duration} ${easing}, height ${duration} ${easing}, border-radius ${duration} ${easing}`;

  return (
    <div className="fixed inset-0 z-[100]" onClick={() => setPhase("closing")} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300" style={{ opacity: isOpen ? 1 : 0 }} />
      <div
        style={{
          position: "fixed",
          top: geometry.top,
          left: geometry.left,
          width: geometry.width,
          height: geometry.height,
          borderRadius: geometry.radius,
          transition,
          overflow: "hidden",
          boxShadow: isOpen ? "0 24px 60px -12px rgb(0 0 0 / 0.45)" : "0 0 0 0 rgb(0 0 0 / 0)",
        }}
        className="bg-ink"
        onTransitionEnd={() => {
          if (phase === "closing") onClose();
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={attachment.previewUrl}
          alt={attachment.originalName}
          className={`size-full ${isOpen ? "object-contain" : "object-cover"}`}
          draggable={false}
        />
      </div>
      <button
        type="button"
        onClick={() => setPhase("closing")}
        style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? "scale(1)" : "scale(0.7)" }}
        className={`fixed right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur-sm transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:bg-white ${!isOpen ? "pointer-events-none" : ""}`}
        aria-label="Close preview"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function TagPickerPortal({
  anchorRef,
  options,
  selected,
  onToggle,
  onClose,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  onClose: () => void;
}) {
  const [position, setPosition] = useState<{ left: number; bottom: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const panelWidth = 224;
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 12);
    setPosition({ left: Math.max(12, left), bottom: window.innerHeight - rect.top + 8 });
  }, [anchorRef]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [anchorRef, onClose]);

  if (!position) return null;

  return createPortal(
    <div
      ref={panelRef}
      onMouseDown={(event) => event.preventDefault()}
      style={{ position: "fixed", left: position.left, bottom: position.bottom, width: 224, maxHeight: 260 }}
      className="z-50 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-2xl"
    >
      {options.map((tag) => {
        const isSelected = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors duration-150 ${
              isSelected ? "bg-teal/10 text-tealDark" : "text-ink hover:bg-well"
            }`}
          >
            {tag}
            {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-teal" />}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

export function ObservationComposer({
  observation,
  setObservation,
  onSubmit,
  extracting,
  allowAttachments,
  symptomTagOptions,
}: {
  observation: string;
  setObservation: (value: string) => void;
  onSubmit: (attachmentIds: string[], symptomTags: string[]) => void;
  extracting: boolean;
  allowAttachments: boolean;
  symptomTagOptions: string[];
}) {
  const [expanded, setExpanded] = useState(observation.trim().length > 0);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [activePreview, setActivePreview] = useState<{ attachment: LocalAttachment; rect: DOMRect } | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const fileChooserOpenRef = useRef(false);
  const tagsButtonRef = useRef<HTMLButtonElement | null>(null);

  const hasContent = observation.trim().length > 0 || attachments.length > 0 || selectedTags.length > 0;

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const context = gsap.context(() => {
      gsap.to(cardRef.current, {
        maxHeight: expanded ? 320 : 56,
        duration: 0.45,
        ease: "back.out(1.1)",
      });
    }, cardRef);
    return () => context.revert();
  }, [expanded]);

  useEffect(() => {
    if (expanded && textareaRef.current) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [expanded]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(28, Math.min(el.scrollHeight, 160))}px`;
  }, [observation, expanded]);

  useEffect(() => {
    function onWindowFocus() {
      // The file chooser dialog is a native OS window; the page only regains
      // focus once it's dismissed (file picked or cancelled either way), so
      // this is the reliable signal to stop treating the composer as "mid
      // interaction" for the textarea's blur-based collapse below.
      fileChooserOpenRef.current = false;
    }
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, []);

  useEffect(() => {
    return () => {
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function collapseIfEmpty() {
    if (!hasContent && !fileChooserOpenRef.current) setExpanded(false);
  }

  function openFileChooser() {
    fileChooserOpenRef.current = true;
    fileInputRef.current?.click();
  }

  async function handleFilesChosen(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (files.length === 0) return;

    const room = Math.max(0, 6 - attachments.length);
    const accepted = files.slice(0, room);
    if (accepted.length === 0) return;

    setUploading(true);
    setUploadError("");
    try {
      const { attachments: uploaded } = await buttaApi.uploadAttachments(accepted);
      const withPreviews: LocalAttachment[] = uploaded.map((attachment, index) => ({
        ...attachment,
        previewUrl: URL.createObjectURL(accepted[index]!),
        file: accepted[index]!,
      }));
      setAttachments((current) => [...current, ...withPreviews]);
    } catch (error) {
      setUploadError(error instanceof ApiError ? error.message : "Your images could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
    thumbRefs.current.delete(id);
  }

  function handleSubmit() {
    if (!hasContent || extracting) return;
    onSubmit(attachments.map((attachment) => attachment.id), selectedTags);
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  function onTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && !hasContent) {
      setExpanded(false);
      textareaRef.current?.blur();
    }
  }

  return (
    <div ref={rootRef} className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        onChange={(event) => void handleFilesChosen(event)}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div
        ref={cardRef}
        onMouseDown={(event) => {
          if (event.target !== textareaRef.current && expanded) {
            textareaRef.current?.focus();
          }
        }}
        onBlur={(event) => {
          if (rootRef.current?.contains(event.relatedTarget as Node)) return;
          collapseIfEmpty();
        }}
        style={{ maxHeight: expanded ? 420 : 56, overflow: "hidden" }}
        className={`group min-w-0 rounded-[28px] border border-white/30 bg-white/20 p-4 shadow-float backdrop-blur-xl transition-colors duration-200 ${
          expanded ? "cursor-text" : "cursor-pointer"
        } focus-within:border-white/50 focus-within:bg-white/25 focus-within:ring-4 focus-within:ring-white/10`}
      >
        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex h-6 w-full items-center text-left text-sm font-medium text-white/70 outline-none"
          >
            Describe sensations, onset, severity, timing, medications, or context.
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">Natural language transcript</span>
              <span
                className={`badge border backdrop-blur-sm transition-colors duration-200 ${
                  extracting
                    ? "border-gold/40 bg-gold/20 text-gold"
                    : "border-white/30 bg-white/10 text-white/80"
                }`}
              >
                <span className={`badge-dot ${extracting ? "animate-pulse" : ""}`} />
                <span>{extracting ? "Analyzing" : "Ready to parse"}</span>
              </span>
            </div>

            <textarea
              ref={textareaRef}
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              onKeyDown={onTextareaKeyDown}
              rows={1}
              style={{ outline: "none", boxShadow: "none" }}
              className="w-full resize-none overflow-hidden border-0 bg-transparent text-base leading-7 text-white outline-none ring-0 placeholder:text-white/50 focus:outline-none focus:ring-0"
              placeholder="Describe sensations, onset, severity, timing, medications, or context."
            />

            {(attachments.length > 0 || selectedTags.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 py-1.5 pl-3 pr-2 text-xs font-semibold text-white"
                  >
                    {tag}
                    <span
                      role="button"
                      tabIndex={0}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => toggleTag(tag)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleTag(tag);
                        }
                      }}
                      className="grid h-4 w-4 cursor-pointer place-items-center rounded-full text-white/70 hover:bg-white/20 hover:text-white"
                      aria-label={`Remove ${tag} tag`}
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))}
                {attachments.map((attachment) => (
                  <AttachmentThumb
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={() => removeAttachment(attachment.id)}
                    onOpen={(rect) => setActivePreview({ attachment, rect })}
                    registerRef={(el) => thumbRefs.current.set(attachment.id, el)}
                  />
                ))}
              </div>
            )}

            {uploadError && (
              <p role="alert" className="text-xs font-semibold text-rust">{uploadError}</p>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {symptomTagOptions.length > 0 && (
                  <button
                    ref={tagsButtonRef}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setTagPickerOpen((open) => !open)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors duration-200 hover:bg-white/15 hover:text-white ${
                      tagPickerOpen ? "bg-white/15 text-white" : "text-white/70"
                    }`}
                  >
                    <Plus size={15} />
                    Tags
                  </button>
                )}
                {allowAttachments && (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={openFileChooser}
                    disabled={uploading || attachments.length >= 6}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-white/70 transition-colors duration-200 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ImagePlus size={15} />
                    {uploading ? "Uploading" : "Add photo"}
                  </button>
                )}

                {tagPickerOpen && (
                  <TagPickerPortal
                    anchorRef={tagsButtonRef}
                    options={symptomTagOptions}
                    selected={selectedTags}
                    onToggle={toggleTag}
                    onClose={() => setTagPickerOpen(false)}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={extracting || !hasContent}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-teal px-6 py-2.5 font-semibold text-paper transition-all duration-200 hover:bg-tealDark hover:shadow-lift disabled:cursor-wait disabled:opacity-70"
              >
                {extracting ? "Analyzing" : "Log Observation"}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {activePreview && (
        <AttachmentGalleryModal
          attachment={activePreview.attachment}
          originRect={activePreview.rect}
          onClose={() => setActivePreview(null)}
        />
      )}
    </div>
  );
}
