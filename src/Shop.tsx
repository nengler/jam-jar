import { Entity, Flex, Shape, Sprite, Text, Tooltip, useTime, type Child } from "@tsengine/runtime/jsx";

import { Dialog } from "./Board.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { useGame } from "./GameState.ts";
import { TapButton } from "./KeyHint.tsx";
import { chosenName, ENTER, entered, placed, popIn, poolRows } from "./layout.ts";
import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { ITEMS, type ItemKind } from "./rules/items.ts";
import { RuleText } from "./RuleText.tsx";
import { Bloops } from "./Sounds.tsx";
import { Terms } from "./Terms.tsx";
import { FRUIT_PRICE, removalPrice, rerollPrice, SHOP_ITEM, SHOP_LEAVE, SHOP_REMOVE, SHOP_REROLL, OFFERED, type Run, type Shop as ShopState } from "./rules/jar.ts";
import {
  biggestFruit,
  fruitImageSize,
  AWNING,
  AWNING_H,
  BAD,
  CARD_SLICE,
  CLOTH,
  COIN_JAR,
  DISPLAY,
  DISPLAY_SIZE,
  INK,
  INK_SOFT,
  KEYWORD,
  LABEL_SLICE,
  labelFor,
  LIGHT,
  SELECT,
  SHADE,
  SIGN_SLICE,
  signFor,
  SOLD,
  STALL,
} from "./theme.ts";

/** The stall: four labels in a row standing on its counter, and how far the chosen one is raised. */
const CARD_W = 148;
const CARD_H = 200;
const CARD_GAP = 6;
const CARD_LIFT = 10;
/** The room left under a label's text, inside its frame: a longer text scrolls rather than running over it. */
const LABEL_FOOT = 8;
/** Where the stall's counter's top is: the labels stand on it. */
const STALL_Y = 256;
/** The actions: three signs under the stall, as wide across as the labels. */
const ACTION_W = 196;
const ACTION_H = 36;
const ACTION_GAP = 11;
const ACTION_Y = 280;
/**
 * The bar along the foot of the screen, under the actions: the pool's basket (as on the play screen, 56 x 38) and the coins on the
 * left, the Buy button or what just happened in the middle; the right is the pause button's.
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
const PICTURE_H = 88;
const BASKET_W = 56;
const BASKET_Y = 46;
const CLOTH_W = 60;
const ITEM_W = 48;
/** How deep a fruit sits in its basket: this share of its height is below the basket's rim. */
const BASKET_SINK = 0.4;
/** Choosing a fruit to take out: the pool's kinds on a board, each in a cell its fruit's width and a little more, wrapping at this width. */
const REMOVE_W = 520;

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
        <Sprite image={CLOTH} x={(PICTURE_W - CLOTH_W) / 2} y={PICTURE_H - 14} />
        {item !== null && <Sprite image={`item-${item}.png`} x={(PICTURE_W - ITEM_W) / 2} y={PICTURE_H - 50} />}
      </Entity>
    </Flex>
  );
}

/**
 * The price, in the label's top left corner inside its frame: the picture is centred, so the corner beside it is clear (a fruit is
 * round, and the widest, the Pumpkin, leaves its corners empty). It takes no room from what is laid out on the label.
 */
function OnLabel({ price, afford }: { price: number; afford: boolean }) {
  return (
    <Flex left={10} top={10}>
      <Price price={price} afford={afford} />
    </Flex>
  );
}

/** What a place on the stall shows once it is bought: its empty basket or cloth, stamped SOLD. */
function Sold({ children }: { children: Child }) {
  return (
    <Flex height="grow" direction="column" alignItems="center" justifyContent="center" gap={8} paddingBottom={20}>
      {children}
      <Sprite image={SOLD} />
    </Flex>
  );
}

interface OfferProps {
  /** Its place in the shop's cursor order. */
  at: number;
  chosen: boolean;
  item: boolean;
  /** How far into the shop's coming in it is (0 to 1), and how far it has faded in. */
  drop: number;
  opacity: number;
  onClick: (place: number) => void;
  children: Child;
}

/** One place on the stall: a label standing on the counter, raised when it is the chosen one, dropping into place as the shop comes in. */
function Offer({ at, chosen, item, drop, opacity, onClick, children }: OfferProps) {
  return (
    <Flex height={CARD_H + CARD_LIFT} direction="column" justifyContent={chosen ? "start" : "end"} y={-CARD_DROP * (1 - drop)} opacity={opacity}>
      <Flex width={CARD_W} height={CARD_H} direction="column" alignItems="center" paddingX={6} paddingTop={14} paddingBottom={LABEL_FOOT} backgroundImage={labelFor(chosen, item)} slice={LABEL_SLICE} focusable={false} onPress={() => onClick(at)}>
        {children}
      </Flex>
    </Flex>
  );
}

