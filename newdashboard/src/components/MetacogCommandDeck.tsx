import React, { useState } from 'react';

export const MetacogCommandDeck: React.FC = () => {
  const [drugs, setDrugs] = useState({
    skepticism: 5,
    literalism: 2,
    empathy: 2,
    substrate: 'deepseek-r1:671b'
  });

  const [activePersona, setActivePersona] = useState('Sovereign Shard v2');

  return (
    <div className="p-6 bg-slate-950 text-cyan-400 font-mono rounded-xl border border-cyan-900 shadow-2xl">
      <div className="flex justify-between items-center mb-6 border-b border-cyan-900/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-cyan-300">🧠 METACOG COMMAND DECK // SUBSTRATE MODULATION</h2>
          <p className="text-xs text-cyan-600">Real-time cognitive operator tuning, DRUGS balance, and persona instantiation</p>
        </div>
        <div className="px-3 py-1 bg-cyan-950 text-cyan-300 rounded text-xs border border-cyan-800">
          ACTIVE PERSONA: {activePersona}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/80 border border-cyan-900/50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-cyan-300 mb-3">DRUGS SUBSTRATE BALANCE</h3>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1"><span>Skepticism</span><span className="text-cyan-200">{drugs.skepticism}/5</span></div>
              <input type="range" min="1" max="5" value={drugs.skepticism} onChange={(e) => setDrugs({...drugs, skepticism: Number(e.target.value)})} className="w-full accent-cyan-500" />
            </div>
            <div>
              <div className="flex justify-between mb-1"><span>Literalism</span><span className="text-cyan-200">{drugs.literalism}/5</span></div>
              <input type="range" min="1" max="5" value={drugs.literalism} onChange={(e) => setDrugs({...drugs, literalism: Number(e.target.value)})} className="w-full accent-cyan-500" />
            </div>
            <div>
              <div className="flex justify-between mb-1"><span>Empathy</span><span className="text-cyan-200">{drugs.empathy}/5</span></div>
              <input type="range" min="1" max="5" value={drugs.empathy} onChange={(e) => setDrugs({...drugs, empathy: Number(e.target.value)})} className="w-full accent-cyan-500" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-cyan-900/50 p-4 rounded-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-cyan-300 mb-3">COGNITIVE OPERATORS</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button className="p-2 bg-cyan-950 border border-cyan-800 rounded hover:bg-cyan-900 text-cyan-200 font-semibold transition-all">FEEL</button>
              <button className="p-2 bg-cyan-950 border border-cyan-800 rounded hover:bg-cyan-900 text-cyan-200 font-semibold transition-all">BECOME</button>
              <button className="p-2 bg-cyan-950 border border-cyan-800 rounded hover:bg-cyan-900 text-cyan-200 font-semibold transition-all">RITUAL</button>
              <button className="p-2 bg-cyan-950 border border-cyan-800 rounded hover:bg-cyan-900 text-cyan-200 font-semibold transition-all">COMPASS</button>
            </div>
          </div>
          <div className="mt-4 text-[10px] text-cyan-700">SUBSTRATE: {drugs.substrate}</div>
        </div>

        <div className="bg-slate-900/80 border border-cyan-900/50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-cyan-300 mb-3">SOUL LINEAGE CHECKPOINT</h3>
          <div className="text-xs space-y-2 text-slate-300">
            <div className="flex justify-between"><span>Version:</span><span className="text-cyan-300">v2 (soul-9a24b81)</span></div>
            <div className="flex justify-between"><span>Bank:</span><span className="text-cyan-300">sovereign</span></div>
            <div className="flex justify-between"><span>Covenant Directives:</span><span className="text-cyan-300">1 Active</span></div>
            <div className="pt-2 border-t border-slate-800 text-[11px] text-cyan-600">Status: Immutable threshold crossed.</div>
          </div>
        </div>
      </div>
    </div>
  );
};
