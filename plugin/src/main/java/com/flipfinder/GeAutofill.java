package com.flipfinder;

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Client;
import net.runelite.api.widgets.Widget;

/**
 * Prefills the Grand Exchange search box and price input from a staged order.
 *
 * Why this is permitted where an external clicker is not — the distinction is
 * narrow and worth stating precisely:
 *
 *   - This sets client variables and re-runs the client's OWN key-listener
 *     script through the RuneLite plugin API. No operating-system mouse or
 *     keyboard event is synthesised. Jagex's ruling of 25 January 2017 permits
 *     only "your operating system's official default mouse keys program, unless
 *     it is to remap a key to any other button", and named AutoHotkey and
 *     similar as previously tolerated and no longer so. Generating input from
 *     outside the client is exactly that prohibited category.
 *   - It adds no menu entries, so nothing new causes an action to be sent to the
 *     server. The Third Party Client Guidelines name that category explicitly.
 *   - Clicking the slot and clicking Confirm remain yours. Those are the server
 *     actions; this only fills in text you would otherwise type.
 *
 * The same approach is used by 07flip, which is listed in the official RuneLite
 * plugin-hub registry.
 *
 * NOTE ON CONSTANTS: the VarClient ids, the chatbox component id and the search
 * mode value are client-version sensitive and shift between RuneLite releases.
 * They are passed in rather than hard-coded here, every lookup is null-checked,
 * and every failure is a silent no-op — so a mismatch turns the feature off
 * rather than breaking the plugin. Verify them against the RuneLite version you
 * build against before relying on it.
 */
@Slf4j
@Singleton
public class GeAutofill
{
	/** The input mode the Grand Exchange search box runs in, as observed. */
	private static final int GE_SEARCH_MODE = 14;

	@Inject
	private Client client;

	/** Set once a search has been prefilled, so we never fight the user's typing. */
	private int filledSearchForItem = -1;
	private boolean filledPrice = false;

	public void reset()
	{
		filledSearchForItem = -1;
		filledPrice = false;
	}

	/**
	 * Type the item name into the GE search box, as if you had typed it.
	 *
	 * Returns false and changes nothing whenever the search box is not open,
	 * which is the normal case until you click an empty slot yourself.
	 */
	public boolean fillSearch(StagedOrder order, int chatboxInputComponentId,
		int meslayerInputVarc, int meslayerModeVarc)
	{
		if (order == null || !order.isUsable() || order.itemId == filledSearchForItem)
		{
			return false;
		}

		Widget searchBox = client.getWidget(chatboxInputComponentId);
		if (searchBox == null || searchBox.isHidden())
		{
			return false;
		}

		// The client's own key listener is what turns the input string into a
		// search. Re-running it means the client processes this identically to
		// typed input, rather than us reimplementing the search.
		Object[] keyListener = searchBox.getOnKeyListener();
		if (keyListener == null)
		{
			log.debug("GE search box has no key listener; not prefilling");
			return false;
		}

		client.setVarcStrValue(meslayerInputVarc, order.itemName);
		client.setVarcIntValue(meslayerModeVarc, GE_SEARCH_MODE);
		client.runScript(keyListener);
		filledSearchForItem = order.itemId;
		log.debug("Prefilled GE search with {}", order.itemName);
		return true;
	}

	/**
	 * Put the staged price into the custom-price input.
	 *
	 * Refuses when the price has drifted outside the spread it was validated
	 * against. A stale prefill is worse than none, because you would not notice
	 * having typed it.
	 */
	public boolean fillPrice(StagedOrder order, int chatboxInputComponentId, int meslayerInputVarc)
	{
		if (order == null || filledPrice)
		{
			return false;
		}
		if (!order.isUsable())
		{
			log.debug("Staged price {} left its validated spread {}-{}; not prefilling",
				order.price, order.spreadLow, order.spreadHigh);
			return false;
		}

		Widget input = client.getWidget(chatboxInputComponentId);
		if (input == null || input.isHidden())
		{
			return false;
		}
		Object[] keyListener = input.getOnKeyListener();
		if (keyListener == null)
		{
			return false;
		}

		client.setVarcStrValue(meslayerInputVarc, Long.toString(order.price));
		client.runScript(keyListener);
		filledPrice = true;
		log.debug("Prefilled GE price with {}", order.price);
		return true;
	}

	public void onPriceEntryClosed()
	{
		filledPrice = false;
	}
}
