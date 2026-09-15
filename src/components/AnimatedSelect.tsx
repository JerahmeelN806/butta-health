import { ChevronDown } from "lucide-react";
import gsap from "gsap";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

type AnimatedSelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
};

export function AnimatedSelect({ label, value, onChange, options, placeholder = "Not specified", className = "" }: AnimatedSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerId = useRef(`select-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!panelRef.current) return;

    if (open) {
      const context = gsap.context(() => {
        gsap.fromTo(
          panelRef.current,
          { autoAlpha: 0, y: -8, scale: 0.98, transformOrigin: "top center" },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: "power3.out" },
        );
        gsap.fromTo(
          ".animated-select-option",
          { autoAlpha: 0, y: -6 },
          { autoAlpha: 1, y: 0, duration: 0.22, ease: "power2.out", stagger: 0.035, delay: 0.04 },
        );
      }, panelRef);
      return () => context.revert();
    }
  }, [open]);

  function close() {
    if (!panelRef.current) {
      setOpen(false);
      return;
    }
    gsap.to(panelRef.current, {
      autoAlpha: 0,
      y: -6,
      scale: 0.98,
      duration: 0.16,
      ease: "power2.in",
      onComplete: () => setOpen(false),
    });
  }

  function selectValue(next: string) {
    onChange(next);
    close();
  }

  function onTriggerKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveIndex(Math.max(0, options.indexOf(value)));
      setOpen(true);
    }
  }

  function onPanelKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectValue(options[activeIndex]!);
    }
  }

  return (
    <div ref={rootRef} className={`relative block ${className}`}>
      {label && (
        <label id={`${triggerId}-label`} className="text-sm font-extrabold">
          {label}
        </label>
      )}
      <button
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${triggerId}-label ${triggerId}` : undefined}
        onClick={() => {
          if (open) {
            close();
          } else {
            setActiveIndex(Math.max(0, options.indexOf(value)));
            setOpen(true);
          }
        }}
        onKeyDown={onTriggerKeyDown}
        className={`mt-2 flex h-12 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm outline-none transition ${
          open ? "border-teal ring-2 ring-teal/10" : "border-line hover:border-teal/40"
        }`}
      >
        <span className={value ? "text-ink" : "text-faint"}>{value || placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-faint transition-transform duration-300 ${open ? "rotate-180 text-teal" : ""}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="listbox"
          aria-labelledby={label ? `${triggerId}-label` : undefined}
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          autoFocus
          className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-line bg-white shadow-float"
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => selectValue("")}
            className={`animated-select-option flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold transition hover:bg-well ${!value ? "text-teal" : "text-faint"}`}
          >
            {placeholder}
          </button>
          {options.map((option, index) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={value === option}
              onClick={() => selectValue(option)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`animated-select-option flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold transition ${
                index === activeIndex ? "bg-well text-ink" : "text-ink hover:bg-well"
              } ${value === option ? "text-teal" : ""}`}
            >
              {option}
              {value === option && <span className="h-1.5 w-1.5 rounded-full bg-teal" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
