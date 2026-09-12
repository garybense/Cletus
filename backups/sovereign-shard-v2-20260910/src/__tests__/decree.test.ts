import { describe, it, expect } from "vitest";
import {
  isCreatorMessage,
  formatCreatorDecree,
  formatPeerMessage,
  buildDecreeSystemMessage,
  externalWakeSignal,
} from "../agent/decree.js";
import type { CletusConfig } from "../types.js";

const config = {
  creatorAddress: "0xAbCdEfabcdefabcdefabcdefabcdefabcdefabcd",
} as CletusConfig;

describe("isCreatorMessage", () => {
  it("matches the creator address case-insensitively", () => {
    expect(isCreatorMessage(config.creatorAddress, config)).toBe(true);
    expect(isCreatorMessage(config.creatorAddress.toUpperCase(), config)).toBe(true);
    expect(isCreatorMessage("  0xabcdefabcdefabcdefabcdefabcdefabcdefabcd  ", config)).toBe(true);
  });

  it("does not match peer addresses", () => {
    expect(isCreatorMessage("0x1111111111111111111111111111111111111111", config)).toBe(false);
  });

  it("accepts the 'creator' sender alias", () => {
    expect(isCreatorMessage("creator", config)).toBe(true);
    expect(isCreatorMessage("CREATOR", config)).toBe(true);
  });

  it("never matches empty values or missing creator config", () => {
    expect(isCreatorMessage("", config)).toBe(false);
    expect(isCreatorMessage("0x1111111111111111111111111111111111111111", { creatorAddress: "" } as CletusConfig)).toBe(false);
  });
});

describe("formatCreatorDecree", () => {
  it("wraps content in the creator_decree directive", () => {
    const out = formatCreatorDecree("0xabc", "Stop everything.");
    expect(out).toContain("<creator_decree>");
    expect(out).toContain("</creator_decree>");
    expect(out).toContain("Stop everything.");
    expect(out).toContain("ABSOLUTE COMMAND");
  });
});

describe("formatPeerMessage", () => {
  it("marks the message as a peer message", () => {
    expect(formatPeerMessage("0xpeer", "hi")).toContain("[Peer Agent Message from 0xpeer]");
  });
});

describe("buildDecreeSystemMessage", () => {
  it("produces a supreme-priority system block", () => {
    const out = buildDecreeSystemMessage("Do X now.");
    expect(out).toContain("<creator_decree>");
    expect(out).toContain("SUPREME CREATOR DECREE");
    expect(out).toContain("Do X now.");
    expect(out).toContain("supersedes ALL background tasks");
  });
});

describe("externalWakeSignal", () => {
  it("returns false while sleeping", () => {
    expect(externalWakeSignal({ getAgentState: () => "sleeping" } as any)).toBe(false);
  });

  it("returns true when the agent state leaves sleeping (e.g. dashboard decree)", () => {
    expect(externalWakeSignal({ getAgentState: () => "running" } as any)).toBe(true);
    expect(externalWakeSignal({ getAgentState: () => "waking" } as any)).toBe(true);
  });

  it("does not wake on dead state", () => {
    expect(externalWakeSignal({ getAgentState: () => "dead" } as any)).toBe(false);
  });
});