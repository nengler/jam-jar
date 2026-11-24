import { Entity, Flex, Line, Shape, Sprite } from "@tsengine/runtime/jsx";

import { blastBits, blastFlash, countdowns, placed } from "./layout.ts";
import { BOOM_LIFE, JAR, lean, preservable, RIM, type Run } from "./rules/jar.ts";
import { TurnsMark } from "./TurnsMark.tsx";
import { BAD, BAR_FILL, CARD_SLICE, GOLD, INK, LIGHT, LINK, SELECT } from "./theme.ts";

/** The pixel explosion's frames (Kenney Explosion Pack), each centred on a 96-pixel square, drawn at 2x like all the art. */
const BOOM_FRAMES = 9;
const BOOM_SIZE = 96;
/** How much wider than the fruit a pop of the clear-out between cycles is drawn. */
const POP_SCALE = 1.8;
/** A blast's sparks, from the hottest to the last embers: Apollo's light, gold, orange and red. */
const SPARK = [LIGHT, GOLD, BAR_FILL, BAD];

/**
 * What is drawn on the jar, over its fruit, turning with it about its low corner when it leans (the Tilted jar): the Preserves
 * Jar's frames and pointer, a blast's flash, sparks and picture, the pops of the clear-out, and the lines between fruit while one
 * does something to another. While the Preserves Jar's fruit are chosen, each one it can keep hears the mouse and a tap
 * (`onPoint`, `onChoose`, by its place in `preservable`).
 */
export function JarMarks({ run, angle: drawn, onPoint, onChoose }: { run: Run; angle?: number; onPoint: (at: number) => void; onChoose: (at: number) => void }) {
  const preserving = run.phase === "preserve";
  const chosen = preserving ? preservable(run)[run.preserveCursor] : undefined;
  const keptFruit = preserving ? run.fruits.filter((f) => run.kept.includes(f.id)) : [];
  // Only a Blast lights the jar up and throws sparks; the pops of the clear-out between cycles are quieter.
  const booms = run.effects.filter((e) => e.kind === "boom");
  /** How bright the jar is lit by a blast this instant. */
  const flash = blastFlash(booms);
  const links = run.links.filter((l) => l.delay <= 0);
  return (
    <Entity x={JAR.right} y={JAR.floor} rotation={drawn ?? lean(run)}>
      <Entity x={-JAR.right} y={-JAR.floor}>
        {/* What a fruit is counting down to, in turns: its thaw, a Coconut's crack, a Banana's rot. */}
        {countdowns(run).map((mark) => (
          <TurnsMark key={mark.id} mark={mark} />
        ))}
        {/* The Preserves Jar: an amber frame round each fruit kept, and an arrow over the one the cursor is on. */}
        {keptFruit.map((f) => (
          <Flex key={f.id} x={f.x - f.r - 4} y={f.y - f.r - 4} width={f.r * 2 + 8} height={f.r * 2 + 8} backgroundImage={SELECT} slice={CARD_SLICE} />
        ))}
        {/* Each fruit the Preserves Jar can keep can be clicked or tapped: it is kept, or let go. */}
        {preserving && (
          <>
            {placed(preservable(run)).map((slot) => (
              <Flex key={slot.card.id} x={slot.card.x - slot.card.r} y={slot.card.y - slot.card.r} width={slot.card.r * 2} height={slot.card.r * 2} focusable={false} onPointerEnter={() => onPoint(slot.at)} onPress={() => onChoose(slot.at)} />
            ))}
          </>
        )}
        {preserving && chosen !== undefined && <Sprite image="pointer.png" x={Math.round(chosen.x) - 9} y={Math.round(chosen.y - chosen.r) - 20} />}
        {/* A blast: the whole jar is lit for an instant, then its picture, a ring running out from it and sparks thrown every way. */}
        {flash > 0 && <Shape kind="rect" x={JAR.left} y={RIM - 24} width={JAR.right - JAR.left} height={JAR.floor - RIM + 24} color={LIGHT} opacity={0.45 * flash} />}
        {blastBits(booms, BOOM_LIFE).map((bit) => (
          <Shape key={bit.id} kind="rect" x={bit.x - bit.size / 2} y={bit.y - bit.size / 2} width={bit.size} height={bit.size} color={SPARK[bit.shade] ?? LIGHT} />
        ))}
        {run.effects.map((e) => (
          <Sprite
            key={e.id}
            image={`boom-${Math.min(BOOM_FRAMES - 1, Math.floor((e.age / BOOM_LIFE) * BOOM_FRAMES))}.png`}
            x={e.x}
            y={e.y}
            originX={BOOM_SIZE / 2}
            originY={BOOM_SIZE / 2}
            scaleX={e.kind === "pop" ? (e.size * POP_SCALE) / BOOM_SIZE : 2}
            scaleY={e.kind === "pop" ? (e.size * POP_SCALE) / BOOM_SIZE : 2}
          />
        ))}
        {/* A line between two fruit while one does something to the other: a dark one under a coloured one, so it shows on any fruit. */}
        {links.map((l) => (
          <Entity key={l.id}>
            <Line x={l.x1} y={l.y1} x2={l.x2} y2={l.y2} width={6} color={INK} />
            <Line x={l.x1} y={l.y1} x2={l.x2} y2={l.y2} width={2} color={LINK[l.kind]} />
          </Entity>
        ))}
      </Entity>
    </Entity>
  );
}
