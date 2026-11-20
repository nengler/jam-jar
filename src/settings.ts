import { createSettings } from "@tsengine/runtime";

/**
 * The player's settings, kept between launches (the engine writes them wherever the host keeps a game's files): the two volumes,
 * which the engine applies itself to every `<Music>` and every sound, whether the jar plays at double speed, and the moments whose keys the player has already been
 * shown (`learned`: "title", "order", "pick", "shop", …), so the hints for them are not drawn again.
 */
export const settings = createSettings({
  name: "settings",
  defaults: { music: 0.4, effects: 0.8, fast: false, learned: [] as string[], tutorial: 0 },
});

/** A volume as the settings screen shows it, 0 to 10. */
function level(volume: number): number {
  return Math.round(volume * 10);
}

export function musicLevel(): number {
  return level(settings.get().music);
}

export function effectsLevel(): number {
  return level(settings.get().effects);
}

/** Whether the jar plays at double speed (the settings screen's Speed row). */
export function fastPlay(): boolean {
  return settings.get().fast;
}

export function toggleFast(): void {
  settings.set({ fast: !settings.get().fast });
}

/** The moments already learned. The same list until it changes, so a component that reads it is not drawn again for nothing. */
export function learnedMoments(): readonly string[] {
  return settings.get().learned;
}

/** Turn a volume up or down a step of the settings screen's ten. */
export function stepVolume(which: "music" | "effects", by: number): void {
  const now = level(settings.get()[which]);
  settings.set({ [which]: Math.min(10, Math.max(0, now + by)) / 10 });
}

/** The player has got through this moment once, so they know its keys. */
export function learn(moment: string): void {
  const known = settings.get().learned;
  if (moment !== "" && !known.includes(moment)) settings.set({ learned: [...known, moment] });
}

/** Which lesson of the first game's tutorial comes next (rules/tutorial.ts): 0 for a player who has seen none, past the last once it is over. */
export function tutorialStep(): number {
  return settings.get().tutorial;
}

export function setTutorialStep(step: number): void {
  if (step !== settings.get().tutorial) settings.set({ tutorial: step });
}
