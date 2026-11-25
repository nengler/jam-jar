import { Entity, Flex, Layer, Shape, Sprite, Text, Tooltip, useTime, type Child } from "@tsengine/runtime/jsx";

import { Dialog } from "./Board.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { TapButton } from "./KeyHint.tsx";
import { chosenName, dissolved, ENTER, entered, placed, popIn, poolRows, cardText, SHOP_SWIRL } from "./layout.ts";
import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { ITEMS, type ItemKind } from "./rules/items.ts";
import { Bloops } from "./Sounds.tsx";
import { CardTip, FruitTip } from "./FruitTip.tsx";
import { FRUIT_PRICE, glazeKinds, removalPrice, rerollPrice, SHOP_GLAZE, SHOP_ITEM, SHOP_LEAVE, SHOP_REMOVE, SHOP_REROLL, OFFERED, type Run, type Shop as ShopState } from "./rules/jar.ts";
import { GLAZE_PRICE, GLAZES, type Glaze } from "./rules/glazes.ts";
import { GlazeMark } from "./GlazeMark.tsx";
import {
  biggestFruit,
  fruitImageSize,
  AWNING,
  AWNING_H,
  BAD,
  CARD_SLICE,
  GLAZE_COLOR,
  CLOTH,
  COIN_JAR,
  DISPLAY,
  DISPLAY_SIZE,
  GOLD,
  INK,
  INK_SOFT,
  LIGHT,
  NIGHT,
  SELECT,
  SHADE,
  SIGN_SLICE,
  signFor,
  SOLD,
  STALL,
  TERM_W,
} from "./theme.ts";

/**
 * The stall: five places in a row on its counter (three fruit in their baskets, the item and a glaze), each with its name over it
 * and its price hung on the front of the counter under it. What a thing does is not written on the stall: it opens beside the
 * place the mouse is over, or the chosen one.
 */
const PLACE_W = 112;
const PLACE_GAP = 8;
/** A name's line over its place, and the room round the picture for the frame of the chosen one. */
const NAME_H = 20;
const FRAME = 4;
/** Where the stall's counter's top is: the goods stand on it. */
const STALL_Y = 222;
const STALL_H = 20;
/** The row under the counter's front: each place's price, and beside it the chosen one's Buy button. */
const TAG_H = 30;
/** The actions: three signs under the stall, as wide across as the labels. */
const ACTION_W = 196;
const ACTION_H = 36;
const ACTION_GAP = 11;
const ACTION_Y = 280;
/**
 * The bar along the foot of the screen, under the actions: the pool's basket (as on the play screen, 56 x 38) and the coins on the
 * left, what just happened in the middle; the right is the pause button's.
 */
const BAR_Y = ACTION_Y + ACTION_H + 2;
const BAR_H = 360 - BAR_Y;
const BAR_SIDE = 16;
const POOL_BASKET_W = 56;
const POOL_H = 38;
const BAR_MESSAGE_W = 280;
/**
 * The picture at the top of a label: a fruit in its basket, or the item on its cloth. As wide as the biggest fruit the shop can
 * offer, and tall enough for it to sit in the basket with its top in the picture. The basket (56 x 38) and the cloth (60 x 12)
 * are centred across it, and the item (48 x 40) stands on the cloth.
 */
const PICTURE_W = Math.max(64, biggestFruit(OFFERED));
const PICTURE_H = 62;
const BASKET_W = 56;
const BASKET_Y = PICTURE_H - 38;
const CLOTH_W = 60;
const ITEM_W = 48;
/** How deep a fruit sits in its basket: this share of its height is below the basket's rim. */
const BASKET_SINK = 0.4;
/** Choosing a fruit to take out: the pool's kinds on a board, each in a cell its fruit's width and a little more, wrapping at this width. */
const REMOVE_W = 520;
/** Where a place's tooltip opens, from the place's top: just under the awning, or lower while the tutorial's lesson lies along the head of the screen. */
const TIP_UP = -92;
const TIP_COACHED = -78;
/** How far a tooltip stands from the frame round its place's picture. */
const TIP_GAP = 4;
/** The frame round a place's picture: how wide it is, and where the first place's is across the screen (the places are centred). */
const FRAME_W = PICTURE_W + FRAME * 2;
const FIRST_FRAME = (640 - (SHOP_GLAZE + 1) * PLACE_W - SHOP_GLAZE * PLACE_GAP) / 2 + (PLACE_W - FRAME_W) / 2;

