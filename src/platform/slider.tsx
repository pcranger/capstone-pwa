import type { CSSProperties } from "react";
export default function Slider({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
  onSlidingComplete,
  accessibilityLabel,
  accessibilityValue,
}: {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (v: number) => void;
  onSlidingComplete: (v: number) => void;
  accessibilityLabel: string;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  accessibilityValue?: { text?: string };
  style?: unknown;
}) {
  return (
    <input
      type="range"
      aria-label={accessibilityLabel}
      aria-valuetext={accessibilityValue?.text}
      min={minimumValue}
      max={maximumValue}
      step=".01"
      value={value}
      onChange={(e) => { const next = Number(e.target.value); onValueChange(next); onSlidingComplete(next); }}
      style={
        {
          height: 44,
          width: "100%",
          accentColor: "#8AB4F8",
          margin: 0,
        } as CSSProperties
      }
    />
  );
}
