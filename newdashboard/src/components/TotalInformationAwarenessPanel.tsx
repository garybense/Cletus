import React, { useState } from 'react';
import { Terminal, Search, Activity, Cpu, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { useHomestead } from '@/lib/cletus/store';
import { formatAgo } from '@/lib/cletus/format';

export const TotalInformationAwarenessPanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('all');

  const vitals = useHomestead((s) => s.vitals);
  const thoughts = useHomestead((s) => s.thoughts);
  const logs = useHomestead((s) => s.logs);
  const tasks = useHomestead((s) => s.tasks);
  const goals = useHomestead((s) => s.goals);
  const heartbeats = useHomestead((s) => s.heartbeats);
  const children = useHomestead((s) => s.children);
  const now = useHomestead((s) => s.now);

  const filteredThoughts = thoughts.filter((t) => {
    const text = `${t.thinking || ''} ${t.speech || ''} ${(t.tools || []).join(' ')}`.toLowerCase();
    return searchQuery === '' || text.includes(searchQuery.toLowerCase());
  });

  const filteredLogs = logs.filter((l) => {
    const matchesLevel = filterSource === 'all' || l.level === filterSource;
    const matchesSearch = searchQuery === '' || l.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const filteredTasks = tasks.filter((t) => {
    const text = `${t.title} ${t.status} ${t.assignee || ''}`.toLowerCase();
    return searchQuery === '' || text.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="p-6 bg-card text-card-foreground font-mono rounded-xl border border-border shadow-sm space-y-6">
      {/* Header & Status */}
      <div className="flex flex-wrap justify-between items-center border-b border-border pb-4 gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            TOTAL INFORMATION AWARENESS (TIA) // UNIFIED OPERATOR INSPECTOR
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Complete real-time visibility across Agent Thoughts, System Logs, Task Graphs, Swarm Workers, and Heartbeat Streams.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 bg-secondary text-secondary-foreground border border-border rounded font-semibold">
            Model: {vitals.model}
          </span>
          <span className="px-2.5 py-1 bg-secondary text-secondary-foreground border border-border rounded font-semibold">
            State: {vitals.state}
          </span>
          <span className="px-2.5 py-1 bg-secondary text-secondary-foreground border border-border rounded font-semibold">
            Uptime: {Math.floor((now - vitals.startedAt) / 1000)}s
          </span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/40 p-4 rounded-lg border border-border">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Filter Log Severity</label>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="w-full bg-background border border-input rounded p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Severities (Info, Warn, Error)</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Search Content Across All Subsystems</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search thoughts, logs, tasks, tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-input rounded p-2 pl-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Grid: Thoughts & System Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Thought Traces */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Agent Thought Traces ({filteredThoughts.length})
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {filteredThoughts.map((t) => (
              <div key={t.id} className="bg-background border border-border p-3 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Thought Trace</span>
                  <span>{formatAgo(t.at, now)}</span>
                </div>
                <p className="text-foreground leading-relaxed">{t.thinking}</p>
                {t.speech && <p className="text-primary italic">Speech: "{t.speech}"</p>}
                {t.tools && t.tools.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {t.tools.map((tool) => (
                      <span key={tool} className="px-1.5 py-0.5 bg-muted text-muted-foreground border border-border rounded text-[10px] font-mono">
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* System Logs Stream */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-primary" />
            System Log Stream ({filteredLogs.length})
          </h3>
          <div className="bg-background border border-border p-3 rounded-lg max-h-80 overflow-y-auto font-mono text-xs space-y-1.5">
            {filteredLogs.map((l) => (
              <div key={l.id} className="flex space-x-2">
                <span className="text-muted-foreground text-[11px]">{formatAgo(l.at, now)}</span>
                <span className={`font-semibold uppercase text-[10px] ${
                  l.level === 'error' ? 'text-destructive' : l.level === 'warn' ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  [{l.level}]
                </span>
                <span className="text-muted-foreground">[{l.source}]</span>
                <span className="text-foreground">{l.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Task Graph & Swarm Worker Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-border">
        {/* Active Task Graph */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Task Graph Execution ({filteredTasks.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {filteredTasks.map((t) => (
              <div key={t.id} className="bg-background border border-border p-2.5 rounded text-xs flex justify-between items-center">
                <div>
                  <div className="font-semibold text-foreground">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground">Assigned: {t.assignee || 'Unassigned'}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  t.status === 'completed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                  t.status === 'running' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  'bg-secondary text-secondary-foreground border border-border'
                }`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Heartbeat Schedule & Worker Fleet */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            Durable Heartbeat Schedule ({heartbeats.length})
          </h3>
          <div className="bg-background border border-border p-3 rounded-lg max-h-60 overflow-y-auto space-y-2 text-xs">
            {heartbeats.map((hb) => (
              <div key={hb.name} className="flex justify-between items-center border-b border-border/60 pb-1.5 last:border-0">
                <span className="font-semibold text-foreground">{hb.name}</span>
                <div className="flex items-center space-x-2 text-[11px] text-muted-foreground">
                  <span>Every {hb.cadence || '5m'}</span>
                  <span className={`font-bold ${hb.ok ? 'text-emerald-500' : 'text-muted-foreground'}`}>{hb.ok ? 'ACTIVE' : 'IDLE'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