/**
 * Where a fruit's tooltip goes, from the left edge of the frame round its place's picture, and how wide it is. Its card and what
 * its keywords mean stand side by side, as the shelf's do: in one column they ran off the foot of the screen for a fruit with many
 * keywords (a Watermelon's, a Pumpkin's). Both to the right of the place where they fit there (the first place); else the card on
 * its left and the keywords on its right where those fit (the third); else both against the screen's right edge (the second,
 * which has room for neither: they lie over the right of its frame).
 */
function fruitTipAt(at: number): { offsetX: number; width: number } {
  const frame = FIRST_FRAME + at * (PLACE_W + PLACE_GAP);
  const pair = TERM_W * 2 + 2;
  const right = frame + FRAME_W + TIP_GAP;
  const around = frame - TIP_GAP - TERM_W;
  if (right + pair <= 640 - TIP_GAP) return { offsetX: right - frame, width: pair };
  if (around >= TIP_GAP) return { offsetX: around - frame, width: TERM_W * 2 + FRAME_W + TIP_GAP * 2 };
  return { offsetX: 640 - TIP_GAP - pair - frame, width: pair };
}

/** A kind's cell on the take-out board: its fruit's width with room for the frame round the chosen one. */
function removeCell(kind: FruitKind): number {
  return Math.max(32, fruitImageSize(kind)) + 16;
}

interface ShopProps {
  run: Run;
  shop: ShopState;
  /** The mouse came over a card or an action (its place in the shop's cursor order), or pressed it. */
  onPoint: (place: number) => void;
  onClick: (place: number) => void;
  /** A tap landed on none of the shelf's cards: nothing on it is chosen any more. */
  onAway: () => void;
  /** The Buy button or the take-out dialog's button was pressed: what Enter does, with no place pointed at. */
  onConfirm: () => void;
  /** A button that does what Space does was pressed: leave the shop, or back out of taking a fruit out. */
  onSpace: () => void;
  /** The pool's basket was tapped: open the board of the whole pool, to compare what is for sale with what is in it. */
  onPool: () => void;
  /** The tutorial's lesson is up, along the head of the screen: what the chosen label's keywords mean opens lower, under it. */
  coached: boolean;
}

/** A price: the coin and the number, in a row. The number is red when the run has not the coins. */
function Price({ price, afford, color = INK }: { price: number; afford: boolean; color?: string }) {
  return (
    <Flex direction="row" alignItems="center" gap={4}>
      <Sprite image="coin.png" />
      {color === LIGHT ? (
        <Text color={afford ? LIGHT : BAD} shadow={INK} shadowX={2} shadowY={2}>{`${price}`}</Text>
      ) : (
        <Text color={afford ? color : BAD}>{`${price}`}</Text>
      )}
    </Flex>
  );
}

/**
 * A clear rectangle the size of a label's picture, first in the Entity that holds the picture's parts. The parts are in one
 * Entity so the box's layout places them as one (it would lay its children out in a row), and the layout places an Entity by
 * where its drawing starts: this makes that the picture's top left corner, whatever is drawn in it.
 */
function PictureRoom() {
  return <Shape kind="rect" x={0} y={0} width={PICTURE_W} height={PICTURE_H} color="#00000000" />;
}

/** How big the pot of glaze on its label is across, and the ring of ink round it. */
const POT = 40;
const POT_RING = 3;

/** A glaze for sale: a round pot of it standing on a cloth, or the cloth alone once it is bought. */
function GlazePot({ glaze }: { glaze: Glaze | null }) {
  return (
    <Flex width={PICTURE_W} height={PICTURE_H}>
      <Entity>
        <PictureRoom />
        <Sprite image={CLOTH} x={(PICTURE_W - CLOTH_W) / 2} y={PICTURE_H - 12} />
        {glaze !== null && (
          <Entity>
            <Shape kind="circle" x={(PICTURE_W - POT) / 2} y={PICTURE_H - 10 - POT} width={POT} height={POT} color={INK} />
            <Shape kind="circle" x={(PICTURE_W - POT) / 2 + POT_RING} y={PICTURE_H - 10 - POT + POT_RING} width={POT - POT_RING * 2} height={POT - POT_RING * 2} color={GLAZE_COLOR[glaze]} />
            <Shape kind="rect" x={PICTURE_W / 2 - 8} y={PICTURE_H - 10 - POT + 8} width={4} height={4} color={LIGHT} />
          </Entity>
        )}
      </Entity>
    </Flex>
  );
}

