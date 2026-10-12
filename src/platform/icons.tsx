import glyphs from "./MaterialIcons.json";
export function MaterialIcons({
  name,
  size = 24,
  color = "#fff",
}: {
  name: keyof typeof glyphs;
  size?: number;
  color?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        fontFamily: "MaterialIcons",
        fontWeight: 400,
        fontSize: size,
        lineHeight: 1,
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        userSelect: "none",
      }}
    >
      {String.fromCodePoint(glyphs[name])}
    </span>
  );
}
MaterialIcons.glyphMap = glyphs;
