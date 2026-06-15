function roundHalfEven(value: number, fractionDigits: number): number {
  if (!Number.isFinite(value)) return 0;

  const factor = 10 ** fractionDigits;
  const scaled = value * factor;
  const sign = Math.sign(scaled) || 1;
  const absolute = Math.abs(scaled);
  const floor = Math.floor(absolute);
  const fraction = absolute - floor;
  const tolerance = Number.EPSILON * Math.max(1, absolute) * 4;

  let rounded: number;

  if (Math.abs(fraction - 0.5) <= tolerance) {
    rounded = floor % 2 === 0 ? floor : floor + 1;
  } else {
    rounded = Math.round(absolute);
  }

  return (sign * rounded) / factor;
}

function formatGroupedNumber(value: number, fractionDigits: number): string {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatKpiCurrency(value: number): string {
  return `£${formatGroupedNumber(roundHalfEven(value, 0), 0)}`;
}

export function formatKpiPercent(value: number): string {
  return `${formatGroupedNumber(roundHalfEven(value, 1), 1)}%`;
}

export function formatKpiCount(value: number): string {
  return formatGroupedNumber(roundHalfEven(value, 0), 0);
}

export function formatKpiMultiple(value: number): string {
  return `${formatGroupedNumber(roundHalfEven(value, 2), 2)}x`;
}
