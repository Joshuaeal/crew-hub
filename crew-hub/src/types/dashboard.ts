export type WidgetType = "upcoming" | "recent_jobs" | "my_shifts" | "quick_links" | "affine_workspace";

export type LookaheadWindow = "2wk" | "4wk" | "8wk" | "3mo" | "6mo";

export type WidgetPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type UpcomingSettings = {
  lookahead: LookaheadWindow;
};

export type RecentJobsSettings = {
  count: number;
};

export type MyShiftsSettings = {
  lookahead: LookaheadWindow;
};

export type QuickLinksSettings = Record<string, never>;

export type AffineWorkspaceSettings = Record<string, never>;

export type WidgetSettings = UpcomingSettings | RecentJobsSettings | MyShiftsSettings | QuickLinksSettings | AffineWorkspaceSettings;

export type WidgetInstance = {
  id: string;
  widget_type: WidgetType;
  position: WidgetPosition;
  settings: WidgetSettings;
};

export type DashboardLayout = {
  id: string;
  user_id: string;
  updated_at: string;
  widgets: WidgetInstance[];
};
