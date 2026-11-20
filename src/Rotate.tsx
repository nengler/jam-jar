import { Entity, Flex, Line, Shape, Text } from "@tsengine/runtime/jsx";

import { DISPLAY, GOLD, INK, LIGHT, LIGHT_SOFT, WALL_SHADOW } from "./theme.ts";

/**
 * Over everything while the window is taller than it is wide, as a phone held upright is: Jam Jar is laid out on its side, and
 * upright the whole game would be a strip across the middle of the screen. The game waits under it (Main pauses the world), so a
 * hand that was dropping is not played out unseen. Upright, the 640 × 360 screen is scaled down to the phone's width (to about
 * 0.6 on most phones), so the words are four times the pixel font's size, not twice, and the picture is plain and big: a phone
 * standing, an arrow, the same phone on its side.
 */
export function Rotate() {
  return (
    <Entity>
      <Flex modal width={640} height={360} background={WALL_SHADOW} direction="column" alignItems="center" justifyContent="center" gap={28}>
        <Flex direction="row" alignItems="center" gap={36} height={96}>
          <Phone width={52} height={92} color={LIGHT_SOFT} />
          <Flex width={48} height={32}>
            <Entity>
            <Line x={0} y={16} x2={44} y2={16} width={6} color={GOLD} />
            <Line x={30} y={4} x2={45} y2={16} width={6} color={GOLD} />
            <Line x={30} y={28} x2={45} y2={16} width={6} color={GOLD} />
            </Entity>
          </Flex>
          <Phone width={92} height={52} color={LIGHT} />
        </Flex>
        <Text font={DISPLAY} size={56} color={LIGHT}>
          Turn your phone
        </Text>
      </Flex>
    </Entity>
  );
}

/** A phone, drawn in two rectangles: the case, and the screen inside it a little in from each edge. */
function Phone(props: { width: number; height: number; color: string }) {
  return (
    <Flex width={props.width} height={props.height}>
      {/* In an Entity, so the two are placed by x and y, one over the other, not laid out side by side. */}
      <Entity>
        <Shape kind="rect" x={0} y={0} width={props.width} height={props.height} color={props.color} />
        <Shape kind="rect" x={6} y={6} width={props.width - 12} height={props.height - 12} color={INK} />
      </Entity>
    </Flex>
  );
}
