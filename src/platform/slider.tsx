import type { CSSProperties } from "react";
export default function Slider({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
  onSlidingComplete,
  accessibilityLabel,
}: {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (v: number) => void;
  onSlidingComplete: (v: number) => void;
  accessibilityLabel: string;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  accessibilityValue?: unknown;
  style?: unknown;
}) {
  return (
    <input
      type="range"
      aria-label={accessibilityLabel}
      min={minimumValue}
      max={maximumValue}
      step=".01"
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      onPointerUp={(e) => onSlidingComplete(Number(e.currentTarget.value))}
      onKeyUp={(e) => onSlidingComplete(Number(e.currentTarget.value))}
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
