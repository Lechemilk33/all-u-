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

	@ConfigItem(
		keyName = "autofill",
		name = "Prefill staged orders",
		description = "When you stage an order in the finder, fill the Grand Exchange search box"
			+ " and price input with it. You still click the slot and click Confirm yourself:"
			+ " this types, it does not trade. Off by default.",
		position = 4
	)
	default boolean autofill()
	{
		return false;
	}

	// The three ids below are client-version sensitive: they shift between
	// RuneLite releases. Exposing them as settings means a mismatch after an
	// update is a one-line fix by the user rather than a rebuild, and the
	// prefill degrades to doing nothing in the meantime.

	@ConfigItem(
		keyName = "chatboxInputComponentId",
		name = "Chatbox input id (advanced)",
		description = "Component id of the chatbox text input. Change only if prefill stops"
			+ " working after a RuneLite update.",
		position = 90
	)
	default int chatboxInputComponentId()
	{
		return 10616858;
	}

	@ConfigItem(
		keyName = "meslayerInputVarc",
		name = "Input varc (advanced)",
		description = "VarClient id holding the chatbox input string.",
		position = 91
	)
	default int meslayerInputVarc()
	{
		return 335;
	}

	@ConfigItem(
		keyName = "meslayerModeVarc",
		name = "Input mode varc (advanced)",
		description = "VarClient id holding the chatbox input mode.",
		position = 92
	)
	default int meslayerModeVarc()
	{
		return 343;
	}
}
