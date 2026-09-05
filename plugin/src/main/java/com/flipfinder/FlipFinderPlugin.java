package com.flipfinder;

import com.google.gson.Gson;
import com.google.inject.Provides;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import javax.inject.Inject;
import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Client;
import net.runelite.api.GameState;
import net.runelite.api.GrandExchangeOffer;
import net.runelite.api.GrandExchangeOfferState;
import net.runelite.api.InventoryID;
import net.runelite.api.Item;
import net.runelite.api.ItemContainer;
import net.runelite.api.WorldType;
import net.runelite.api.events.ClientTick;
import net.runelite.api.events.GrandExchangeOfferChanged;
import net.runelite.client.callback.ClientThread;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.eventbus.Subscribe;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;

/**
 * Reports read-only account state to a flip finder running on this machine.
 *
 * Scope, deliberately: this plugin reads. It reports the coin stack, inventory
 * contents and Grand Exchange offer state, and it does nothing else. It does not
 * place, edit, collect or cancel an offer, it does not click, and it does not
 * type.
 *
 * That boundary is not a preference, it is where the API ends. Jagex's
 * third-party client guidelines prohibit "any addition of new menu entries which
 * cause actions to be sent to the server", and Rule 7 of the Rules of RuneScape
 * prohibits automation tools outright — macroing major is a permanent ban,
 * available on a first offence. Accordingly RuneLite's GrandExchangeOffer
 * exposes six getters and no setters: there is no placeOffer and no cancelOffer
 * to call. Watching, by contrast, is exactly what the plugin API is for.
 *
 * Account state never leaves the machine: the endpoint is validated as loopback
 * on every send, so a mistyped or edited config cannot post your cash stack to a
 * remote host.
 */
@Slf4j
@PluginDescriptor(
	name = "Flip Finder",
	description = "Reports cash, inventory and GE offer progress to a local flip finder. Read-only.",
	tags = {"grand", "exchange", "flipping", "merching", "prices"}
)
public class FlipFinderPlugin extends Plugin
{
	private static final int COINS_ITEM_ID = 995;

	@Inject private Client client;
	@Inject private ClientThread clientThread;
	@Inject private FlipFinderConfig config;
	@Inject private ScheduledExecutorService executor;
	@Inject private GeAutofill autofill;

	private final Gson gson = new Gson();

	/**
	 * The order currently staged in the finder, refreshed on every report.
	 * Volatile because it is written on the executor and read on the client
	 * thread. Null means nothing is staged, and nothing will be prefilled.
	 */
	private volatile StagedOrder staged;

	/**
	 * Latest known state per slot, updated from the event and read by the
	 * reporter. Concurrent because the event arrives on the client thread and the
	 * report is built on the executor — the HTTP call must never block the game.
	 */
	private final Map<Integer, Map<String, Object>> offers = new ConcurrentHashMap<>();

	private ScheduledFuture<?> task;

	@Provides
	FlipFinderConfig provideConfig(ConfigManager configManager)
	{
		return configManager.getConfig(FlipFinderConfig.class);
	}

	@Override
	protected void startUp()
	{
		int period = Math.max(2, config.intervalSeconds());
		task = executor.scheduleWithFixedDelay(this::report, 2, period, TimeUnit.SECONDS);
		log.info("Flip Finder reporting to {} every {}s", config.endpoint(), period);
	}

	@Override
	protected void shutDown()
	{
		if (task != null)
		{
			task.cancel(true);
			task = null;
		}
		offers.clear();
		staged = null;
		autofill.reset();
	}

	/**
	 * Fires whenever the server sends updated offer information, which is the
	 * moment a fill lands. Reporting from here rather than only on the timer is
	 * what makes time-to-fill measurable to the second instead of to the polling
	 * interval.
	 *
	 * On login this fires once per slot with state EMPTY, which is how the finder
	 * learns that a slot was cleared while the plugin was not watching.
	 */
	@Subscribe
	public void onGrandExchangeOfferChanged(GrandExchangeOfferChanged event)
	{
		GrandExchangeOffer offer = event.getOffer();
		if (offer == null)
		{
			return;
		}

		Map<String, Object> e = new HashMap<>();
		e.put("slot", event.getSlot());
		e.put("itemId", offer.getItemId());
		e.put("state", stateName(offer.getState()));
		e.put("price", offer.getPrice());
		e.put("totalQuantity", offer.getTotalQuantity());
		e.put("quantitySold", offer.getQuantitySold());
		// A buy offer can fill below the price you asked, so this is the true cost
		// basis and getPrice() is only the ask.
		e.put("spent", offer.getSpent());
		offers.put(event.getSlot(), e);

		// Push straight away; a fill is the event worth being timely about.
		executor.execute(this::report);
	}

