import QRCode from "qrcode";

// QR desenhado em SVG no servidor (sem HTML injetado): um caminho com um
// quadrado por módulo escuro. Usado na ficha, para conferir a etiqueta.

export function QrDoAtivo({
  texto,
  rotulo,
  className = "size-32",
}: {
  texto: string;
  rotulo: string;
  className?: string;
}) {
  const { modules } = QRCode.create(texto, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const margem = 2;
  let d = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (modules.data[r * n + c]) d += `M${c + margem} ${r + margem}h1v1h-1z`;
  const lado = n + margem * 2;
  return (
    <svg
      viewBox={`0 0 ${lado} ${lado}`}
      role="img"
      aria-label={rotulo}
      shapeRendering="crispEdges"
      className={`rounded-xl bg-[#fff] ${className}`}
    >
      <path d={d} fill="#000" />
    </svg>
  );
}
