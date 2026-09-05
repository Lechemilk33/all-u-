package com.flipfinder;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;
import net.runelite.client.config.Range;

@ConfigGroup("flipfinder")
public interface FlipFinderConfig extends Config
{
	@ConfigItem(
		keyName = "endpoint",
		name = "Flip Finder URL",
		description = "Where the local flip finder is listening. Must be a loopback address:"
			+ " this plugin will refuse to send your account state anywhere else.",
		position = 1
	)
	default String endpoint()
	{
		return "http://127.0.0.1:8787";
	}

	@Range(min = 2, max = 60)
	@ConfigItem(
		keyName = "intervalSeconds",
		name = "Report every (seconds)",
		description = "How often to report cash, inventory and offers.",
		position = 2
	)
	default int intervalSeconds()
	{
		return 5;
	}

	@ConfigItem(
		keyName = "sendInventory",
		name = "Include inventory",
		description = "Report inventory contents as well as the coin stack, so the finder"
			+ " can tell you what you are already holding.",
		position = 3
	)
	default boolean sendInventory()
	{
		return true;
	}
}
