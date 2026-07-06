import { TopBar } from '../components/ui';
import { Mermaid } from '../components/Mermaid';

const M = {
  flow: `flowchart LR
  C["原始采集"] --> U["上传存储"] --> S["扫描入库"] --> B["展示筛选"] --> CL["清洗"]
  CL --> PP["预处理"] --> AN["标注"] --> AS["数据资产"] --> TG["打标签"] --> DS["数据集"] --> TR["训练"]
  TR -. 指标回流(飞轮) .-> C
  CL -. 低质隔离 .-> Q["隔离"]
  AN -. 驳回 .-> R["废弃"]`,
  state: `stateDiagram-v2
  [*] --> uploaded
  uploaded --> scanned
  scanned --> raw
  raw --> cleaning
  cleaning --> preprocessed
  cleaning --> quarantined: 低质
  preprocessed --> annotating
  annotating --> annotated
  annotating --> rejected: 驳回
  annotated --> asset
  asset --> in_dataset
  in_dataset --> training
  training --> archived
  archived --> [*]`,
  search: `flowchart LR
  Q[查询] --> R{路由}
  R -->|结构化/全文| ES[(ES 倒排/分面)]
  R -->|语义| VEC[(向量库)]
  ES --> M[融合重排] --> L[命中列表]
  VEC --> M
  M --> F[分面下钻]`,
  arch: `flowchart TB
  L0["采集端: 真机/无本体/仿真/导入"] --> L1["存储底座: 对象存储 + 热缓存"]
  L1 --> L2["数据湖: Iceberg/Paimon + Parquet"]
  L2 --> L3["元数据/索引: PG + ES + 向量库 + 图库"]
  L3 --> L4["计算处理: Spark/Ray/Flink + 质检/6D/预标注"]
  L4 --> L5["服务层: 入库/元数据/标注/检索/统计/训练编排"]
  L5 --> L6["应用层: 看板/浏览/标注/资产/数据集/检索"]`,
  er: `erDiagram
  Project ||--o{ Batch : has
  Batch ||--o{ Episode : contains
  Episode ||--o{ Annotation : has
  Episode ||--o{ QualityReport : has
  Episode ||--o{ AssetVersion : versions
  Episode }o--o{ Tag : tagged
  Dataset }o--o{ AssetVersion : includes
  TrainingJob }o--|| Dataset : uses`,
};

export default function Arch() {
  return (
    <>
      <TopBar title="架构 · 流程图" sub="平台分层架构 / 全生命周期流程 / 状态机 / 数据模型 / 检索链路" />
      <div className="card" style={{ marginBottom: 16 }}><h3>全生命周期数据流转</h3><Mermaid chart={M.flow} /></div>
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card"><h3>生命周期状态机</h3><Mermaid chart={M.state} /></div>
        <div className="card"><h3>混合检索链路</h3><Mermaid chart={M.search} /></div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}><h3>平台分层架构</h3><Mermaid chart={M.arch} /></div>
      <div className="card"><h3>数据模型 (ER)</h3><Mermaid chart={M.er} /></div>
    </>
  );
}