/** A fruit in its basket: the basket's back, the fruit sitting in it, and the basket's front over the fruit's bottom. */
function Basket({ kind }: { kind: FruitKind | null }) {
  const size = kind === null ? 0 : fruitImageSize(kind);
  return (
    <Flex width={PICTURE_W} height={PICTURE_H}>
      <Entity>
        <PictureRoom />
        <Sprite image="basket-back.png" x={(PICTURE_W - BASKET_W) / 2} y={BASKET_Y} />
        {kind !== null && <FruitBall kind={kind} x={PICTURE_W / 2} y={BASKET_Y + Math.round(size * BASKET_SINK / 2) * 2 - size / 2} />}
        <Sprite image="basket.png" x={(PICTURE_W - BASKET_W) / 2} y={BASKET_Y} />
      </Entity>
    </Flex>
  );
}

/** The item standing on its folded gingham cloth, or the cloth alone once it is bought. */
function OnCloth({ item }: { item: ItemKind | null }) {
  return (
    <Flex width={PICTURE_W} height={PICTURE_H}>
      <Entity>
        <PictureRoom />
        <Sprite image={CLOTH} x={(PICTURE_W - CLOTH_W) / 2} y={PICTURE_H - 12} />
        {item !== null && <Sprite image={`item-${item}.png`} x={(PICTURE_W - ITEM_W) / 2} y={PICTURE_H - 48} />}
      </Entity>
    </Flex>
  );
}

interface OfferProps {
  /** Its place in the shop's cursor order. */
  at: number;
  chosen: boolean;
  /** What it is called, or "" once it is bought. */
  name: string;
  /** What it costs and whether the run has the coins, or null once it is bought: the place is stamped SOLD. */
  price: number | null;
  afford: boolean;
  /** How far into the shop's coming in it is (0 to 1), and how far it has faded in. */
  drop: number;
  opacity: number;
  /** The Buy button beside the chosen one's price presses this. */
  onBuy: () => void;
  onClick: (place: number) => void;
  /** Its picture, and its tooltip. */
  children: Child;
}

/**
 * One place on the stall: the thing's name, the thing standing on the counter (framed when it is the chosen one), and under the
 * counter's front its price, with the Buy button beside it when it is chosen. A tap or a click only chooses it; the button, or
 * Enter, buys it. It drops into place as the shop comes in.
 */
function Offer({ at, chosen, name, price, afford, drop, opacity, onClick, onBuy, children }: OfferProps) {
  return (
    <Flex width={PLACE_W} direction="column" alignItems="center" y={-PLACE_DROP * (1 - drop)} opacity={opacity}>
      <Flex width={PLACE_W} direction="column" alignItems="center" focusable={false} onPress={() => onClick(at)}>
        <Flex height={NAME_H} direction="row" justifyContent="center">
          <Text color={chosen ? GOLD : LIGHT} shadow={INK} shadowX={2} shadowY={2}>
            {name}
          </Text>
        </Flex>
        <Flex paddingX={FRAME} paddingTop={FRAME} backgroundImage={chosen ? SELECT : undefined} slice={CARD_SLICE}>
          {children}
        </Flex>
      </Flex>
      <Flex height={TAG_H} direction="row" alignItems="center" justifyContent="center" gap={6} y={STALL_H}>
        {price !== null && <Price price={price} afford={afford} color={LIGHT} />}
        {price !== null && chosen && <TapButton label="Buy" onPress={onBuy} />}
        {price === null && <Sprite image={SOLD} />}
      </Flex>
    </Flex>
  );
}

