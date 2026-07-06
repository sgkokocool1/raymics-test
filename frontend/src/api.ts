const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json();
}

export interface Episode {
  episode_id: string; project: string; batch: string; source: string; scene: string;
  task: string; object: string; robot: string; status: string; duration: number; fps: number;
  frames: number; cameras: number; modalities: string[]; action_dim: number; quality_score: number;
  quality_grade: string; success: boolean; collected_by: string; device: string;
  collected_at: string; size_gb: number; tags: string[]; version: number;
  relevance?: number;
}
export interface EpisodeDetail extends Episode {
  signals: { joint_0: number[]; joint_1: number[]; gripper: number[] };
  subtasks: { name: string; start: number; end: number }[];
}
export interface Stats {
  total: number; totalHours: number; totalSize: number; assetCount: number; successCount: number;
  bySource: Record<string, number>; byScene: Record<string, number>; byTask: Record<string, number>;
  byRobot: Record<string, number>; byStatus: Record<string, number>; byGrade: Record<string, number>;
  byUser: Record<string, number>; byDevice: Record<string, number>; tagCount: Record<string, number>;
  trend: { month: string; count: number }[]; funnel: { stage: string; value: number }[];
  flywheel: { round: string; data: number; success: number }[];
}
export interface Meta { statusFlow: { key: string; label: string }[]; scenes: string[]; tasks: string[]; robots: string[]; sources: string[]; grades: string[]; }
export interface Dataset { id: string; name: string; episodes: number; hours: number; version: number; format: string; splits: { train: number; val: number; test: number }; status: string; tags: string[]; }
export interface TrainingJob { id: string; name: string; dataset: string; policy: string; status: string; progress: number; success_rate: number; gpu: string; }
export interface Pipeline { jobs: { id: string; type: string; target: string; status: string; count: number }[]; cleanRules: { rule: string; count: number }[]; }
export interface AnnoTask { id: string; episode: string; type: string; assignee: string; status: string; progress: number; }
export interface SearchResult { total: number; items: Episode[]; facets: Record<string, Record<string, number>>; }

export const api = {
  stats: () => get<Stats>('/stats'),
  meta: () => get<Meta>('/meta'),
  episodes: (params: Record<string, string | number>) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)]));
    return get<{ total: number; page: number; size: number; items: Episode[] }>(`/episodes?${q}`);
  },
  episode: (id: string) => get<EpisodeDetail>(`/episodes/${id}`),
  search: (tags: string[], q: string, semantic: boolean) => {
    const p = new URLSearchParams({ tags: tags.join(','), q, semantic: String(semantic) });
    return get<SearchResult>(`/search?${p}`);
  },
  datasets: () => get<Dataset[]>('/datasets'),
  training: () => get<TrainingJob[]>('/training'),
  pipeline: () => get<Pipeline>('/pipeline'),
  annotations: () => get<AnnoTask[]>('/annotations'),
  tags: () => get<{ tagCount: Record<string, number> }>('/tags'),
};

export const STATUS_LABEL: Record<string, string> = {
  uploaded: '已上传', scanned: '已入库', raw: '原始待处理', cleaning: '清洗中', preprocessed: '已预处理',
  annotating: '标注中', annotated: '已标注', asset: '数据资产', in_dataset: '已进数据集', training: '训练中', archived: '归档',
};
