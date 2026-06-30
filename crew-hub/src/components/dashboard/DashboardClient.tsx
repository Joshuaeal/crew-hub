"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GridLayout, useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { CrewSession } from "@/lib/session";
import type { WidgetInstance, WidgetType } from "@/types/dashboard";
import { DEFAULT_WIDGETS, WIDGET_REGISTRY, getWidgetMeta } from "@/lib/widget-registry";
import { UpcomingWidget } from "@/components/dashboard/widgets/UpcomingWidget";
import { RecentJobsWidget } from "@/components/dashboard/widgets/RecentJobsWidget";
import { MyShiftsWidget } from "@/components/dashboard/widgets/MyShiftsWidget";
import { QuickLinksWidget } from "@/components/dashboard/widgets/QuickLinksWidget";
import { AffineWorkspaceWidget } from "@/components/dashboard/widgets/AffineWorkspaceWidget";
import { hasPermission } from "@/types/permissions";

type Props = {
  session: CrewSession;
  affineUrl?: string;
};

const COLS = 12;
const ROW_HEIGHT = 64;

function widgetToLayoutItem(w: WidgetInstance): LayoutItem {
  return { i: w.id, x: w.position.x, y: w.position.y, w: w.position.w, h: w.position.h };
}

function applyLayout(widgets: WidgetInstance[], layout: Layout): WidgetInstance[] {
  return widgets.map((w) => {
    const l = layout.find((x) => x.i === w.id);
    if (!l) return w;
    return { ...w, position: { x: l.x, y: l.y, w: l.w, h: l.h } };
  });
}

function WidgetContent({ widget, session, affineUrl }: { widget: WidgetInstance; session: CrewSession; affineUrl?: string }) {
  const isAdmin = session.role === "admin";
  const canViewInventory = hasPermission(session.permissions, "inventory") || hasPermission(session.permissions, "inventory_request");
  const canViewProjects = hasPermission(session.permissions, "projects_view") || hasPermission(session.permissions, "projects_manage") || isAdmin;

  switch (widget.widget_type) {
    case "upcoming":
      return (
        <UpcomingWidget
          settings={widget.settings as Parameters<typeof UpcomingWidget>[0]["settings"]}
          userEmail={session.email}
          isAdmin={isAdmin}
          canViewInventory={canViewInventory}
          canViewProjects={canViewProjects}
          filterUserId={session.role === "subcontractor" ? session.userId : undefined}
        />
      );
    case "recent_jobs":
      return (
        <RecentJobsWidget
          settings={widget.settings as Parameters<typeof RecentJobsWidget>[0]["settings"]}
          filterUserId={session.role === "subcontractor" ? session.userId : undefined}
        />
      );
    case "my_shifts":
      return (
        <MyShiftsWidget
          settings={widget.settings as Parameters<typeof MyShiftsWidget>[0]["settings"]}
          userEmail={session.email}
        />
      );
    case "quick_links":
      return <QuickLinksWidget />;
    case "affine_workspace":
      return <AffineWorkspaceWidget affineUrl={affineUrl} />;
  }
}

