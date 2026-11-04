export default function TemporalEmblem() {
  return (
    <div className="portalEmblem" aria-hidden="true">
      <svg viewBox="0 0 200 140" fill="none">
        <ellipse className="portalOuter" cx="100" cy="70" rx="86" ry="34" transform="rotate(-25 100 70)" />
        <ellipse className="portalInner" cx="100" cy="70" rx="70" ry="49" transform="rotate(20 100 70)" />
        <circle className="portalCore" cx="100" cy="70" r="38" />
        <g className="portalLetter" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="76" y="53" width="48" height="34" rx="7" />
          <path d="m79 57 21 17 21-17M78 83l13-12m18 0 13 12" />
        </g>
        <circle className="portalDot" cx="165" cy="32" r="4" />
        <circle className="portalDotSmall" cx="36" cy="104" r="2.5" />
      </svg>
    </div>
  );
}
