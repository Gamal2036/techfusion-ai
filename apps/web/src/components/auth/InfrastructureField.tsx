const FLOW_FAST = 'tf-signal-flow 8s linear infinite';
const FLOW_MED = 'tf-signal-flow 12s linear infinite';
const FLOW_SLOW = 'tf-signal-flow 16s linear infinite';

export function InfrastructureField() {
  return (
    <svg
      viewBox="0 0 720 560"
      preserveAspectRatio="xMidYMid slice"
      className="tf-env-animate h-full w-full"
      focusable="false"
    >
      <defs>
        <pattern id="tf-dot-grid" width="96" height="96" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="1" className="fill-border/30" />
        </pattern>
      </defs>

      <g opacity="0.5">
        <rect
          x="0"
          y="0"
          width="720"
          height="560"
          fill="url(#tf-dot-grid)"
          opacity="0.35"
        />
      </g>

      {/* structural geometry — engineering frame */}
      <g strokeWidth="1" opacity="0.55" className="text-border-strong">
        <path
          d="M 90 130 L 182 130 L 182 258 L 90 258 Z"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.5"
        />
        <path
          d="M 150 258 L 150 380"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.5"
        />
        <path
          d="M 72 84 L 292 84"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.5"
        />
        <path
          d="M 64 398 L 64 84"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.5"
        />
        <path
          d="M 64 398 L 320 398"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.5"
        />
        <path
          d="M 292 84 L 292 130 L 182 130"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.5"
        />
      </g>

      {/* calibration frame */}
      <g opacity="0.75">
        <path
          d="M 34 488 L 686 488"
          stroke="currentColor"
          className="text-border/40"
        />
        <path
          d="M 34 488 L 34 446"
          stroke="currentColor"
          className="text-border/40"
        />
        <path
          d="M 686 488 L 686 446"
          stroke="currentColor"
          className="text-border/40"
        />
        <path
          d="M 360 488 L 360 470"
          stroke="currentColor"
          className="text-border-strong/50"
        />
        <path
          d="M 244 488 L 244 470"
          stroke="currentColor"
          className="text-border-strong/35"
        />
        <path
          d="M 476 488 L 476 470"
          stroke="currentColor"
          className="text-border-strong/35"
        />
        <path
          d="M 128 488 L 128 478"
          stroke="currentColor"
          className="text-border/30"
        />
        <path
          d="M 592 488 L 592 478"
          stroke="currentColor"
          className="text-border/30"
        />
        <path
          d="M 328 488 L 328 476"
          stroke="currentColor"
          className="text-border/25"
        />
        <path
          d="M 392 488 L 392 476"
          stroke="currentColor"
          className="text-border/25"
        />
      </g>

      {/* reasoning path — quiet structural line, no active signal */}
      <path
        d="M 196 300 L 420 300"
        fill="none"
        stroke="currentColor"
        className="text-border-strong/40"
      />
      <path
        d="M 420 300 L 420 388 L 578 388"
        fill="none"
        stroke="currentColor"
        className="text-border-strong/40"
      />
      <path
        d="M 578 388 L 578 446"
        fill="none"
        stroke="currentColor"
        className="text-border-strong/50"
      />
      <path
        d="M 420 300 m -4 4 l 8 0 m -4 -4 l 0 8"
        fill="none"
        stroke="currentColor"
        className="text-primary/45"
      />

      {/* dormant operational paths */}
      <g className="text-border/30">
        <path
          d="M 420 300 L 486 300 L 486 446"
          fill="none"
          stroke="currentColor"
        />
        <path
          d="M 420 300 L 420 222 L 196 222 L 196 130"
          fill="none"
          stroke="currentColor"
        />
      </g>

      {/* convergence network — routes bend toward the hand-off region (core corridor) */}
      <g className="text-border/25">
        <path
          d="M 148 396 L 148 340 L 320 340 L 320 236 L 470 236"
          fill="none"
          stroke="currentColor"
        />
        <path
          d="M 470 236 L 470 300"
          fill="none"
          stroke="currentColor"
        />
        <path
          d="M 588 388 L 500 388 L 500 300"
          fill="none"
          stroke="currentColor"
        />
        <path
          d="M 500 300 L 470 300"
          fill="none"
          stroke="currentColor"
        />
      </g>

      {/* active signal A — leaves a dormant node, climbs and routes right */}
      <g>
        <path
          d="M 148 396 L 148 300 L 420 300"
          fill="none"
          stroke="currentColor"
          className="tf-env-animate text-primary/45"
          strokeWidth="1.5"
          strokeDasharray="2 6"
          style={{ animation: FLOW_MED }}
        />
      </g>

      {/* active signal C — quiet traffic along the lower route */}
      <g>
        <path
          d="M 420 300 L 486 300 L 486 446"
          fill="none"
          stroke="currentColor"
          className="tf-env-animate text-primary/30"
          strokeWidth="1.5"
          strokeDasharray="2 7"
          style={{ animation: FLOW_SLOW }}
        />
      </g>

      {/* convergence signal — dormant until the console is attended */}
      <g
        className="tf-converge tf-env-animate text-primary/45"
        strokeWidth="1.5"
        strokeDasharray="2 6"
      >
        <path
          d="M 470 300 L 470 388 L 578 388"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.9"
        />
      </g>

      {/* node anchors */}
      <g className="fill-border/60">
        <rect x="178" y="130" width="8" height="8" />
        <rect x="282" y="130" width="8" height="8" />
        <rect x="402" y="130" width="8" height="8" />
        <rect x="466" y="222" width="8" height="8" />
        <rect x="512" y="300" width="8" height="8" />
        <rect x="588" y="388" width="8" height="8" />
        <rect x="148" y="222" width="8" height="8" />
        <rect x="148" y="390" width="8" height="8" />
      </g>
      <g className="fill-primary/50">
        <rect x="398" y="298" width="12" height="12" />
        <rect x="572" y="386" width="12" height="12" />
        <rect x="578" y="442" width="12" height="12" />
      </g>

      {/* reasoning field */}
      <g opacity="0.8">
        <path
          d="M 112 320 L 112 288 L 128 288"
          fill="none"
          stroke="currentColor"
          className="text-border-strong/30"
        />
        <path
          d="M 112 334 L 112 348"
          fill="none"
          stroke="currentColor"
          className="text-border-strong/30"
        />
        <path
          d="M 96 334 L 128 334"
          fill="none"
          stroke="currentColor"
          className="text-border-strong/30"
        />
      </g>

      {/* calibration arc */}
      <g opacity="0.7">
        <path
          d="M 560 470 a 64 64 0 0 1 58 -46"
          fill="none"
          stroke="currentColor"
          className="text-border-strong/40"
        />
        <path
          d="M 592 452 l 6 -3 M 601 448 l 6 -3"
          fill="none"
          stroke="currentColor"
          className="text-border-strong/30"
        />
      </g>

      {/* horizon signal — light leaves the environment toward the console */}
      <g opacity="0.7">
        <path
          d="M 272 446 L 388 446"
          stroke="currentColor"
          className="text-border/30"
        />
        <path
          d="M 388 446 L 436 446"
          fill="none"
          stroke="currentColor"
          className="text-primary/45"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <path
          d="M 272 446 L 388 446"
          fill="none"
          stroke="currentColor"
          className="tf-env-animate text-primary/45"
          strokeWidth="1.5"
          strokeDasharray="2 6"
          style={{ animation: FLOW_FAST }}
        />
        <path
          d="M 388 446 L 436 446"
          fill="none"
          stroke="currentColor"
          className="text-primary/45"
          strokeWidth="1.5"
          strokeDasharray="2 6"
          style={{ animation: FLOW_FAST }}
        />
        <path
          d="M 436 446 L 640 446"
          fill="none"
          stroke="currentColor"
          className="text-border/25"
          strokeWidth="1"
        />
        <rect x="632" y="444" width="8" height="8" className="fill-border/40" />
      </g>
    </svg>
  );
}
