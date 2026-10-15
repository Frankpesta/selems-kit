// Gentle settle on every page navigation: a template remounts on each
// navigation, so the CSS animation replays (transform only, no JavaScript).
// Fixed UI inside pages must be portalled out of this wrapper (see docs/03).
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="anim-page">{children}</div>;
}
