import React from 'react';

export const EvolutionTerminal: React.FC = () => {
  const logs = [
    { id: 1, time: '22:42:01', type: 'INFO', msg: '[ACTIVE-EVOLUTION] Starting Active Code Mutation Cycle #1 (Health: 100/100)...' },
    { id: 2, time: '22:42:05', type: 'INFO', msg: '[ACTIVE-EVOLUTION] Auditing src/ modules for refactoring and feature additions...' },
    { id: 3, time: '22:42:08', type: 'INFO', msg: '[ACTIVE-EVOLUTION] Auto-committed, merged, and pushed autonomous feature mutation for Cycle #1 to git upstream!' },
    { id: 4, time: '22:42:12', type: 'INFO', msg: '[LOG-MONITOR] [LOG-MONITOR SELF-HEALING]: Detected and resolved 63 log anomalies.' },
    { id: 5, time: '22:42:25', type: 'SUCCESS', msg: '[ACTIVE-EVOLUTION] Cycle #1 complete. System actively self-improving and committing code!' },
  ];

  return (
    <div className="p-6 bg-slate-950 text-purple-400 font-mono rounded-xl border border-purple-900 shadow-2xl">
      <div className="flex justify-between items-center mb-6 border-b border-purple-900/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-purple-300">🧬 SELF-HEALING EVOLUTION TERMINAL</h2>
          <p className="text-xs text-purple-600">Autonomous AST refactoring, test execution & upstream git auto-commit stream</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-block w-3 h-3 bg-purple-500 rounded-full animate-ping"></span>
          <span className="text-xs text-purple-400 font-semibold">MUTATING ACTIVE</span>
        </div>
      </div>

      <div className="bg-black/80 border border-purple-950 p-4 rounded-lg h-64 overflow-y-auto text-xs space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="flex space-x-3">
            <span className="text-purple-600">[{log.time}]</span>
            <span className={`font-bold ${log.type === 'SUCCESS' ? 'text-emerald-400' : 'text-purple-300'}`}>{log.type}</span>
            <span className="text-slate-300">{log.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
