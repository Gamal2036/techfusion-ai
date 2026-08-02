'use client';

export function Atmosphere() {
  return (
    <div aria-hidden="true" className="cmd-atmosphere">
      <div className="cmd-atmosphere__glow cmd-atmosphere__glow--top" />
      <div className="cmd-atmosphere__glow cmd-atmosphere__glow--accent" />
      <div className="cmd-atmosphere__glow cmd-atmosphere__glow--bottom" />
    </div>
  );
}