/** An offer's name and its rule text, under its picture. The text takes what is left of the label, and scrolls when it is longer. */
function Words({ name, text }: { name: string; text: string }) {
  return (
    <Flex height="grow" direction="column" alignItems="center">
      <Text width={CARD_W - 12} maxWidth={CARD_W - 12} align="center" color={INK}>
        {name}
      </Text>
      <Flex width={CARD_W - 12} height="grow" direction="column" alignItems="center" overflow="scroll" scrollbarColor={INK_SOFT}>
        <RuleText x={0} y={0} width={CARD_W - 20} text={text} color={INK_SOFT} accent={KEYWORD} />
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

/** Whether the shop's place `at` has something for sale: a fruit or the item not yet bought (not an action, nor none). */
function forSaleAt(shop: ShopState, at: number): boolean {
  if (at >= 0 && at < SHOP_ITEM) return shop.fruits[at] != null;
  return at === SHOP_ITEM && shop.item !== null;
}


/** How far above its place a card starts as the shop comes in, and how far below theirs the actions start, in pixels. */
const CARD_DROP = 260;
const ACTION_RISE = 120;

/**
 * The shop between two cycles: a market stall over the dimmed kitchen. A striped awning across the top; three fruit in baskets
 * and an item on a cloth, each on a jam-jar label with its price in the corner, standing on the stall's counter; wooden signs
 * for removal, a reroll and the way out; and a bar along the foot with the pool, the Buy button and the coins. No keys are shown
 * on it: the arrows, Enter, Space and D work as on the play screen. The rules (rules/jar.ts, `Shop`) hold what is for sale and
 * where the cursor is; this draws them.
 */
export function Shop({ run, shop, onPoint, onClick, onAway, onConfirm, onSpace, onPool }: ShopProps) {
  // The card the cursor is on shows what its keywords mean, but not over the pause menu.
  const paused = useGame((g) => g.paused);
  const kinds = poolRows(run.pool);
  // The shop comes in as a run does: the awning drops down, each label drops onto the counter one after another, the signs rise
  // into theirs, and the purse slides in from the right. Each is moved within its own slot (its `y`), so the row is laid out as
  // it always is.
  const time = useTime();
  // The place the cursor is on, or none while a fruit is being chosen to take out.
  const chosen = shop.removing ? -1 : shop.cursor;
  // Whether the chosen place on the shelf has something for sale, for the Buy button: not an action, a sold place, or none.
  const forSale = forSaleAt(shop, chosen);
  const awning = -AWNING_H * (1 - popIn(time, 0, ENTER.pop));
  return (
    <Entity>
      {/* Shaded twice: the shop covers the whole screen, and the boards behind it should not show through. */}
      <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
      <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
      {/* A bloop for each card as it drops in, and one for the actions. */}
      <Bloops start={ENTER.pop * 0.6} gap={ENTER.gap} count={SHOP_ITEM + 2} />

      {/* The stall's counter, which the labels stand on. */}
      <Sprite image={STALL} x={0} y={STALL_Y} />

      {/* The stall: three fruit and the item. A tap or a click chooses a label and a second buys it; the pointer coming over one
          does not choose it (see the pick). */}
      <Flex left={0} right={0} top={STALL_Y + 2 - CARD_H - CARD_LIFT} direction="row" justifyContent="center" gap={CARD_GAP} onPressOutside={onAway}>
        {placed(shop.fruits).map((slot) => (
          <Offer key={slot.at} at={slot.at} chosen={chosen === slot.at} item={false} drop={popIn(time, slot.at * ENTER.gap, ENTER.pop)} opacity={entered(time, slot.at)} onClick={onClick}>
            {slot.card !== null && (
              <Tooltip show={!paused && chosen === slot.at} anchor={slot.at < 2 ? "top-left" : "top-right"} to={slot.at < 2 ? "top-right" : "top-left"} offsetX={slot.at < 2 ? 4 : -4} offsetY={-40} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
                <Terms text={FRUITS[slot.card].text} />
              </Tooltip>
            )}
            {slot.card !== null && <Basket kind={slot.card} />}
            {slot.card !== null && <Words name={FRUITS[slot.card].name} text={FRUITS[slot.card].text} />}
            {slot.card !== null && <OnLabel price={FRUIT_PRICE} afford={run.coins >= FRUIT_PRICE} />}
            {slot.card === null && <Sold><Basket kind={null} /></Sold>}
          </Offer>
        ))}
        <Offer at={SHOP_ITEM} chosen={chosen === SHOP_ITEM} item={true} drop={popIn(time, SHOP_ITEM * ENTER.gap, ENTER.pop)} opacity={entered(time, SHOP_ITEM)} onClick={onClick}>
          {shop.item !== null && (
            <Tooltip show={!paused && chosen === SHOP_ITEM} anchor="top-right" to="top-left" offsetX={-4} offsetY={-40} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
              <Terms text={ITEMS[shop.item].text} />
            </Tooltip>
          )}
          {shop.item !== null && <OnCloth item={shop.item} />}
          {shop.item !== null && <Words name={ITEMS[shop.item].name} text={ITEMS[shop.item].text} />}
          {shop.item !== null && <OnLabel price={ITEMS[shop.item].price} afford={run.coins >= ITEMS[shop.item].price} />}
          {shop.item === null && <Sold><OnCloth item={null} /></Sold>}
        </Offer>
      </Flex>

      {/* The awning, over the top of the labels. */}
      <Sprite image={AWNING} x={0} y={awning} />
      {/* The actions: wooden signs under the stall, the way out painted green. */}
      <Flex left={0} right={0} top={ACTION_Y} direction="row" justifyContent="center" gap={ACTION_GAP} y={ACTION_RISE * (1 - popIn(time, (SHOP_ITEM + 1) * ENTER.gap, ENTER.pop))} opacity={entered(time, SHOP_ITEM + 1)}>
        <ActionSign chosen={chosen === SHOP_REMOVE} label="Remove one" price={removalPrice(run)} afford={run.coins >= removalPrice(run)} onPoint={() => onPoint(SHOP_REMOVE)} onPress={() => onClick(SHOP_REMOVE)} />
        <ActionSign chosen={chosen === SHOP_REROLL} label="New shelf" price={rerollPrice(run)} afford={run.coins >= rerollPrice(run)} onPoint={() => onPoint(SHOP_REROLL)} onPress={() => onClick(SHOP_REROLL)} />
        <ActionSign chosen={chosen === SHOP_LEAVE} go={true} label="Next cycle >" onPoint={() => onPoint(SHOP_LEAVE)} onPress={() => onClick(SHOP_LEAVE)} />
      </Flex>

      {/* The bar along the foot. On the left the fruit and the coins, as they are on the play screen: the pool's basket and how many
          fruit are in it (a tap on it, or D, opens the board of the whole pool over the shop), then the jar of coins and how many.
          In the middle the Buy button while a card for sale is chosen (a tap on a card only chooses it, so it can be read and its
          text scrolled first; Enter buys it too), else what just happened (a fruit bought, the shelf restocked). The right is left
          to the pause button. */}
      <Flex left={BAR_SIDE} top={BAR_Y} height={BAR_H} direction="row" alignItems="center" gap={16} opacity={entered(time, SHOP_ITEM + 1)}>
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
      <Flex left={0} right={0} top={BAR_Y} height={BAR_H} direction="row" alignItems="center" justifyContent="center" opacity={entered(time, SHOP_ITEM + 1)}>
        {forSale && <TapButton label="Buy" onPress={onConfirm} />}
        {!forSale && (
          <Text width={BAR_MESSAGE_W} maxWidth={BAR_MESSAGE_W} align="center" color={LIGHT}>
            {run.message}
          </Text>
        )}
      </Flex>

      {/* Taking a fruit out: the pool by kind on a board in the middle of the screen, its kinds wrapping when there are many. */}
      {shop.removing && (
        <Entity>
          <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
          <Flex left={0} right={0} top={0} bottom={0} direction="column" alignItems="center" justifyContent="center">
            <Flex width={Math.max(240, Math.min(REMOVE_W, kinds.reduce((w, row) => w + removeCell(row.kind), 0) + 32))} direction="column" alignItems="stretch">
              <Dialog title="Take out one">
                <Flex direction="row" wrap justifyContent="center" alignItems="end" rowGap={4} columnGap={0}>
                  {placed(kinds).map((cell) => (
                    <Flex key={cell.card.kind} width={removeCell(cell.card.kind)} direction="column" alignItems="center" focusable={false} onPress={() => onClick(cell.at)}>
                      <Flex width={removeCell(cell.card.kind) - 4} height={fruitImageSize(cell.card.kind) + 8} backgroundImage={cell.at === shop.removeCursor ? SELECT : undefined} slice={CARD_SLICE}>
                        <FruitBall kind={cell.card.kind} x={(removeCell(cell.card.kind) - 4) / 2} y={fruitImageSize(cell.card.kind) / 2 + 4} />
                      </Flex>
                      <Text color={INK}>{`${cell.card.count}`}</Text>
                    </Flex>
                  ))}
                </Flex>
                {/* A tap on a kind only chooses it. What takes it out is this button (or Enter), which names it and its price,
                    so nothing leaves the pool by a slip of the finger. */}
                <Flex direction="row" justifyContent="center" alignItems="center" gap={12} paddingTop={6}>
                  {shop.removeCursor >= 0 && <TapButton label={`Take out ${chosenName(kinds, shop.removeCursor)}`} onPress={onConfirm} />}
                  {shop.removeCursor < 0 && <Text color={INK_SOFT}>Choose a fruit</Text>}
                  <TapButton label="Back" onPress={onSpace} />
                </Flex>
              </Dialog>
            </Flex>
          </Flex>
        </Entity>
      )}
    </Entity>
  );
}
