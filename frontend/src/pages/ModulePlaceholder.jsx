import { ArrowUpRight, Construction } from 'lucide-react';

export function ModulePlaceholder({ title, description }) {
  return (
    <div className="module-intro">
      <div className="eyebrow">QFA WORKSPACE / MODULE</div>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="migration-note">
        <span className="migration-icon"><Construction size={21}/></span>
        <div><strong>Migration in progress</strong><p>This module is mapped in the React application. Its existing workflows will be migrated and validated against the current QFA implementation before it replaces the production page.</p></div>
        <ArrowUpRight size={18}/>
      </div>
    </div>
  );
}