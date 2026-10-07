/** A decorative, deterministic voxel sculpture — not market or performance data. */
export function MarketStructure() {
  const columns = Array.from({ length: 36 }, (_, index) => {
    const x = index % 6;
    const y = Math.floor(index / 6);
    const height = 2 + ((x * 7 + y * 3) % 4) + (x > 1 && x < 5 && y > 0 && y < 5 ? 3 : 0);
    return { x, y, height };
  }).sort((a, b) => a.x + a.y - b.x - b.y);

  return (
    <div className="market-structure" aria-hidden="true">
      <div className="structure-caption"><span>FIG. 01 / SCALE MODEL</span><span className="crosshair">+</span></div>
      <svg className="structure-svg" viewBox="0 0 620 560" fill="none">
        <defs>
          <pattern id="structure-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" stroke="#cbcbd0" strokeWidth=".6" /></pattern>
          <pattern id="structure-lines" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0H4" stroke="#f5f5f2" strokeOpacity=".22" strokeWidth=".7" /></pattern>
        </defs>
        <rect x="40" y="32" width="540" height="490" fill="url(#structure-grid)" opacity=".65" />
        <g stroke="#a6a5af" strokeWidth=".8" strokeDasharray="3 7">
          <path d="M70 360L320 500L565 358M70 360V150L320 20L565 150V358M320 20V500M70 150L320 290L565 150" />
          <path d="M35 425H590M98 60V495M520 65V495" />
        </g>
        <g className="voxel-object">
          {columns.flatMap(({ x, y, height }) => Array.from({ length: height }, (_, z) => {
            const px = 310 + (x - y) * 33;
            const py = 286 + (x + y) * 18 - z * 34;
            const seed = x * 17 + y * 11 + z * 7;
            const purple = seed % 17 === 0 || (z === 0 && x > 3);
            const lime = seed % 23 === 0;
            const pale = z >= height - 2 && (x + y) % 3 === 0;
            const colors = purple ? ["#b393ee", "#8853d9", "#6938b3"] : lime ? ["#e0fc79", "#c4ee37", "#a0c42b"] : pale ? ["#ececea", "#c7c7c7", "#a0a0a5"] : ["#66666d", "#323238", "#19191e"];
            return (
              <g key={`${x}-${y}-${z}`} stroke="#f4f4f0" strokeWidth=".45" strokeOpacity=".25">
                <path d={`M${px} ${py - 18}l33 18 -33 18 -33 -18Z`} fill={colors[0]} />
                <path d={`M${px - 33} ${py}l33 18v34l-33 -18Z`} fill={colors[1]} />
                <path d={`M${px} ${py + 18}l33 -18v34l-33 18Z`} fill={colors[2]} />
                <path d={`M${px - 33} ${py}l33 18 33 -18v34l-33 18 -33 -18Z`} fill="url(#structure-lines)" stroke="none" />
              </g>
            );
          }))}
        </g>
        <g stroke="#8550d5" strokeWidth="1.2">
          <path d="M83 96h14m-7-7v14M533 233h14m-7-7v14M153 463h14m-7-7v14" />
          <path d="M486 57h18m-9-9v18M54 310h18m-9-9v18" stroke="#a4c52c" />
        </g>
        <g fill="#25252b">{[[70,150],[565,150],[70,360],[565,358],[320,500],[98,425],[520,425]].map(([x,y]) => <rect key={`${x}-${y}`} x={x-2} y={y-2} width="4" height="4" />)}</g>
        <g transform="translate(539 37)" stroke="#34343b"><circle r="17" /><ellipse rx="8" ry="17" /><path d="M-17 0h34M-14-8h28M-14 8h28" /></g>
      </svg>
      <div className="structure-note"><span>ИНФОРМАЦИЯ</span><span>× РЕШЕНИЕ</span><span>× РЕЗУЛЬТАТ</span></div>
      <div className="structure-bottom"><span>ОТ РЕШЕНИЯ К РЕЗУЛЬТАТУ</span><span>// SCN_01</span></div>
    </div>
  );
}
