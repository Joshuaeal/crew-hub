import React from "react";

export default function ElementWebEmbedSimple() {
  // Element Web client at localhost:8088 uses itself as homeserver for login
  const elementWebUrl =
    "http://localhost:8088/?homeserverUrl=http://localhost:8088#/room/#gmmdUBdYvZaLmBzCDe:localhost";

  return (
    <div className="min-h-0 flex-1 flex items-center justify-center bg-black/40">
      <iframe
        src={elementWebUrl}
        className="h-full w-full"
        title="Element Web"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        allow="clipboard-read; clipboard-write; fullscreen; microphone; camera"
      />
    </div>
  );
}