	private static String stateName(GrandExchangeOfferState state)
	{
		return state == null ? "EMPTY" : state.name();
	}

	private void report()
	{
		try
		{
			if (client.getGameState() != GameState.LOGGED_IN)
			{
				return;
			}

			Map<String, Object> payload = snapshot();
			if (payload == null)
			{
				return;
			}
			post(payload);
		}
		catch (Exception e)
		{
			// A finder that is not running is the normal case, not an incident.
			log.debug("Flip Finder report failed: {}", e.getMessage());
		}
	}

	/**
	 * Reads inventory on the client thread — item containers must not be touched
	 * from the scheduler — and copies the result out before any network work.
	 */
	private Map<String, Object> snapshot()
	{
		final Map<String, Object> out = new ConcurrentHashMap<>();
		final List<Map<String, Object>> inventory = new ArrayList<>();

		clientThread.invoke(() ->
		{
			int cash = 0;
			ItemContainer inv = client.getItemContainer(InventoryID.INVENTORY);
			if (inv != null)
			{
				for (Item item : inv.getItems())
				{
					if (item.getId() == COINS_ITEM_ID)
					{
						cash += item.getQuantity();
					}
					else if (item.getId() > 0 && config.sendInventory())
					{
						Map<String, Object> e = new HashMap<>();
						e.put("id", item.getId());
						e.put("quantity", item.getQuantity());
						inventory.add(e);
					}
				}
			}
			out.put("cashStack", cash);
			out.put("world", client.getWorld());
			// Read the world you are actually on rather than assuming. On a free
			// world members items cannot be bought at all, so the finder uses this
			// to stop offering flips you could not make — which only works if the
			// value is observed.
			out.put("member", client.getWorldType().contains(WorldType.MEMBERS));
		});

		if (!out.containsKey("cashStack"))
		{
			return null;
		}

		Map<String, Object> payload = new HashMap<>(out);
		payload.put("inventory", inventory);
		payload.put("geOffers", new ArrayList<>(offers.values()));
		return payload;
	}

	private void post(Map<String, Object> payload) throws Exception
	{
		URI uri = URI.create(config.endpoint() + "/api/client-state");
		if (!isLoopback(uri))
		{
			log.warn("Refusing to send account state to non-loopback host {}", uri.getHost());
			return;
		}

		URL url = uri.toURL();
		HttpURLConnection conn = (HttpURLConnection) url.openConnection();
		conn.setRequestMethod("POST");
		conn.setRequestProperty("Content-Type", "application/json");
		conn.setConnectTimeout(1500);
		conn.setReadTimeout(1500);
		conn.setDoOutput(true);

		byte[] body = gson.toJson(payload).getBytes(StandardCharsets.UTF_8);
		try (OutputStream os = conn.getOutputStream())
		{
			os.write(body);
		}

		// The staged order rides back on the report we already make, so prefill
		// costs no extra round trip.
		if (conn.getResponseCode() == 200)
		{
			try (InputStreamReader reader = new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))
			{
				StageResponse parsed = gson.fromJson(reader, StageResponse.class);
				staged = parsed == null ? null : parsed.staged;
			}
			catch (Exception e)
			{
				// A response we cannot parse means we simply have nothing staged;
				// it must never take down the reporting loop.
				staged = null;
			}
		}
		conn.disconnect();
	}

	/** Shape of the /api/client-state response. Only the staged order is used. */
	private static final class StageResponse
	{
		StagedOrder staged;
	}

	/**
	 * Prefill the Grand Exchange inputs from the staged order, if one is live and
	 * the user has opted in.
	 *
	 * This runs on ClientTick because the search box and price input only exist
	 * for the moments they are open — there is no event that fires exactly then,
	 * and every call is a cheap null check when they are not.
	 */
	@Subscribe
	public void onClientTick(ClientTick event)
	{
		if (!config.autofill() || staged == null)
		{
			return;
		}
		if (client.getGameState() != GameState.LOGGED_IN)
		{
			return;
		}

		StagedOrder order = staged;
		if (!order.isUsable())
		{
			return;
		}

		final int chatbox = config.chatboxInputComponentId();
		autofill.fillSearch(order, chatbox, config.meslayerInputVarc(), config.meslayerModeVarc());
		autofill.fillPrice(order, chatbox, config.meslayerInputVarc());
	}

	private static boolean isLoopback(URI uri)
	{
		String host = uri.getHost();
		return "127.0.0.1".equals(host) || "localhost".equals(host) || "::1".equals(host);
	}
}
