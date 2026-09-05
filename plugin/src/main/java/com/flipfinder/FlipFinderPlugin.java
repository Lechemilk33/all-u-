package com.flipfinder;

import com.google.gson.Gson;
import com.google.inject.Provides;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import javax.inject.Inject;
import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Client;
import net.runelite.api.GameState;
import net.runelite.api.GrandExchangeOffer;
import net.runelite.api.InventoryID;
import net.runelite.api.Item;
import net.runelite.api.ItemContainer;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;

/**
 * Reports read-only account state to a flip finder running on this machine.
 *
 * Scope, deliberately: this plugin reads. It reports the coin stack, inventory
 * contents and open Grand Exchange offers, and it does nothing else. It does not
 * place, edit, collect or cancel an offer, it does not click, and it does not
 * type — automating a game action would breach Jagex's third-party client rules,
 * and the RuneLite plugin API exposes no way to synthesise the input that would
 * be required. The finder's job is to hand you exact numbers; entering them is
 * yours.
 *
 * Account state never leaves the machine: the endpoint is validated as a
 * loopback address on every send, so a mistyped or edited config cannot post
 * your cash stack to a remote host.
 */
@Slf4j
@PluginDescriptor(
	name = "Flip Finder",
	description = "Reports cash, inventory and GE offers to a local flip finder. Read-only.",
	tags = {"grand", "exchange", "flipping", "merching", "prices"}
)
public class FlipFinderPlugin extends Plugin
{
	private static final int COINS_ITEM_ID = 995;

	@Inject private Client client;
	@Inject private FlipFinderConfig config;
	@Inject private ScheduledExecutorService executor;

	private final Gson gson = new Gson();
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
	 * Reads state on the client thread. Item containers must not be touched from
	 * the scheduler thread, so the read is marshalled and the result copied out
	 * before any network work happens.
	 */
	private Map<String, Object> snapshot()
	{
		final Map<String, Object> out = new HashMap<>();
		final List<Map<String, Object>> inventory = new ArrayList<>();
		final List<Map<String, Object>> offers = new ArrayList<>();

		clientThreadRun(() ->
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

			GrandExchangeOffer[] geOffers = client.getGrandExchangeOffers();
			if (geOffers != null)
			{
				for (int slot = 0; slot < geOffers.length; slot++)
				{
					GrandExchangeOffer offer = geOffers[slot];
					if (offer == null || offer.getItemId() <= 0)
					{
						continue;
					}
					Map<String, Object> e = new HashMap<>();
					e.put("slot", slot);
					e.put("itemId", offer.getItemId());
					e.put("state", String.valueOf(offer.getState()));
					e.put("price", offer.getPrice());
					e.put("totalQuantity", offer.getTotalQuantity());
					e.put("quantitySold", offer.getQuantitySold());
					offers.add(e);
				}
			}

			out.put("world", client.getWorld());
		});

		if (!out.containsKey("cashStack"))
		{
			return null;
		}
		out.put("inventory", inventory);
		out.put("geOffers", offers);
		out.put("member", true);
		return out;
	}

	private void clientThreadRun(Runnable r)
	{
		// RuneLite injects a ClientThread for this; calling it directly keeps the
		// dependency surface of this class small and the ordering explicit.
		net.runelite.client.callback.ClientThread thread = injector.getInstance(
			net.runelite.client.callback.ClientThread.class);
		thread.invoke(r);
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
		conn.getResponseCode();
		conn.disconnect();
	}

	private static boolean isLoopback(URI uri)
	{
		String host = uri.getHost();
		return "127.0.0.1".equals(host) || "localhost".equals(host) || "::1".equals(host);
	}
}