/** A shop action: a wooden sign with what it does at its left end and what it costs at its right (or, for the way out, centred). */
function ActionSign({ chosen, go = false, label, price, afford, onPoint, onPress }: { chosen: boolean; go?: boolean; label: string; price?: number; afford?: boolean; onPoint: () => void; onPress: () => void }) {
  return (
    <Flex width={ACTION_W} height={ACTION_H} direction="row" alignItems="center" justifyContent={price === undefined ? "center" : "space-between"} paddingX={14} backgroundImage={signFor(chosen, go)} slice={SIGN_SLICE} focusable={false} onPointerEnter={onPoint} onPress={onPress}>
      <Text color={LIGHT} shadow={INK} shadowX={2} shadowY={2}>
        {label}
      </Text>
      {price !== undefined && <Price price={price} afford={afford === true} color={LIGHT} />}
    </Flex>
  );
}

/**
 * Whether a place's tooltip is up: its own while it is the chosen one, none while another place on the stall is (two would lie
 * over each other), and otherwise while the mouse is over it (the tooltip's own rule: `undefined`). Never when `hidden`: under
 * the pause menu, or the board for choosing a fruit.
 */
function tipShown(at: number, chosen: number, hidden: boolean): boolean | undefined {
  return hidden ? false : chosen === at ? true : chosen >= 0 && chosen <= SHOP_GLAZE ? false : undefined;
}

/** How far above its place a thing on the stall starts as the shop comes in, and how far below theirs the actions start, in pixels. */
const PLACE_DROP = 260;
const ACTION_RISE = 120;

/**
 * The shop between two cycles: a market stall over the dimmed kitchen. A striped awning across the top; three fruit in baskets,
 * an item on a cloth and a pot of glaze standing on the stall's counter, each under its name, with its price on the counter's
 * front; wooden signs for removal, a reroll and the way out; and a bar along the foot with the pool, the coins and what just
 * happened. What a thing does is said beside it, when the mouse is over it or it is chosen. The chosen one has its Buy button
 * beside its price, as the pick's chosen card has its Take button. No keys are shown
 * on it: the arrows, Enter, Space and D work as on the play screen. The rules (rules/jar.ts, `Shop`) hold what is for sale and
 * where the cursor is; this draws them.
 */
