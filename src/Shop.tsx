import { Entity, Flex, Shape, Sprite, Text, Tooltip, useTime, type Child } from "@tsengine/runtime/jsx";

import { Letters, Panel, Shade } from "./Board.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { KeyHint, TapButton } from "./KeyHint.tsx";
import { chosenName, ENTER, entered, placed, popIn, poolRows } from "./layout.ts";
import { FRUITS } from "./rules/fruits.ts";
import { ITEMS } from "./rules/items.ts";
import { RuleText } from "./RuleText.tsx";
import { Bloops } from "./Sounds.tsx";
import { Terms } from "./Terms.tsx";
import { FRUIT_PRICE, removalPrice, rerollPrice, SHOP_ITEM, SHOP_LEAVE, SHOP_REMOVE, SHOP_REROLL, type Run, type Shop as ShopState } from "./rules/jar.ts";
import { BAD, cardFor, CARD_SLICE, INK, INK_SOFT, KEYWORD, LIGHT, PANEL, PANEL_SLICE, SELECT, SHADE_DEEP, WELL } from "./theme.ts";

/** The shelf: four cards in a row, and how far the chosen one is raised. */
const CARD_W = 148;
const CARD_H = 204;
const CARD_GAP = 6;
const CARD_LIFT = 8;
/** The actions: three buttons under the shelf. */
const ACTION_W = 196;
const ACTION_H = 36;
/** Choosing a fruit to take out: the pool's kinds in cells on a board, this many to a row before they wrap. */
const CELL = 56;
const CELLS_ACROSS = 8;

interface ShopProps {
  run: Run;
  shop: ShopState;
  /** Whether the keys are shown: the first visit, and the first time a fruit is taken out. */
  hints: boolean;
  /** The mouse came over a card or an action (its place in the shop's cursor order), or pressed it. */
  onPoint: (place: number) => void;
  onClick: (place: number) => void;
  /** A tap landed on none of the shelf's cards: nothing on it is chosen any more. */
  onAway: () => void;
  /** The take-out dialog's button was pressed: what Enter does there, with no place pointed at. */
  onConfirm: () => void;
  /** A button that does what Space does was pressed: leave the shop, or back out of taking a fruit out. */
  onSpace: () => void;
}

/** A price: the coin and the number, in a row. The number is red when the run has not the coins. */
function Price({ price, afford }: { price: number; afford: boolean }) {
  return (
    <Flex direction="row" alignItems="center" gap={4}>
      <Sprite image="coin.png" />
      <Text color={afford ? INK : BAD}>{`${price}`}</Text>
    </Flex>
  );
}

/** Whether a place on the shop's shelf is the chosen one (nothing is, while a fruit is being taken out). */
function chosen(shop: ShopState, at: number): boolean {
  return !shop.removing && shop.cursor === at;
}

/** What a card on the shelf sells, or null once it is sold (or there is nothing to sell). */
interface Sale {
  name: string;
  text: string;
  price: number;
}

/**
 * A card on the shop's shelf: its price, its picture (`children`), its name and rules, and what its keywords mean beside it while
 * it is chosen. The chosen card stands at the top of its place, which is a little taller than the card. A tap or a click chooses
 * a card and a second buys it; the pointer coming over one does not choose it (see the pick).
 */
