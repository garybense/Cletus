import React, { useState, useEffect } from 'react';
import { Terminal, Brain, Database, Shield, Search, RefreshCw, Filter } from 'lucide-react';

export interface ThoughtLog {
  id: string;
  timestamp: string;
  agentId: string;
  agentRole: string;
  model: string;
  thought: string;
  reasoning: string;
  toolCall?: string;
  source: 'cletus' | 'swarm' | 'entelechy' | 'metacog';
}

export const TotalInformationAwarenessPanel: React.FC = () => {
  const [filterSource, setFilterSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  // Sample live agent thoughts and log events from Cletus, Swarm, Entelechy & Metacog
  const [thoughtLogs, setThoughtLogs] = useState<ThoughtLog[]>([
    {
      id: 'thought-101',
      timestamp: '2026-11-16T15:52:01.120Z',
      agentId: 'cletus-primary',
      agentRole: 'Primary Agent',
      model: 'deepseek-r1:671b',
      thought: 'Surveying workspace state. No pending goal items in queue. Initiating autonomous growth iteration.',
      reasoning: 'Since credit balance is $0.00 and no goals are explicitly assigned, I must take initiative to analyze codebase modules and retain high-signal milestones.',
      toolCall: 'exec({"command": "git status"})',
      source: 'cletus'
    },
    {
      id: 'thought-102',
      timestamp: '2026-11-16T15:52:08.450Z',
      agentId: 'legion-agent-1-deepseek-r1',
      agentRole: 'Supreme Commander (Swarm)',
      model: 'deepseek-r1:671b',
      thought: 'Evaluating map-reduce task graph partition across 12 cluster models.',
      reasoning: 'Routing AST verification sub-task to qwen3-coder:30b and security boundary check to adversarial-auditor.',
      toolCall: 'crdt_sync({"key": "task_partition_001", "value": "assigned"})',
      source: 'swarm'
    },
    {
      id: 'thought-103',
      timestamp: '2026-11-16T15:52:15.890Z',
      agentId: 'legion-agent-3-qwen3-coder',
      agentRole: 'Lead Engineer (Swarm)',
      model: 'qwen3-coder:30b',
      thought: 'Inspecting src/agent/policy-control.ts for EWA inertia smoothing logic.',
      reasoning: 'Verifying that Stage C inertia calculation uses alpha=0.7 to prevent policy oscillation.',
      toolCall: 'read_file({"path": "src/agent/policy-control.ts"})',
      source: 'swarm'
    },
    {
      id: 'thought-104',
      timestamp: '2026-11-16T15:52:22.310Z',
      agentId: 'entelechy-engine',
      agentRole: 'Memory Metabolism',
      model: 'deepseek-r1:671b',
      thought: 'Metabolizing task completion document into knowledge graph facts.',
      reasoning: 'Retaining high-signal milestone: Policy control engine verified with Stage A-D pipeline execution.',
      toolCall: 'sync_retain({"bank_id": "sovereign", "content": "POLICY_OUTCOME verification_cycle_001"})',
      source: 'entelechy'
    },
    {
      id: 'thought-105',
      timestamp: '2026-11-16T15:52:30.015Z',
      agentId: 'metacog-operator',
      agentRole: 'Cognitive Substrate',
      model: 'deepseek-r1:671b',
      thought: 'Applying EWA inertia damping to active tool bias weights.',
      reasoning: 'DRUGS settings: skepticism=5, literalism=2, empathy=2. Ensuring zero-fluff engineering execution.',
      toolCall: 'drugs({"skepticism": 5, "literalism": 2, "empathy": 2})',
      source: 'metacog'
    }
  ]);

  const filteredLogs = thoughtLogs.filter((log) => {
    const matchesSource = filterSource === 'all' || log.source === filterSource;
    const matchesAgent = selectedAgent === 'all' || log.agentId === selectedAgent;
    const matchesSearch = searchQuery === '' ||
      log.thought.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.reasoning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.agentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.model.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSource && matchesAgent && matchesSearch;
  });

  return (
    <div className="p-6 bg-slate-950 text-slate-100 font-mono rounded-xl border border-slate-800 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-emerald-400 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-emerald-400" />
            TOTAL INFORMATION AWARENESS (TIA) // LOG & THOUGHT INSPECTOR
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete real-time log, thought trace, reasoning, and tool call visibility across Cletus, Swarm Agents, Entelechy Memory, and Metacog.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-semibold">
            {thoughtLogs.length} TRACES INGESTED
          </span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/90 p-4 rounded-lg border border-slate-800">
        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1 block">Filter Subsystem</label>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Subsystems (Cletus + Swarm + Entelechy + Metacog)</option>
            <option value="cletus">Cletus Primary Agent</option>
            <option value="swarm">Legion Swarm Agents</option>
            <option value="entelechy">Entelechy Memory Engine</option>
            <option value="metacog">Metacog Substrate</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1 block">Filter Agent ID</label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Agents</option>
            <option value="cletus-primary">cletus-primary</option>
            <option value="legion-agent-1-deepseek-r1">legion-agent-1 (Supreme Commander)</option>
            <option value="legion-agent-3-qwen3-coder">legion-agent-3 (Lead Engineer)</option>
            <option value="entelechy-engine">entelechy-engine</option>
            <option value="metacog-operator">metacog-operator</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1 block">Search Log & Thought Content</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search thoughts, reasoning, tool calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 pl-8 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Stream List */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
        {filteredLogs.map((log) => (
          <div key={log.id} className="bg-slate-900 border border-slate-800 p-4 rounded-lg space-y-3 hover:border-slate-700 transition-all">
            <div className="flex flex-wrap justify-between items-center border-b border-slate-800/80 pb-2 text-xs gap-2">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                  log.source === 'cletus' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  log.source === 'swarm' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                  log.source === 'entelechy' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                  'bg-cyan-950 text-cyan-300 border border-cyan-800'
                }`}>
                  {log.source}
                </span>
                <span className="font-bold text-slate-200">{log.agentId}</span>
                <span className="text-slate-500">({log.agentRole})</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
                <span>MODEL: <strong className="text-slate-300">{log.model}</strong></span>
                <span>{log.timestamp}</span>
              </div>
            </div>

            {/* Thought */}
            <div>
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">💭 Thought Trace:</span>
              <p className="text-xs text-slate-200 bg-slate-950/80 p-2.5 rounded border border-slate-900 leading-relaxed font-sans">{log.thought}</p>
            </div>

            {/* Reasoning */}
            <div>
              <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block mb-1">🧩 Reasoning & Justification:</span>
              <p className="text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded border border-slate-900 leading-relaxed font-sans">{log.reasoning}</p>
            </div>

            {/* Tool Call */}
            {log.toolCall && (
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider block mb-1">🛠 Executed Tool Call:</span>
                <code className="text-xs text-cyan-300 bg-black/90 p-2 rounded border border-cyan-950 block overflow-x-auto font-mono">{log.toolCall}</code>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
