/** Original code-native ATOX artwork. No remote assets or raster effects. */
// Keep server and browser SVG attributes identical across math implementations.
const coordinate = (value: number) => Number(value.toFixed(3));

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 3H10C10 9 13 12 16 12C19 12 22 9 22 3H29V10C23 10 20 13 20 16C20 19 23 22 29 22V29H22C22 23 19 20 16 20C13 20 10 23 10 29H3V22C9 22 12 19 12 16C12 13 9 10 3 10V3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function OrbitalArt({
  className = "",
  variant = "sphere",
}: {
  className?: string;
  variant?: "sphere" | "flow";
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 720 720"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth=".75" opacity=".75">
        {variant === "sphere" ? (
          <>
            {[235, 249, 281, 298].map((r, i) => (
              <circle
                key={r}
                cx="360"
                cy="352"
                r={r}
                opacity={i === 0 ? 0.9 : 0.24}
              />
            ))}
            <g transform="rotate(-27 360 352)">
              {[42, 84, 131, 180, 222].map((rx) => (
                <ellipse
                  key={rx}
                  cx="360"
                  cy="352"
                  rx={rx}
                  ry="235"
                  opacity=".65"
                />
              ))}
              {[-176, -116, -55, 0, 55, 116, 176].map((dy) => (
                <ellipse
                  key={dy}
                  cx="360"
                  cy={352 + dy}
                  rx={coordinate(Math.sqrt(235 * 235 - dy * dy))}
                  ry={coordinate(39 - Math.abs(dy) / 9)}
                  opacity=".55"
                />
              ))}
            </g>
            <ellipse
              cx="360"
              cy="352"
              rx="329"
              ry="97"
              transform="rotate(-27 360 352)"
            />
            <ellipse
              cx="360"
              cy="352"
              rx="314"
              ry="118"
              transform="rotate(32 360 352)"
              opacity=".36"
            />
            {Array.from({ length: 11 }, (_, i) => (
              <path
                key={i}
                d={`M 424 ${150 + i * 8} C 533 ${30 + i * 8}, 642 ${88 + i * 8}, 661 ${226 + i * 8} S 668 ${475 + i * 5}, 592 ${556 + i * 4}`}
                opacity=".43"
              />
            ))}
            {Array.from({ length: 60 }, (_, i) => {
              const a = (i * Math.PI) / 30;
              return (
                <path
                  key={i}
                  d={`M${coordinate(360 + Math.cos(a) * 307)},${coordinate(352 + Math.sin(a) * 307)} l${coordinate(Math.cos(a) * (i % 5 ? 3 : 9))},${coordinate(Math.sin(a) * (i % 5 ? 3 : 9))}`}
                  opacity=".45"
                />
              );
            })}
            <path
              d="M51 118H158M105 64V172M555 553H661M608 500V606"
              opacity=".3"
            />
            <circle cx="360" cy="352" r="31" fill="var(--bg,#090a0a)" />
            <path
              d="M345 352H375M360 337V367"
              stroke="var(--accent,#ff665c)"
              strokeWidth="1.5"
            />
            <path
              d="M92 506H38Q18 506 18 526V552H158M97 514H48Q28 514 28 534V561H167"
              opacity=".5"
            />
          </>
        ) : (
          <>
            {Array.from({ length: 27 }, (_, i) => (
              <ellipse
                key={i}
                cx="370"
                cy="351"
                rx={285 - i * 2.5}
                ry={210 - i * 2.5}
                transform={`rotate(${coordinate(i * 5.4 - 43)} 370 351)`}
                opacity={i % 3 ? 0.4 : 0.85}
              />
            ))}
            <circle cx="370" cy="351" r="292" opacity=".25" />
            <path d="M61 351H675M370 48V656" opacity=".2" />
            <path
              d="M311 351H429M370 292V410"
              stroke="var(--accent,#ff665c)"
              strokeWidth="1.5"
            />
          </>
        )}
      </g>
      <g fill="var(--accent,#ff665c)">
        <circle cx="557" cy="174" r="7" />
        <circle cx="163" cy="502" r="6" />
        <circle cx="632" cy="420" r="3" />
      </g>
      <g
        fontFamily="monospace"
        fontSize="9"
        letterSpacing="1.5"
        fill="currentColor"
        opacity=".45"
      >
        <text x="40" y="37">
          ATOX / FIELD NOTES
        </text>
        <text x="462" y="681">
          CONNECTION → CREATION
        </text>
        <text x="42" y="681">
          001 — UNLIMITED
        </text>
      </g>
    </svg>
  );
}

export function TrackIcon({
  index,
  className = "",
}: {
  index: number;
  className?: string;
}) {
  const paths = [
    "M8 12H36M12 16L22 34M32 16L26 34",
    "M8 5L24 10L40 5V24Q37 38 24 44Q11 38 8 24Z M17 23L22 29L32 17",
    "M7 7H18V18H7Z M29 7H40V18H29Z M7 29H18V40H7Z M29 29H40V40H29Z",
    "M24 2V11M24 37V46M2 24H11M37 24H46",
    "M8 39L40 7M18 7H40V29 M8 24V39H23",
    "M18 4H30V18H44V30H30V44H18V30H4V18H18Z",
    "M24 2V46M2 24H46M8 8L40 40M8 40L40 8",
  ];
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={paths[index % paths.length]} />
        {index === 0 && (
          <>
            <circle cx="8" cy="12" r="5" />
            <circle cx="36" cy="12" r="5" />
            <circle cx="24" cy="38" r="5" />
          </>
        )}
        {index === 3 && (
          <>
            <circle cx="24" cy="24" r="17" />
            <circle cx="24" cy="24" r="9" />
          </>
        )}
      </g>
    </svg>
  );
}