export function Shop({ run, shop, onPoint, onClick, onAway, onConfirm, onSpace, onPool, coached }: ShopProps) {
  // The card the cursor is on shows what its keywords mean, but not over the pause menu.
  const paused = useGame((g) => g.paused);
  // The kinds on the board for taking one out, or, for a glaze bought, those it can go on.
  const glazable = shop.glaze === null ? [] : glazeKinds(run, shop.glaze);
  const kinds = shop.glazing ? poolRows(run.pool).filter((row) => glazable.includes(row.kind)) : poolRows(run.pool);
  const choosing = shop.removing || shop.glazing;
  // The shop comes in as a run does: the awning drops down, each label drops onto the counter one after another, the signs rise
  // into theirs, and the purse slides in from the right. Each is moved within its own slot (its `y`), so the row is laid out as
  // it always is.
  const time = useTime();
  // The place the cursor is on, or none while a fruit is being chosen to take out.
  const chosen = choosing ? -1 : shop.cursor;
  // Whether the chosen place on the shelf has something for sale, for the Buy button: not an action, a sold place, or none.
  const awning = -AWNING_H * (1 - popIn(time, 0, ENTER.pop));
  return (
    <Layer shader="dissolve.glsl" params={[dissolved(time)]}>
      {/* Behind the stall, over the whole kitchen: a slow swirl of paint in the awning's reds, kept dark (assets/swirl.glsl).
          Where shaders do not run it is the dark it is painted on. The whole shop fills in from the top as it comes up
          (assets/dissolve.glsl). */}
      <Layer shader="swirl.glsl" params={SHOP_SWIRL}>
        <Shape kind="rect" x={0} y={0} width={640} height={360} color={NIGHT} />
      </Layer>
      {/* A bloop for each card as it drops in, and one for the actions. */}
      <Bloops start={ENTER.pop * 0.6} gap={ENTER.gap} count={SHOP_GLAZE + 2} />

      {/* The stall's counter, which the goods stand on. */}
      <Sprite image={STALL} x={0} y={STALL_Y} />

      {/* The stall: three fruit, the item and a glaze. What one does opens beside it while the mouse is over it, or while it is
          the chosen one (then only its own: a tap or a click chooses, as do the arrows). The pointer coming over one does not
          choose it (see the pick). */}
      <Flex left={0} right={0} top={STALL_Y - PICTURE_H - FRAME - NAME_H} direction="row" justifyContent="center" gap={PLACE_GAP} onPressOutside={onAway}>
        {placed(shop.fruits).map((slot) => (
          <Offer key={slot.at} at={slot.at} chosen={chosen === slot.at} name={slot.card === null ? "" : FRUITS[slot.card].name} price={slot.card === null ? null : FRUIT_PRICE} afford={run.coins >= FRUIT_PRICE} drop={popIn(time, slot.at * ENTER.gap, ENTER.pop)} opacity={entered(time, slot.at)} onClick={onClick} onBuy={onConfirm}>
            {slot.card !== null && (
              <Tooltip show={tipShown(slot.at, chosen, paused || choosing)} anchor="top-left" to="top-left" offsetX={fruitTipAt(slot.at).offsetX} offsetY={coached ? TIP_COACHED : TIP_UP} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
                <FruitTip kind={slot.card} text={cardText(run, slot.card)} apart={fruitTipAt(slot.at).width} />
              </Tooltip>
            )}
            <Basket kind={slot.card} />
          </Offer>
        ))}
        <Offer at={SHOP_ITEM} chosen={chosen === SHOP_ITEM} name={shop.item === null ? "" : ITEMS[shop.item].name} price={shop.item === null ? null : ITEMS[shop.item].price} afford={shop.item !== null && run.coins >= ITEMS[shop.item].price} drop={popIn(time, SHOP_ITEM * ENTER.gap, ENTER.pop)} opacity={entered(time, SHOP_ITEM)} onClick={onClick} onBuy={onConfirm}>
          {shop.item !== null && (
            <Tooltip show={tipShown(SHOP_ITEM, chosen, paused || choosing)} anchor="top-right" to="top-left" offsetX={-4} offsetY={coached ? TIP_COACHED : TIP_UP} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
              <CardTip name={ITEMS[shop.item].name} text={ITEMS[shop.item].text} />
            </Tooltip>
          )}
          <OnCloth item={shop.item} />
        </Offer>
        <Offer at={SHOP_GLAZE} chosen={chosen === SHOP_GLAZE} name={shop.glaze === null ? "" : GLAZES[shop.glaze].name} price={shop.glaze === null ? null : GLAZE_PRICE} afford={run.coins >= GLAZE_PRICE} drop={popIn(time, SHOP_GLAZE * ENTER.gap, ENTER.pop)} opacity={entered(time, SHOP_GLAZE)} onClick={onClick} onBuy={onConfirm}>
          {shop.glaze !== null && (
            <Tooltip show={tipShown(SHOP_GLAZE, chosen, paused || choosing)} anchor="top-right" to="top-left" offsetX={-4} offsetY={coached ? TIP_COACHED : TIP_UP} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
              <CardTip name={`${GLAZES[shop.glaze].name} glaze`} text={GLAZES[shop.glaze].text} />
            </Tooltip>
          )}
          <GlazePot glaze={shop.glaze} />
        </Offer>
      </Flex>

      {/* The awning, over the head of the stall. */}
      <Sprite image={AWNING} x={0} y={awning} />
      {/* The actions: wooden signs under the stall, the way out painted green. */}
      <Flex left={0} right={0} top={ACTION_Y} direction="row" justifyContent="center" gap={ACTION_GAP} y={ACTION_RISE * (1 - popIn(time, (SHOP_GLAZE + 1) * ENTER.gap, ENTER.pop))} opacity={entered(time, SHOP_GLAZE + 1)}>
        <ActionSign chosen={chosen === SHOP_REMOVE} label={shop.removed ? "Removed" : "Remove one"} price={removalPrice(run)} afford={!shop.removed && run.coins >= removalPrice(run)} onPoint={() => onPoint(SHOP_REMOVE)} onPress={() => onClick(SHOP_REMOVE)} />
        <ActionSign chosen={chosen === SHOP_REROLL} label="New shelf" price={rerollPrice(run)} afford={run.coins >= rerollPrice(run)} onPoint={() => onPoint(SHOP_REROLL)} onPress={() => onClick(SHOP_REROLL)} />
        <ActionSign chosen={chosen === SHOP_LEAVE} go={true} label="Next cycle >" onPoint={() => onPoint(SHOP_LEAVE)} onPress={() => onClick(SHOP_LEAVE)} />
      </Flex>

      {/* The bar along the foot. On the left the fruit and the coins, as they are on the play screen: the pool's basket and how many
          fruit are in it (a tap on it, or D, opens the board of the whole pool over the shop), then the jar of coins and how many.
          In the middle what the shop has to say (a boss jar next, a buy refused). The right is left to the pause button. */}
      <Flex left={BAR_SIDE} top={BAR_Y} height={BAR_H} direction="row" alignItems="center" gap={16} opacity={entered(time, SHOP_GLAZE + 1)}>
        <Flex direction="row" alignItems="center" gap={6} focusable={false} onPress={onPool}>
          <Flex width={POOL_BASKET_W} height={POOL_H}>
            <Entity>
              <Sprite image="basket-back.png" x={0} y={0} />
              <Sprite image="basket.png" x={0} y={0} />
            </Entity>
          </Flex>
          <Text font={DISPLAY} size={DISPLAY_SIZE} color={LIGHT} shadow={INK} shadowX={2} shadowY={2}>{`${run.pool.length}`}</Text>
        </Flex>
        <Flex direction="row" alignItems="center" gap={6}>
          <Sprite image={COIN_JAR} />
          <Text font={DISPLAY} size={DISPLAY_SIZE} color={LIGHT} shadow={INK} shadowX={2} shadowY={2}>{`${run.coins}`}</Text>
        </Flex>
      </Flex>
      <Flex left={0} right={0} top={BAR_Y} height={BAR_H} direction="row" alignItems="center" justifyContent="center" opacity={entered(time, SHOP_GLAZE + 1)}>
        <Text width={BAR_MESSAGE_W} maxWidth={BAR_MESSAGE_W} align="center" color={LIGHT}>
          {run.message}
        </Text>
      </Flex>

      {/* Taking a fruit out, or choosing one for a glaze: the pool by kind on a board in the middle of the screen, its kinds
          wrapping when there are many (for a glaze, only those it can go on). */}
      {choosing && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          <Flex left={0} right={0} top={0} bottom={0} direction="column" alignItems="center" justifyContent="center">
            <Flex width={Math.max(240, Math.min(REMOVE_W, kinds.reduce((w, row) => w + removeCell(row.kind), 0) + 32))} direction="column" alignItems="stretch">
              <Dialog title={shop.glazing && shop.glaze !== null ? `${GLAZES[shop.glaze].name} glaze: on which?` : "Take out one"}>
                <Flex direction="row" wrap justifyContent="center" alignItems="end" rowGap={4} columnGap={0}>
                  {placed(kinds).map((cell) => (
                    <Flex key={cell.card.kind} width={removeCell(cell.card.kind)} direction="column" alignItems="center" focusable={false} onPress={() => onClick(cell.at)}>
                      <Flex width={removeCell(cell.card.kind) - 4} height={fruitImageSize(cell.card.kind) + 8} backgroundImage={cell.at === shop.removeCursor ? SELECT : undefined} slice={CARD_SLICE}>
                        <FruitBall kind={cell.card.kind} x={(removeCell(cell.card.kind) - 4) / 2} y={fruitImageSize(cell.card.kind) / 2 + 4} />
                      </Flex>
                      <Text color={INK}>{`${cell.card.count}`}</Text>
                      {shop.glazing && shop.glaze !== null && cell.at === shop.removeCursor && (
                        <Flex width={12} height={12}>
                          <Entity>
                            <GlazeMark glaze={shop.glaze} x={6} y={6} />
                          </Entity>
                        </Flex>
                      )}
                    </Flex>
                  ))}
                </Flex>
                {/* A tap on a kind only chooses it. What takes it out is this button (or Enter), which names it and its price,
                    so nothing leaves the pool by a slip of the finger. */}
                <Flex direction="row" justifyContent="center" alignItems="center" gap={12} paddingTop={6}>
                  {shop.removeCursor >= 0 && <TapButton label={shop.glazing ? `Glaze ${chosenName(kinds, shop.removeCursor)}` : `Take out ${chosenName(kinds, shop.removeCursor)}`} onPress={onConfirm} />}
                  {shop.removeCursor < 0 && <Text color={INK_SOFT}>Choose a fruit</Text>}
                  <TapButton label="Back" onPress={onSpace} />
                </Flex>
              </Dialog>
            </Flex>
          </Flex>
        </Entity>
      )}
    </Layer>
  );
}
