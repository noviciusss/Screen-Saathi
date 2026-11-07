export type SnapshotRect = [number, number, number, number];

export interface SnapshotElement {
  id: string;
  tag: string;
  role: string | null;
  type: string | null;
  name: string;
  hint: string | null;
  required: boolean;
  value: string;
  state: string[];
  rect: SnapshotRect;
  in_view: boolean;
  form: string | null;
  cross_origin_frame?: boolean;
  sensitive?: boolean;
  autocomplete?: string | null;
}

export interface SnapshotHeading {
  id: string;
  level: number;
  text: string;
}

export interface SnapshotTextBlock {
  id: string;
  text: string;
  in_view: boolean;
}

export interface SnapshotForm {
  id: string;
  fields: string[];
  submit: string | null;
}

export interface PageSnapshot {
  url_host: string;
  title: string;
  lang: string;
  viewport: {
    w: number;
    h: number;
    scrollY: number;
    scrollMax: number;
  };
  headings: SnapshotHeading[];
  elements: SnapshotElement[];
  text_blocks: SnapshotTextBlock[];
  forms: SnapshotForm[];
  flags: {
    has_canvas_content: boolean;
    is_pdf_viewer: boolean;
    truncated: boolean;
  };
  estimated_tokens: number;
}
