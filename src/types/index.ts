export interface ScoreChild {
  title: string;
  author: string;
  modified: string;
}

export interface ScoreRow {
  title: string;
  author: string;
  modified: string;
  expanded?: boolean;
  children?: ScoreChild[];
}

export type VersionTone = "active" | "draft" | "ok" | "info";

export interface Version {
  name: string;
  detail: string;
  tone: VersionTone;
  icon?: string;
}

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
}

export interface MenuSection {
  title: string;
  icon?: React.ReactNode;
  items: MenuItem[];
}

export interface StatusItem {
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
}
