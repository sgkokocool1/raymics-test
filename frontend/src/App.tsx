import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Browse from './pages/Browse';
import Detail from './pages/Detail';
import Pipeline from './pages/Pipeline';
import Annotation from './pages/Annotation';
import Assets from './pages/Assets';
import Tags from './pages/Tags';
import Search from './pages/Search';
import Datasets from './pages/Datasets';
import Training from './pages/Training';
import Arch from './pages/Arch';

const NAV = [
  { group: '概览', items: [{ to: '/', icon: '📊', label: '总览看板', end: true }] },
  { group: '数据', items: [
    { to: '/browse', icon: '🗂️', label: '数据浏览筛选' },
    { to: '/pipeline', icon: '⚙️', label: '清洗 · 预处理' },
    { to: '/annotation', icon: '✏️', label: '标注工作台' },
    { to: '/assets', icon: '💎', label: '数据资产' },
    { to: '/tags', icon: '🏷️', label: '标签管理' },
    { to: '/search', icon: '🔎', label: '检索中心' },
  ] },
  { group: '训练', items: [
    { to: '/datasets', icon: '📦', label: '数据集' },
    { to: '/training', icon: '🚀', label: '训练任务' },
  ] },
  { group: '设计', items: [{ to: '/arch', icon: '🧩', label: '架构 · 流程图' }] },
];

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo"><span className="dot">具</span> 具身数据平台</div>
        {NAV.map((g, gi) => (
          <div key={gi}>
            <div className="nav-group">{g.group}</div>
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={(it as { end?: boolean }).end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="ic">{it.icon}</span> {it.label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/episodes/:id" element={<Detail />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/annotation" element={<Annotation />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/tags" element={<Tags />} />
          <Route path="/search" element={<Search />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/training" element={<Training />} />
          <Route path="/arch" element={<Arch />} />
        </Routes>
      </main>
    </div>
  );
}
