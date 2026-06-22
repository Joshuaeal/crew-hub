import type { LookaheadWindow, WidgetInstance, WidgetType } from "@/types/dashboard";

export type WidgetMeta = {
  widget_type: WidgetType;
  displayName: string;
  defaultSize: { w: number; h: number };
  defaultSettings: Record<string, unknown>;
  settingsFields: SettingsField[];
  requiredPermission?: string;
};

export type SettingsField =
  | { key: string; label: string; type: "select"; options: { label: string; value: string }[] }
  | { key: string; label: string; type: "number"; min?: number; max?: number };

export const LOOKAHEAD_OPTIONS: { label: string; value: LookaheadWindow }[] = [
  { label: "2 weeks", value: "2wk" },
  { label: "4 weeks", value: "4wk" },
  { label: "8 weeks", value: "8wk" },
  { label: "3 months", value: "3mo" },
  { label: "6 months", value: "6mo" },
];

export const WIDGET_REGISTRY: WidgetMeta[] = [
  {
    widget_type: "upcoming",
    displayName: "Upcoming",
    defaultSize: { w: 8, h: 8 },
    defaultSettings: { lookahead: "4wk" },
    settingsFields: [
      {
        key: "lookahead",
        label: "Lookahead window",
        type: "select",
        options: LOOKAHEAD_OPTIONS,
      },
    ],
  },
  {
    widget_type: "recent_jobs",
    displayName: "Recent Jobs",
    defaultSize: { w: 4, h: 8 },
    defaultSettings: { count: 5 },
    settingsFields: [
      { key: "count", label: "Number of jobs", type: "number", min: 1, max: 20 },
    ],
  },
  {
    widget_type: "my_shifts",
    displayName: "My Shifts",
    defaultSize: { w: 6, h: 6 },
    defaultSettings: { lookahead: "4wk" },
    settingsFields: [
      {
        key: "lookahead",
        label: "Lookahead window",
        type: "select",
        options: LOOKAHEAD_OPTIONS,
      },
    ],
  },
  {
    widget_type: "quick_links",
    displayName: "Quick Links",
    defaultSize: { w: 8, h: 10 },
    defaultSettings: {},
    settingsFields: [],
  },
  {
    widget_type: "affine_workspace",
    displayName: "Workspace (AFFiNE)",
    defaultSize: { w: 8, h: 14 },
    defaultSettings: {},
    settingsFields: [],
    requiredPermission: "affine_workspace",
  },
];

export function getWidgetMeta(type: WidgetType): WidgetMeta {
  return WIDGET_REGISTRY.find((w) => w.widget_type === type)!;
}

export const DEFAULT_WIDGETS: WidgetInstance[] = [
  {
    id: "default-quick-links",
    widget_type: "quick_links",
    position: { x: 0, y: 0, w: 8, h: 8 },
    settings: {},
  },
  {
    id: "default-recent-jobs",
    widget_type: "recent_jobs",
    position: { x: 8, y: 0, w: 4, h: 8 },
    settings: { count: 5 },
  },
  {
    id: "default-upcoming",
    widget_type: "upcoming",
    position: { x: 0, y: 8, w: 12, h: 7 },
    settings: { lookahead: "4wk" },
  },
];
