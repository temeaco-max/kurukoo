import contract from "@/contracts/chat-presentation-contract.json";

export type ChatPresentationFixture = (typeof contract)["fixtures"][number];
export type ChatPresentationContract = typeof contract;

export const CHAT_PRESENTATION_CONTRACT: ChatPresentationContract = contract;

export function getChatPresentationFixture(id: string): ChatPresentationFixture | undefined {
  return CHAT_PRESENTATION_CONTRACT.fixtures.find((fixture) => fixture.id === id);
}

export function hasChatAction(fixtureId: string, action: string): boolean {
  return Boolean(getChatPresentationFixture(fixtureId)?.actions.includes(action));
}
