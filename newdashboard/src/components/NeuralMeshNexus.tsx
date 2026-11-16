import React, { useState, useEffect } from 'react';

export const NeuralMeshNexus: React.FC = () => {
  const [agents, setAgents] = useState([
    { id: 'agent-1', model: 'deepseek-r1:671b', role: 'supreme-commander', status: 'active', latencyMs: 142, meshScore: 150 },
    { id: 'agent-2', model: 'llama3.3:70b', role: 'adversarial-auditor', status: 'active', latencyMs: 98, meshScore: 115 },
    { id: 'agent-3', model: 'qwen3-coder:30b', role: 'lead-engineer', status: 'active', latencyMs: 76, meshScore: 140 },
    { id: 'agent-4', model: 'codestral:22b', role: 'lead-engineer', status: 'idle', latencyMs: 110, meshScore: 135 },
    { id: 'agent-5', model: 'qwen2.5:72b', role: 'scout-specialist', status: 'active', latencyMs: 85, meshScore: 100 },
  ]);

  return (
    <div className="p-6 bg-slate-950 text-emerald-400 font-mono rounded-xl border border-emerald-900 shadow-2xl">
      <div className="flex justify-between items-center mb-6 border-b border-emerald-900/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-emerald-300">⚡ NEURAL MESH NEXUS // LEGION SWARM</h2>
          <p className="text-xs text-emerald-600">Active distributed model cluster mesh & map-reduce consensus nodes</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-block w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
          <span className="text-xs text-emerald-400 font-semibold">MESH ONLINE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-slate-900/80 border border-emerald-900/50 p-4 rounded-lg flex flex-col justify-between hover:border-emerald-500 transition-all">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold px-2 py-0.5 bg-emerald-950 text-emerald-300 rounded border border-emerald-800">{agent.role}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${agent.status === 'active' ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>{agent.status}</span>
              </div>
              <h3 className="text-sm font-semibold text-white tracking-wide">{agent.model}</h3>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between text-xs text-emerald-500">
              <div>LATENCY: <span className="text-emerald-300">{agent.latencyMs}ms</span></div>
              <div>SCORE: <span className="text-emerald-300">{agent.meshScore}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
