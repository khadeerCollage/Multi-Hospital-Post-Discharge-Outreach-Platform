"use client";

import React, { useEffect, useRef, useState } from "react";
import { Plus, UserPlus, PhoneCall, ClipboardList, ArrowRight, FilePlus, ChevronRight } from "lucide-react";

/* ══ CreateMenu (Liquid Single-Shape Morph) ═════════════════
   One shape, not two. The pill does not open a panel next to
   itself and it does not grow a chin — it IS the panel, seen
   small. Pressing it makes it spread: the pill goes, and what
   is left standing in the same spot is the window. */

export interface CreateMenuItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
}

export interface CreateMenuProps {
  /* corner — 0 to 40px */
  corner?: number;
  items?: CreateMenuItem[];
  className?: string;
  align?: "left" | "right" | "center";
}

const DEFAULT_ITEMS: CreateMenuItem[] = [
  {
    id: "patient",
    label: "Register Patient",
    sublabel: "New post-discharge EHR dossier",
    icon: <UserPlus className="h-4 w-4" />,
    href: "/patients?action=register",
  },
  {
    id: "campaign",
    label: "Launch Campaign",
    sublabel: "Post-discharge outreach queue",
    icon: <PhoneCall className="h-4 w-4" />,
    href: "/campaigns",
  },
  {
    id: "protocol",
    label: "Clinical Protocol",
    sublabel: "Acuity assessment guidelines",
    icon: <ClipboardList className="h-4 w-4" />,
    href: "/protocols",
  },
];

export function CreateMenu({
  corner = 28,
  items = DEFAULT_ITEMS,
  className = "",
  align = "right",
}: CreateMenuProps) {
  const [open, setOpen] = useState(false);
  const [sink, setSink] = useState(false);
  const [over, setOver] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const panel = useRef<HTMLDivElement | null>(null);

  /* The press lands first: the pill simply gets smaller. Going
     straight to the expansion skips the acknowledgement and the
     panel seems to arrive slightly before it was asked for.

     The two overlap on purpose. The shrink takes 120ms and the
     spread starts at 95, so it is still on its way down as it
     begins to widen. Waiting for the shrink to land leaves a
     stretch where nothing moves at all, and thirty still
     milliseconds in the middle of a gesture reads as a
     stutter. */
  const press = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    setSink(true);
    setTimeout(() => {
      setSink(false);
      setOpen(true);
    }, 95);
  };

  /* No close button and no title bar — anywhere but the menu
     puts it away. Registered only while it is open, and in an
     effect, so the very press that opened it (whose pointerdown
     has already been and gone) cannot close it on the same
     click.

     AND IT ASKS THE VISIBLE BOX, NOT THE ELEMENT. contains() is
     the obvious test and it was wrong here: the ref is the STAGE,
     the square this block reserves so opening the menu does not
     resize what is under it. The stage is 305 square, the menu
     inside it is 265x208, and every press in between counted as
     a press on the menu — 48px of dead ground above it and 49
     below, where clicking did nothing at all. */
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const b = panel.current?.querySelector(".crt-panel")?.getBoundingClientRect();
      const on =
        b &&
        e.clientX >= b.left &&
        e.clientX <= b.right &&
        e.clientY >= b.top &&
        e.clientY <= b.bottom;
      if (!on) {
        setOpen(false);
        setOver(null);
      }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const handleItemHover = (i: number) => {
    /* only a move between rows stretches it; arriving from
       nowhere has no direction to stretch along */
    if (over !== null && over !== i) {
      setMoving(true);
      setTimeout(() => setMoving(false), 90); // lands with the travel
    }
    setOver(i);
  };

  const handleItemClick = (item: CreateMenuItem) => {
    setOpen(false);
    setOver(null);
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      window.location.href = item.href;
    }
  };

  const n = items.length;

  return (
    <div
      ref={panel}
      className={`crt-container ${className}`}
      data-align={align}
      style={{ ["--r" as any]: `${corner}px` }}
    >
      <div
        className="crt-stage"
        data-open={open || undefined}
        data-sink={sink || undefined}
      >
        <div className="crt-panel">
          {/* THE PILL (Resting / Trigger State) */}
          <button
            type="button"
            className="crt-pill"
            onClick={press}
            aria-expanded={open}
            aria-label="Create new clinical record"
          >
            <span className="crt-pill-icon">
              <Plus className="h-4 w-4 stroke-[2.5]" />
            </span>
            <span className="crt-pill-label">Create</span>
          </button>

            {/* THE EXPANDED WINDOW (Content State) */}
            <div className="crt-content" aria-hidden={!open}>
              <div className="crt-header">
                <div className="flex items-center justify-between">
                  <span className="crt-header-title">Create New</span>
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200/60 px-1.5 py-0.2 rounded-md">Action</span>
                </div>
                <span className="crt-header-sub">CareReach Clinical Operations</span>
              </div>

              <div className="crt-items" onMouseLeave={() => setOver(null)}>
                {/* Liquid Hover Indicator (Positioned inside crt-items for exact geometric alignment) */}
                {over !== null && (
                  <div
                    className="crt-hov-pill"
                    data-moving={moving ? "true" : undefined}
                    style={{
                      top: `${over * 52}px`,
                    }}
                  />
                )}

                {items.map((item, i) => (
                  <div
                    key={item.id}
                    className="crt-item"
                    data-active={over === i ? "true" : undefined}
                    style={{
                      /* and the rows come in close behind the shell rather than
                         after it — a panel that arrives empty and fills a beat
                         later reads as a pause even though nothing stopped */
                      transitionDelay: open
                        ? `${70 + i * 38}ms`
                        : `${(n - 1 - i) * 30}ms`,
                    }}
                    onMouseEnter={() => handleItemHover(i)}
                  >
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className="crt-item-btn"
                    >
                      <span className="crt-item-icon">{item.icon}</span>
                      <div className="crt-item-meta">
                        <span className="crt-item-label">{item.label}</span>
                        {item.sublabel && (
                          <span className="crt-item-sublabel">{item.sublabel}</span>
                        )}
                      </div>
                      <ChevronRight className="crt-item-arrow" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
