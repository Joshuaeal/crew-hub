"use client";

import {
  MATRIX_CHANNEL_BLUEPRINT,
  MATRIX_CLIENT_EXPERIENCE,
  MATRIX_VOICE_NOTE,
} from "@/lib/matrix-channel-structure";

export function MatrixChannelGuide() {
  return (
    <div className="space-y-4 text-sm text-slate-300">
      <p className="text-xs leading-relaxed text-slate-500">
        {MATRIX_VOICE_NOTE} Rooms are <strong className="text-slate-400">purpose-based</strong>, not
        person-based — keep voice channels for active work only.
      </p>
      <p className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-xs text-slate-400">
        <strong className="text-slate-300">Client experience:</strong> {MATRIX_CLIENT_EXPERIENCE.summary}
      </p>
      <div className="space-y-3">
        {MATRIX_CHANNEL_BLUEPRINT.map((cat) => (
          <details
            key={cat.id}
            className="group rounded-lg border border-white/10 bg-black/30 open:border-white/20"
          >
            <summary className="cursor-pointer list-none px-3 py-2 font-medium text-white marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="text-brand/90">{cat.title}</span>
              {cat.restricted && (
                <span className="ml-2 text-xs font-normal text-amber-200/80">(restricted)</span>
              )}
            </summary>
            {cat.blurb && <p className="px-3 pb-2 text-xs text-slate-500">{cat.blurb}</p>}
            <div className="space-y-3 border-t border-white/5 px-3 pb-3 pt-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Text</p>
                <ul className="mt-1 space-y-1.5">
                  {cat.text.map((t) => (
                    <li key={t.alias}>
                      <span className="font-mono text-brand/80">{t.title}</span>
                      {t.template && (
                        <span className="ml-1 text-xs text-amber-200/80">(per job)</span>
                      )}
                      <span className="text-slate-500"> — {t.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Voice</p>
                <ul className="mt-1 space-y-2">
                  {cat.voice.map((v) => (
                    <li key={v.alias}>
                      <span className="text-white">{v.name}</span>
                      <span className="text-slate-500"> — {v.description}</span>
                      <ul className="ml-3 mt-0.5 list-disc text-xs text-slate-500">
                        {v.useCases.map((u) => (
                          <li key={u}>{u}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
