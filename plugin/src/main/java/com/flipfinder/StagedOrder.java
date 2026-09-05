package com.flipfinder;

/**
 * An order staged in the finder, waiting to be entered in game.
 *
 * The spread is carried alongside the price so the prefill can refuse to type a
 * number the market has since left behind. A staged price is validated against
 * observed trades when it is staged; this lets the client re-check it at the
 * moment it would actually be used.
 */
public class StagedOrder
{
	public int itemId;
	public String itemName;
	public String side;
	public long price;
	public int quantity;
	public long spreadLow;
	public long spreadHigh;
	public long stagedAt;

	public boolean isBuy()
	{
		return "buy".equals(side);
	}

	/** True when the staged price still sits inside the spread it was validated against. */
	public boolean priceStillSupported()
	{
		return price >= spreadLow && price <= spreadHigh;
	}

	public boolean isUsable()
	{
		return itemId > 0 && itemName != null && !itemName.isEmpty()
			&& price > 0 && quantity > 0 && priceStillSupported();
	}
}
