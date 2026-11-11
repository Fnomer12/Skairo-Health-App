import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";

type IconProps = { color?: string; size?: number; strokeWidth?: number };

// LiquidTabBar passes strokeWidth 2.2 for the active tab and 1.8 otherwise,
// so we use that to switch on a soft fill for the selected tab.
const isActive = (sw?: number) => (sw ?? 1.8) >= 2;

function Base({
  color = "#fff",
  size = 22,
  strokeWidth = 1.8,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/** Dashboard — chart in a frame (bars + trend line) */
export function DashboardIcon(p: IconProps) {
  const color = p.color ?? "#fff";
  const active = isActive(p.strokeWidth);
  return (
    <Base {...p}>
      <Rect
        x={3} y={3.5} width={18} height={17} rx={4}
        fill={active ? color : "none"} fillOpacity={active ? 0.18 : 0}
      />
      <Path d="M7.5 16.5v-3M11 16.5v-6M14.5 16.5v-4.5" />
      <Path d="M7 9.5l3.5-2.5 3 2 3.5-3" />
      <Circle cx={17} cy={6} r={1} fill={color} stroke="none" />
    </Base>
  );
}

/** Intake — clipboard with a pulse line */
export function IntakeIcon(p: IconProps) {
  const color = p.color ?? "#fff";
  const active = isActive(p.strokeWidth);
  return (
    <Base {...p}>
      {active && (
        <Rect x={5} y={4.5} width={14} height={16.5} rx={3} fill={color} fillOpacity={0.18} stroke="none" />
      )}
      <Path d="M8.5 4.5H8a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V7.5a3 3 0 0 0-3-3h-.5" />
      <Rect x={8.5} y={3} width={7} height={3} rx={1} />
      <Path d="M8 14.2h1.9l1.2-2.7 1.9 5 1.3-2.3H16" />
    </Base>
  );
}

/** Profile — person in a circle */
export function ProfileIcon(p: IconProps) {
  const color = p.color ?? "#fff";
  const active = isActive(p.strokeWidth);
  return (
    <Base {...p}>
      <Circle
        cx={12} cy={12} r={8.8}
        fill={active ? color : "none"} fillOpacity={active ? 0.18 : 0}
      />
      <Circle cx={12} cy={10} r={2.8} />
      <Path d="M6.6 18.8c1.1-2.4 3-3.6 5.4-3.6s4.3 1.2 5.4 3.6" />
    </Base>
  );
}