function ShopCard({ at, shop, sale, soldLabel, coins, time, paused, onClick, children }: { at: number; shop: ShopState; sale: Sale | null; soldLabel: string; coins: number; time: number; paused: boolean; onClick: (place: number) => void; children: Child }) {
  const left = at < 2;
  return (
    <Flex height={CARD_H + CARD_LIFT} direction="column" justifyContent={chosen(shop, at) ? "start" : "end"} y={-CARD_DROP * (1 - popIn(time, at * ENTER.gap, ENTER.pop))} opacity={entered(time, at)}>
      <Flex width={CARD_W} height={CARD_H} direction="column" alignItems="center" paddingX={6} paddingTop={8} backgroundImage={cardFor(chosen(shop, at))} slice={CARD_SLICE} focusable={false} onPress={() => onClick(at)}>
        {sale !== null && (
          <Tooltip show={!paused && chosen(shop, at)} anchor={left ? "top-left" : "top-right"} to={left ? "top-right" : "top-left"} offsetX={left ? 4 : -4} offsetY={-40} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
            <Terms text={sale.text} />
          </Tooltip>
        )}
        {sale !== null && (
          <Flex left={8} top={6}>
            <Price price={sale.price} afford={coins >= sale.price} />
          </Flex>
        )}
        <Flex width={64} height={sale === null ? 0 : 64}>
          {children}
        </Flex>
        {sale !== null && (
          <Text width={CARD_W - 12} maxWidth={CARD_W - 12} align="center" color={INK}>
            {sale.name}
          </Text>
        )}
        {sale !== null && <RuleText x={0} y={0} width={CARD_W - 12} text={sale.text} color={INK_SOFT} accent={KEYWORD} />}
        {sale === null && (
          <Flex height="grow" direction="column" justifyContent="center">
            <Text color={WELL}>{soldLabel}</Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}

/** One of the actions under the shelf: what it does, and what it costs if anything. It acts on one tap. */
function ShopAction({ at, label, price, coins, shop, onPoint, onClick }: { at: number; label: string; price?: number; coins: number; shop: ShopState; onPoint: (place: number) => void; onClick: (place: number) => void }) {
  return (
    <Flex width={ACTION_W} height={ACTION_H} direction="row" alignItems="center" justifyContent={price === undefined ? "center" : "space-between"} paddingX={14} backgroundImage={cardFor(chosen(shop, at))} slice={CARD_SLICE} focusable={false} onPointerEnter={() => onPoint(at)} onPress={() => onClick(at)}>
      <Text color={INK}>{label}</Text>
      {price !== undefined && <Price price={price} afford={coins >= price} />}
    </Flex>
  );
}

/** How far above its place a card starts as the shop comes in, and how far below theirs the actions start, in pixels. */
const CARD_DROP = 260;
const ACTION_RISE = 120;

/**
 * The shop between two cycles, over the dimmed kitchen: three fruit and an item on cards, then removal, a reroll and the way out.
 * The rules (rules/jar.ts, `Shop`) hold what is for sale and where the cursor is; this draws them. `hints` is whether the keys are
 * shown: the first visit, and the first time a fruit is taken out.
 */
export function Shop({ run, shop, hints, onPoint, onClick, onAway, onConfirm, onSpace }: ShopProps) {
  // The card the cursor is on shows what its keywords mean, but not over the pause menu.
  const paused = useGame((g) => g.paused);
  const kinds = poolRows(run.pool);
  // The shop comes in as a run does: each card drops into its place, one after another, the actions rise into theirs, and the
  // purse slides in from the right. Each is moved within its own slot (its `y`), so the row is laid out as it always is.
  const time = useTime();
  return (
    <Entity>
      {/* Darker than other dialogs' shade: the shop covers the whole screen, and the boards behind it should not show through. */}
      <Shade color={SHADE_DEEP} />
      {/* A bloop for each card as it drops in, and one for the actions. */}
      <Bloops start={ENTER.pop * 0.6} gap={ENTER.gap} count={SHOP_ITEM + 2} />

      {/* The whole shop is one column down the middle of the screen: its heading, the shelf, the actions, and what just happened. */}
      <Flex left={0} right={0} top={10} bottom={0} direction="column" alignItems="center" gap={6}>
        <Flex direction="row" justifyContent="center" height={32}>
          <Letters text="Shop" seed={3} />
        </Flex>

        {/* The shelf. Each place is a little taller than its card, and the chosen card stands at the top of its place. A tap or a
            click chooses a card and a second buys it; the pointer coming over one does not choose it (see the pick). */}
        <Flex direction="row" gap={CARD_GAP} onPressOutside={onAway}>
          {placed(shop.fruits).map((slot) => (
            <ShopCard key={slot.at} at={slot.at} shop={shop} time={time} paused={paused} onClick={onClick} coins={run.coins} soldLabel="Sold" sale={slot.card === null ? null : { name: FRUITS[slot.card].name, text: FRUITS[slot.card].text, price: FRUIT_PRICE }}>
              {slot.card !== null && <FruitBall kind={slot.card} x={32} y={32} look="big" />}
            </ShopCard>
          ))}
          <ShopCard at={SHOP_ITEM} shop={shop} time={time} paused={paused} onClick={onClick} coins={run.coins} soldLabel="No item" sale={shop.item === null ? null : ITEMS[shop.item]}>
            {shop.item !== null && <Sprite image={`item-${shop.item}.png`} x={8} y={16} />}
          </ShopCard>
        </Flex>

        {/* The actions: what each does at its left end and what it costs at its right. */}
        <Flex direction="row" gap={CARD_GAP} y={ACTION_RISE * (1 - popIn(time, (SHOP_ITEM + 1) * ENTER.gap, ENTER.pop))} opacity={entered(time, SHOP_ITEM + 1)}>
          <ShopAction at={SHOP_REMOVE} label="Remove one" price={removalPrice(run)} coins={run.coins} shop={shop} onPoint={onPoint} onClick={onClick} />
          <ShopAction at={SHOP_REROLL} label="New shelf" price={rerollPrice(run)} coins={run.coins} shop={shop} onPoint={onPoint} onClick={onClick} />
          <ShopAction at={SHOP_LEAVE} label="Next cycle" coins={run.coins} shop={shop} onPoint={onPoint} onClick={onClick} />
        </Flex>

        {/* What just happened (a fruit bought, the shelf restocked), under the actions. */}
        <Text width={400} maxWidth={400} align="center" color={LIGHT}>
          {run.message}
        </Text>
      </Flex>

      {/* The purse, in the top right corner. */}
      <Flex right={24 - 160 * (1 - popIn(time, 0.3, ENTER.pop))} top={12} width={104}>
        <Flex width={104} height={32} direction="row" alignItems="center" justifyContent="space-between" paddingX={10} backgroundImage={PANEL} slice={PANEL_SLICE}>
          <Sprite image="coin.png" />
          <Text color={INK}>{`${run.coins}`}</Text>
        </Flex>
      </Flex>

      {!shop.removing && hints && (
        <Flex left={0} right={0} bottom={0} direction="row" justifyContent="center" gap={20}>
          <KeyHint name="arrows" label="Choose" />
          <KeyHint name="Enter" label="Buy" />
          <KeyHint name="Space" label="Next cycle" />
        </Flex>
      )}

      {/* Taking a fruit out: the pool by kind on a board in the middle of the screen, its kinds wrapping when there are many. */}
      {shop.removing && (
        <Entity>
          <Shade />
          <Flex left={0} right={0} top={0} bottom={0} direction="column" alignItems="center" justifyContent="center">
            <Flex width={Math.max(240, Math.min(kinds.length, CELLS_ACROSS) * CELL + 32)} direction="column" alignItems="stretch">
              <Panel heading="Take out one">
                <Flex direction="row" wrap justifyContent="center" rowGap={4} columnGap={0}>
                  {placed(kinds).map((cell) => (
                    <Flex key={cell.card.kind} width={CELL} direction="column" alignItems="center" focusable={false} onPress={() => onClick(cell.at)}>
                      <Flex width={40} height={40} backgroundImage={cell.at === shop.removeCursor ? SELECT : undefined} slice={CARD_SLICE}>
                        <FruitBall kind={cell.card.kind} x={20} y={20} look="icon" />
                      </Flex>
                      <Text color={INK}>{`${cell.card.count}`}</Text>
                    </Flex>
                  ))}
                </Flex>
                {/* A tap on a kind only chooses it. What takes it out is this button (or Enter), which names it and its price,
                    so nothing leaves the pool by a slip of the finger. */}
                <Flex direction="row" justifyContent="center" alignItems="center" gap={12} paddingTop={6}>
                  {shop.removeCursor >= 0 && <TapButton label={`Take out ${chosenName(kinds, shop.removeCursor)}`} keyName={hints ? "Enter" : ""} onPress={onConfirm} />}
                  {shop.removeCursor < 0 && <Text color={INK_SOFT}>Choose a fruit</Text>}
                  <TapButton label="Back" keyName={hints ? "Space" : ""} onPress={onSpace} />
                </Flex>
              </Panel>
            </Flex>
          </Flex>
          <Flex left={0} right={0} bottom={2} direction="row" justifyContent="center" alignItems="center" gap={20}>
            {hints && <KeyHint name="arrows" label="Choose" />}
          </Flex>
        </Entity>
      )}
    </Entity>
  );
}
