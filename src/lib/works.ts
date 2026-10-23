export type WorkStatus = "published" | "in-progress";

const STATUS_LABELS: Record<WorkStatus, string> = {
  published: "公開中",
  "in-progress": "制作中",
};

export const statusLabel = (status: WorkStatus): string => STATUS_LABELS[status];

export const sortWorks = <T extends { data: { order: number } }>(works: T[]): T[] => [...works].sort((a, b) => a.data.order - b.data.order);
