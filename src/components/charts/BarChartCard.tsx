import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarDatum {
  label: string;
  /** label lengkap untuk tooltip */
  fullLabel?: string;
  value: number;
}

/**
 * Grafik batang satu seri (tanpa legenda — judul kartu yang menamai serinya).
 * Batang tipis, ujung membulat 4px, grid samar, tooltip per batang.
 */
export function SimpleBarChart({
  data,
  format,
  formatAxis,
  height = 200,
  ariaLabel,
}: {
  data: BarDatum[];
  format: (n: number) => string;
  formatAxis?: (n: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  return (
    <figure aria-label={ariaLabel} className="m-0">
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#EEF2F6" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#E2E8F0" }} tick={{ fill: "#64748B", fontSize: 12 }} interval="preserveStartEnd" minTickGap={4} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
              tickFormatter={formatAxis ?? format}
              allowDecimals={false}
              width={64}
              domain={[0, max === 0 ? 1 : "auto"]}
            />
            <Tooltip
              cursor={{ fill: "rgb(37 99 235 / 0.06)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as BarDatum;
                return (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] shadow-[var(--shadow-pop)]">
                    <p className="text-muted">{d.fullLabel ?? d.label}</p>
                    <p className="tabular font-semibold text-ink">{format(d.value)}</p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
              fill="#2563EB"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Tabel alternatif untuk pembaca layar */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.fullLabel ?? d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