function SettingsPopover({
  widget,
  onUpdate,
  onClose,
}: {
  widget: WidgetInstance;
  onUpdate: (w: WidgetInstance) => void;
  onClose: () => void;
}) {
  const meta = getWidgetMeta(widget.widget_type);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (meta.settingsFields.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-56"
    >
      <div className="text-xs font-semibold text-gray-700 mb-2">{meta.displayName} settings</div>
      {meta.settingsFields.map((field) => {
        const value = (widget.settings as Record<string, unknown>)[field.key];
        return (
          <div key={field.key} className="mb-2">
            <label className="text-xs text-gray-500 block mb-1">{field.label}</label>
            {field.type === "select" ? (
              <select
                className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                value={value as string}
                onChange={(e) =>
                  onUpdate({ ...widget, settings: { ...widget.settings, [field.key]: e.target.value } as WidgetInstance["settings"] })
                }
              >
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                value={value as number}
                min={field.min}
                max={field.max}
                onChange={(e) =>
                  onUpdate({ ...widget, settings: { ...widget.settings, [field.key]: Number(e.target.value) } as WidgetInstance["settings"] })
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddWidgetPicker({
  existing,
  permissions,
  onAdd,
  onClose,
}: {
  existing: WidgetType[];
  permissions: string[];
  onAdd: (type: WidgetType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const available = WIDGET_REGISTRY.filter(
    (m) => !existing.includes(m.widget_type) &&
      (!m.requiredPermission || hasPermission(permissions, m.requiredPermission))
  );

  return (
    <div ref={ref} className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-52">
      {available.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-400">All widgets are already on your dashboard.</div>
      ) : (
        <ul>
          {available.map((m) => (
            <li key={m.widget_type}>
              <button
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { onAdd(m.widget_type); onClose(); }}
              >
                {m.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardClient({ session, affineUrl }: Props) {
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openSettings, setOpenSettings] = useState<string | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const { width: containerWidth, containerRef, mounted } = useContainerWidth();

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(({ widgets: w }: { widgets: WidgetInstance[] }) => {
        setWidgets(Array.isArray(w) ? w : DEFAULT_WIDGETS);
        setLoading(false);
      })
      .catch(() => {
        setWidgets(DEFAULT_WIDGETS);
        setLoading(false);
      });
  }, []);


  const save = useCallback(async (toSave: WidgetInstance[]) => {
    setSaving(true);
    try {
      await fetch("/api/dashboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets: toSave }),
      });
    } finally {
      setSaving(false);
    }
  }, []);

  function handleLayoutChange(layout: Layout) {
    setWidgets((prev) => applyLayout(prev, layout));
  }

  function removeWidget(id: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }

  function addWidget(type: WidgetType) {
    const meta = getWidgetMeta(type);
    const newWidget: WidgetInstance = {
      id: crypto.randomUUID(),
      widget_type: type,
      position: { x: 0, y: Infinity, w: meta.defaultSize.w, h: meta.defaultSize.h },
      settings: meta.defaultSettings as WidgetInstance["settings"],
    };
    setWidgets((prev) => [...prev, newWidget]);
  }

  function updateWidget(updated: WidgetInstance) {
    setWidgets((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }

  async function handleSave() {
    await save(widgets);
    setEditMode(false);
    setOpenSettings(null);
    setShowAddPicker(false);
  }

  function handleCancel() {
    setEditMode(false);
    setOpenSettings(null);
    setShowAddPicker(false);
    // Re-fetch to restore any unsaved changes
    setLoading(true);
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(({ widgets: w }: { widgets: WidgetInstance[] }) => {
        setWidgets(Array.isArray(w) ? w : DEFAULT_WIDGETS);
        setLoading(false);
      })
      .catch(() => { setWidgets(DEFAULT_WIDGETS); setLoading(false); });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Loading dashboard…
      </div>
    );
  }

  const layouts: Layout = widgets.map(widgetToLayoutItem);

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 md:p-6 mx-auto w-full max-w-[1400px]">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2 relative">
          {editMode ? (
            <>
              <div className="relative">
                <button
                  onClick={() => setShowAddPicker((v) => !v)}
                  className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  + Add widget
                </button>
                {showAddPicker && (
                  <AddWidgetPicker
                    existing={widgets.map((w) => w.widget_type)}
                    permissions={session.permissions}
                    onAdd={addWidget}
                    onClose={() => setShowAddPicker(false)}
                  />
                )}
              </div>
              <button
                onClick={handleCancel}
                className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save layout"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Edit layout
            </button>
          )}
        </div>
      </div>

      {editMode && (
        <div className="mb-3 text-xs text-gray-400">
          Drag and resize widgets to rearrange. Use the gear icon to change widget settings.
        </div>
      )}

      {/* Grid */}
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="w-full">
        {mounted && <GridLayout
          layout={layouts}
          gridConfig={{ cols: COLS, rowHeight: ROW_HEIGHT, margin: [12, 12] as [number, number], containerPadding: [0, 0] as [number, number] }}
          width={containerWidth}
          dragConfig={{ enabled: editMode }}
          resizeConfig={{ enabled: true }}
          onLayoutChange={handleLayoutChange}
        >
          {widgets.map((widget) => {
            const meta = getWidgetMeta(widget.widget_type);
            return (
              <div
                key={widget.id}
                className={`bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden ${editMode ? "shadow-md" : "shadow-sm"}`}
              >
                {/* Widget header */}
                <div className={`flex items-center justify-between px-4 py-2 border-b border-gray-100 ${editMode ? "cursor-grab active:cursor-grabbing" : ""}`}>
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    {meta.displayName}
                  </span>
                  {editMode && (
                    <div className="flex items-center gap-1 relative">
                      {meta.settingsFields.length > 0 && (
                        <button
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          onClick={() => setOpenSettings((v) => (v === widget.id ? null : widget.id))}
                          title="Widget settings"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
                            <path fillRule="evenodd" d="M8 1a.75.75 0 0 1 .75.75v.906a5.511 5.511 0 0 1 2.006.83l.64-.641a.75.75 0 1 1 1.06 1.06l-.64.641c.37.596.634 1.267.83 2.006H13.25a.75.75 0 0 1 0 1.5h-.906c-.196.74-.46 1.41-.83 2.006l.641.64a.75.75 0 1 1-1.06 1.06l-.641-.64c-.596.37-1.267.634-2.006.83v.906a.75.75 0 0 1-1.5 0v-.906a5.51 5.51 0 0 1-2.006-.83l-.64.641a.75.75 0 1 1-1.06-1.06l.64-.641A5.511 5.511 0 0 1 2.656 8.75H1.75a.75.75 0 0 1 0-1.5h.906c.196-.74.46-1.41.83-2.006l-.641-.64a.75.75 0 1 1 1.06-1.06l.641.64A5.511 5.511 0 0 1 6.752 3.4V2.75A.75.75 0 0 1 8 1Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      )}
                      <button
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        onClick={() => removeWidget(widget.id)}
                        title="Remove widget"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                        </svg>
                      </button>
                      {openSettings === widget.id && (
                        <SettingsPopover
                          widget={widget}
                          onUpdate={updateWidget}
                          onClose={() => setOpenSettings(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
                {/* Widget body */}
                <div className="flex-1 overflow-y-auto">
                  <WidgetContent widget={widget} session={session} affineUrl={affineUrl} />
                </div>
              </div>
            );
          })}
        </GridLayout>}
      </div>
    </div>
  );
}
